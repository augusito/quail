import { APIError, type Endpoint } from 'payload'

import { checkRateLimit } from '../lib/rateLimit'

// Public and unauthenticated, so both routes below are targets for
// token-guessing and signup-flooding — cap attempts per source IP rather
// than trusting the invite token check alone to gate cost.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function getClientIp(req: { headers: Request['headers'] }): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

type Invite = {
  cohort: { id: number; name?: string } | number
  email: string
  expiresAt?: string | null
  id: number
  role: 'intern' | 'trainer'
  status: 'expired' | 'revoked' | 'sent' | 'used'
  track?: string | null
}

/**
 * Shared by both routes below: looks up the invite by token and applies
 * §6.2's "expire 24 hours after issue, or can be revoked at admin's
 * discretion" rule. An invite found past its expiry while still `sent` is
 * lazily flipped to `expired` here (rather than via a cron) — same "plain
 * validation logic, no workflow engine" approach as the contract-lifecycle
 * and cohort-closing guards (§6.1, §6.4, §10).
 */
async function resolveInvite(
  payload: import('payload').BasePayload,
  token: string,
): Promise<{ error: Response } | { invite: Invite }> {
  const invites = await payload.find({
    collection: 'invites',
    where: { token: { equals: token } },
    limit: 1,
    overrideAccess: true,
  })
  const invite = invites.docs[0] as Invite | undefined

  if (!invite) {
    return { error: Response.json({ error: 'This invite link is not valid.' }, { status: 404 }) }
  }
  if (invite.status === 'revoked') {
    return { error: Response.json({ error: 'This invite link has been revoked.' }, { status: 410 }) }
  }
  if (invite.status === 'used') {
    return { error: Response.json({ error: 'This invite link has already been used.' }, { status: 410 }) }
  }
  if (invite.status === 'expired' || !invite.expiresAt || new Date(invite.expiresAt) < new Date()) {
    if (invite.status !== 'expired') {
      await payload.update({ collection: 'invites', id: invite.id, data: { status: 'expired' }, overrideAccess: true })
    }
    return { error: Response.json({ error: 'This invite link has expired.' }, { status: 410 }) }
  }

  return { invite }
}

function missingFields(body: Record<string, unknown>, fields: string[]): string[] {
  return fields.filter((field) => typeof body[field] !== 'string' || (body[field] as string).trim() === '')
}

/**
 * GET /api/register?token=... — lets the registration form
 * (src/app/(frontend)/register/page.tsx) discover which role/fields to
 * show, and display the target email, before the person has typed
 * anything. Never returns more than that: no name/statutory data exists
 * yet at this point.
 */
