import type { TaskConfig } from 'payload'

type Input = {
  inviteId: number
}

type Output = {
  sent: boolean
}

const TRACK_LABELS: Record<string, string> = {
  'truck-driving': 'Truck Driving',
  mechanics: 'Automotive Mechanics',
  ict: 'ICT',
  'supply-chain': 'Supply Chain',
  'business-management': 'Business Management',
}

// Queued (rather than sent inline from Invites.ts's afterChange hook) for
// the same reason sendSessionReminder is: a slow or unreachable mail
// provider must never block the admin's request that created the invite,
// and retries are Payload's job-queue retry rather than hand-rolled.
export const sendInviteEmailTask: TaskConfig<{ input: Input; output: Output }> = {
  slug: 'sendInviteEmail',
  label: 'Send invite email',
  inputSchema: [{ name: 'inviteId', type: 'number', required: true }],
  outputSchema: [{ name: 'sent', type: 'checkbox' }],
  retries: 2,
  handler: async ({ input, req }) => {
    const { payload } = req

    const invite = await payload.findByID({
      collection: 'invites',
      id: input.inviteId,
      depth: 0,
      overrideAccess: true,
    })
    if (!invite || invite.status !== 'sent') {
      // Already used/revoked/expired by the time this ran, or deleted —
      // nothing to send.
      return { output: { sent: false } }
    }

    const baseUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const link = `${baseUrl}/register?token=${invite.token}`
    const roleLabel = invite.role === 'intern' ? 'intern' : 'trainer'
    const trackLine = invite.track ? ` for the ${TRACK_LABELS[invite.track] ?? invite.track} track` : ''

    const subject = "You're invited to register with She Delivers"
    const text = `You've been invited to register as a ${roleLabel}${trackLine}.\n\nComplete your registration here: ${link}\n\nThis link expires 24 hours after it was issued. If you weren't expecting this invite, you can ignore this email.`

    // TEMPORARY — remove this whole block once SMTP2GO delivery is
    // confirmed working in production. The adapter (@payloadcms/email-
    // nodemailer) composes the From header as `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`
    // — logging the raw env values here catches a value like
    // "<foo@example.com>" that already has its own angle brackets, which
    // produces a malformed "Name <<foo@example.com>>" header that SMTP2GO
    // (or any strict SMTP server) will reject.
    payload.logger.info(
      `[invite][debug] EMAIL_FROM=${JSON.stringify(process.env.EMAIL_FROM)} EMAIL_FROM_NAME=${JSON.stringify(process.env.EMAIL_FROM_NAME)} SMTP_HOST=${process.env.SMTP_HOST ?? '(unset — jsonTransport, nothing is actually sent)'}`,
    )

    try {
      // Also logs on success, with nodemailer's own response — "the job
      // ran without throwing" doesn't tell us whether SMTP2GO actually
      // accepted and queued the message for delivery.
      const info = (await payload.sendEmail({ to: invite.email, subject, text })) as {
        accepted?: unknown
        messageId?: unknown
        rejected?: unknown
        response?: unknown
      }
      payload.logger.info(
        `[invite][debug] sent invite id=${invite.id} email=${invite.email} smtpResponse=${JSON.stringify(
          { accepted: info?.accepted, rejected: info?.rejected, response: info?.response, messageId: info?.messageId },
        )}`,
      )
      return { output: { sent: true } }
    } catch (err) {
      // Logged with enough context to find and re-send manually (the
      // link itself is still in this message) — never thrown onward, since
      // a mail-provider failure must not fail the job in a way that blocks
      // or retries indefinitely against a provider that's simply down. The
      // 2 retries above already cover a transient failure.
      payload.logger.error(
        `[invite] failed to email invite id=${invite.id} email=${invite.email}: ${err instanceof Error ? err.message : String(err)} — link=${link}`,
      )
      return { output: { sent: false } }
    }
  },
}
