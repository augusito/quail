import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import nodemailer from 'nodemailer'

// §7 "Integrations: outbound email (reminders, §6.3), needed before Phase 2
// go-live" / §10 "a built-in job queue plus an email adapter (Nodemailer/
// Resend/SendGrid)".
//
// With no SMTP_* env vars set, this deliberately does NOT fall back to
// nodemailer's built-in "create a live ethereal.email test account"
// behavior — that makes a real network call and a failed/blocked one would
// break `getPayload()` initialization for the whole app (including tests).
// Instead it uses nodemailer's `jsonTransport`, which never touches the
// network and just resolves with the composed message — good enough to
// prove the reminder pipeline actually sends, without depending on a mail
// server that doesn't exist yet. Built via `nodemailer.createTransport`
// directly (rather than the adapter's `transportOptions`, typed narrowly
// as SMTP-only) so jsonTransport type-checks.
const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true })

export const emailAdapter = nodemailerAdapter({
  defaultFromAddress: process.env.EMAIL_FROM || 'noreply@she-delivers.local',
  defaultFromName: 'She Delivers',
  skipVerify: !process.env.SMTP_HOST,
  transport,
})
