import { APIError, type Endpoint } from 'payload'

/**
 * §6.2 self-registration: the public, unauthenticated counterpart to the
 * admin-only Invites collection. A client posts the invite token plus
 * their account details; this validates the token (exists, not revoked,
 * not expired) and — only then — creates the User (role: intern, status:
 * pending-approval) and auto-enrolls them in the invite's cohort/track,
 * as one atomic-ish server-side action the client can't otherwise perform
 * (Users.create and Enrollments.create are both admin-only; this endpoint
 * uses overrideAccess to do both on the registrant's behalf).
 *
 * role/status are always hardcoded here, never read from the request body
 * — a registrant cannot self-assign a role or skip the pending-approval
 * step by sending extra fields.
 */
export const registerEndpoint: Endpoint = {
  path: '/register',
  method: 'post',
  handler: async (req) => {
    let body: Record<string, unknown>
    try {
      body = ((await req.json?.()) as Record<string, unknown>) ?? {}
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const { token, email, password, name } = body
    if (typeof token !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return Response.json({ error: 'token, email and password are required.' }, { status: 400 })
    }

    const invites = await req.payload.find({
      collection: 'invites',
      where: { token: { equals: token } },
      limit: 1,
      overrideAccess: true,
    })
    const invite = invites.docs[0]

    if (!invite) {
      return Response.json({ error: 'This invite link is not valid.' }, { status: 404 })
    }
    if (invite.revoked) {
      return Response.json({ error: 'This invite link has been revoked.' }, { status: 410 })
    }
    if (!invite.expiresAt || new Date(invite.expiresAt) < new Date()) {
      return Response.json({ error: 'This invite link has expired.' }, { status: 410 })
    }

    let user
    try {
      user = await req.payload.create({
        collection: 'users',
        data: {
          email,
          password,
          name: typeof name === 'string' ? name : undefined,
          role: 'intern',
          status: 'pending',
        },
        overrideAccess: true,
      })
    } catch (err) {
      const message = err instanceof APIError ? err.message : 'Could not create account.'
      return Response.json({ error: message }, { status: 400 })
    }

    const cohortId = typeof invite.cohort === 'object' ? invite.cohort.id : invite.cohort
    await req.payload.create({
      collection: 'enrollments',
      data: {
        intern: user.id,
        cohort: cohortId,
        track: invite.track,
        outcome: 'in-progress',
      },
      overrideAccess: true,
    })

    return Response.json(
      {
        message: 'Registration received. Your account is pending admin approval.',
        userId: user.id,
      },
      { status: 201 },
    )
  },
}