const lookupEndpoint: Endpoint = {
  path: '/register',
  method: 'get',
  handler: async (req) => {
    const rateLimit = checkRateLimit(`register-lookup:${getClientIp(req)}`, {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    const token = req.query?.token
    if (typeof token !== 'string' || !token) {
      return Response.json({ error: 'token is required.' }, { status: 400 })
    }

    const result = await resolveInvite(req.payload, token)
    if ('error' in result) return result.error
    const { invite } = result

    const cohortName = typeof invite.cohort === 'object' ? invite.cohort.name : undefined
    return Response.json({ role: invite.role, email: invite.email, cohortName, track: invite.track ?? null })
  },
}

/**
 * §6.2 self-registration (proposal v2): "Both interns and trainers
 * self-register, via an invite link personalized to their email... Only
 * that email address can complete registration with it." This is the
 * public, unauthenticated counterpart to the admin-only Invites
 * collection. A client posts the invite token plus their profile details;
 * this validates the invite (exists, not used/revoked/expired) and —
 * only then — creates the User plus the role-appropriate profile
 * (Intern + Education rows + Enrollment, or Trainer + a Draft Contract)
 * on the registrant's behalf via `overrideAccess`.
 *
 * `role` and the account `email` always come from the invite record,
 * never from the request body — a registrant cannot self-assign a role,
 * register under a different email than the one admin invited, or skip
 * the pending-approval step by sending extra fields.
 */
const submitEndpoint: Endpoint = {
  path: '/register',
  method: 'post',
  handler: async (req) => {
    const rateLimit = checkRateLimit(`register:${getClientIp(req)}`, {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      )
    }

    let body: Record<string, unknown>
    try {
      body = ((await req.json?.()) as Record<string, unknown>) ?? {}
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const { token, password } = body
    if (typeof token !== 'string' || typeof password !== 'string') {
      return Response.json({ error: 'token and password are required.' }, { status: 400 })
    }

    const result = await resolveInvite(req.payload, token)
    if ('error' in result) return result.error
    const { invite } = result

    const requiredByRole = invite.role === 'intern'
      ? ['name', 'dateOfBirth', 'gender', 'nationality', 'phone', 'nationalIdNumber', 'kraPin', 'shifNumber', 'nssfNumber']
      : ['name', 'occupation', 'phone', 'nationalIdNumber', 'kraPin']
    const missing = missingFields(body, requiredByRole)

    const nextOfKin = (body.nextOfKin ?? {}) as Record<string, unknown>
    const missingNextOfKin =
      invite.role === 'intern' ? missingFields(nextOfKin, ['name', 'relationship', 'phone']) : []

    if (missing.length > 0 || missingNextOfKin.length > 0) {
      const allMissing = [...missing, ...missingNextOfKin.map((f) => `nextOfKin.${f}`)]
      return Response.json({ error: `Missing required fields: ${allMissing.join(', ')}.` }, { status: 400 })
    }

    let user
    try {
      user = await req.payload.create({
        collection: 'users',
        data: {
          email: invite.email,
          password,
          name: body.name as string,
          role: invite.role,
          status: 'pending',
        },
        overrideAccess: true,
      })
    } catch (err) {
      const message = err instanceof APIError ? err.message : 'Could not create account.'
      return Response.json({ error: message }, { status: 400 })
    }

    const cohortId = typeof invite.cohort === 'object' ? invite.cohort.id : invite.cohort

    if (invite.role === 'intern') {
      const intern = await req.payload.create({
        collection: 'interns',
        data: {
          user: user.id,
          name: body.name as string,
          dateOfBirth: body.dateOfBirth as string,
          gender: body.gender as 'female' | 'male' | 'other',
          nationality: body.nationality as string,
          address: typeof body.address === 'string' ? body.address : undefined,
          phone: body.phone as string,
          email: invite.email,
          nationalIdNumber: body.nationalIdNumber as string,
          kraPin: body.kraPin as string,
          shifNumber: body.shifNumber as string,
          nssfNumber: body.nssfNumber as string,
          nextOfKin: {
            name: nextOfKin.name as string,
            relationship: nextOfKin.relationship as string,
            address: typeof nextOfKin.address === 'string' ? nextOfKin.address : undefined,
            phone: nextOfKin.phone as string,
            email: typeof nextOfKin.email === 'string' ? nextOfKin.email : undefined,
          },
        },
        overrideAccess: true,
      })

      const education = Array.isArray(body.education) ? (body.education as Record<string, unknown>[]) : []
      for (const entry of education) {
        if (typeof entry.school !== 'string' || typeof entry.qualification !== 'string') continue
        await req.payload.create({
          collection: 'education',
          data: {
            intern: intern.id,
            school: entry.school,
            qualification: entry.qualification,
            startDate: typeof entry.startDate === 'string' ? entry.startDate : undefined,
            endDate: typeof entry.endDate === 'string' ? entry.endDate : undefined,
          },
          overrideAccess: true,
        })
      }

      await req.payload.create({
        collection: 'enrollments',
        data: {
          intern: user.id,
          cohort: cohortId,
          track: invite.track as
            | 'business-management'
            | 'ict'
            | 'mechanics'
            | 'supply-chain'
            | 'truck-driving',
          outcome: 'in-progress',
        },
        overrideAccess: true,
      })
    } else {
      await req.payload.create({
        collection: 'trainers',
        data: {
          user: user.id,
          name: body.name as string,
          occupation: body.occupation as string,
          address: typeof body.address === 'string' ? body.address : undefined,
          phone: body.phone as string,
          email: invite.email,
          nationalIdNumber: body.nationalIdNumber as string,
          kraPin: body.kraPin as string,
        },
        overrideAccess: true,
      })

      // §6.2 "trainers are associated with that cohort ahead of their
      // contract (§6.4)" — a Draft contract stub is the concrete form that
      // association takes: it's the natural next step for admin (upload
      // terms, move to Sent) and Contract already models trainer+cohort.
      await req.payload.create({
        collection: 'contracts',
        data: { trainer: user.id, cohort: cohortId, status: 'draft' },
        overrideAccess: true,
      })
    }

    await req.payload.update({ collection: 'invites', id: invite.id, data: { status: 'used' }, overrideAccess: true })

    return Response.json(
      {
        message: 'Registration received. Your account is pending admin approval.',
        userId: user.id,
      },
      { status: 201 },
    )
  },
}

export const registerEndpoints: Endpoint[] = [lookupEndpoint, submitEndpoint]
