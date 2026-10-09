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

    try {
      await payload.sendEmail({ to: invite.email, subject, text })
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
