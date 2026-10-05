'use client'

import { useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import { PageShell } from '../components/PageShell'

type Status = 'idle' | 'submitting' | 'success' | 'error'
type Role = 'intern' | 'trainer'
type Invite = { cohortName?: string; email: string; role: Role; track: string | null }

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
const errorInputClass = 'border-red-400 focus:border-red-500 focus:ring-red-500'
const labelClass = 'block text-sm font-medium text-slate-700'
const errorTextClass = 'mt-1 text-sm text-red-600'
const fieldsetClass = 'flex flex-col gap-4'

type Field = {
  key: string
  label: string
  type: 'text' | 'password' | 'tel' | 'email' | 'date' | 'select'
  required: boolean
  options?: { value: string; label: string }[]
  minLength?: number
}

const ACCOUNT_FIELDS: Field[] = [
  { key: 'name', label: 'Full name', type: 'text', required: true },
  { key: 'password', label: 'Password', type: 'password', required: true, minLength: 8 },
]

const TRAINER_PROFILE_FIELDS: Field[] = [
  { key: 'occupation', label: 'Occupation', type: 'text', required: true },
  { key: 'organization', label: 'Organization', type: 'text', required: false },
  { key: 'phone', label: 'Phone', type: 'tel', required: true },
  { key: 'address', label: 'Postal Address', type: 'text', required: false },
]

const INTERN_PERSONAL_FIELDS: Field[] = [
  { key: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true },
  { key: 'nationality', label: 'Nationality', type: 'text', required: true },
  { key: 'phone', label: 'Phone', type: 'tel', required: true },
  { key: 'address', label: 'Postal Address', type: 'text', required: false },
]

// National ID and KRA PIN apply to both roles; SHIF/NSSF only exist on the
// Intern profile (src/collections/Interns.ts) — trainers have no equivalent.
const TRAINER_IDENTIFICATION_FIELDS: Field[] = [
  { key: 'idNumber', label: 'ID Number', type: 'text', required: true },
  { key: 'kraPin', label: 'KRA PIN', type: 'text', required: true },
]

const INTERN_IDENTIFICATION_FIELDS: Field[] = [
  ...TRAINER_IDENTIFICATION_FIELDS,
  { key: 'shifNumber', label: 'SHIF number', type: 'text', required: true },
  { key: 'nssfNumber', label: 'NSSF number', type: 'text', required: true },
]

const NEXT_OF_KIN_FIELDS: Field[] = [
  { key: 'nextOfKinName', label: 'Name', type: 'text', required: true },
  { key: 'nextOfKinRelationship', label: 'Relationship', type: 'text', required: true },
  { key: 'nextOfKinPhone', label: 'Phone', type: 'tel', required: true },
  { key: 'nextOfKinAddress', label: 'Address', type: 'text', required: false },
  { key: 'nextOfKinEmail', label: 'Email', type: 'email', required: false },
]

type StepDef = { title: string; fields: Field[] }

function stepsForRole(role: Role): StepDef[] {
  if (role === 'trainer') {
    return [
      { title: 'Account', fields: ACCOUNT_FIELDS },
      { title: 'Profile', fields: TRAINER_PROFILE_FIELDS },
      { title: 'Identification', fields: TRAINER_IDENTIFICATION_FIELDS },
    ]
  }
  return [
    { title: 'Account', fields: ACCOUNT_FIELDS },
    { title: 'Personal details', fields: INTERN_PERSONAL_FIELDS },
    { title: 'Identification', fields: INTERN_IDENTIFICATION_FIELDS },
    { title: 'Next of kin', fields: NEXT_OF_KIN_FIELDS },
  ]
}

function fieldError(field: Field, value: string): string | null {
  if (field.required && value.trim() === '') return 'This field is required.'
  if (field.minLength && value.length > 0 && value.length < field.minLength) {
    return `Must be at least ${field.minLength} characters.`
  }
  return null
}

// §6.2 self-registration form (proposal v2), as a multi-step wizard. Reads
// the invite token from the URL (?token=... — the link logged by
// src/collections/Invites.ts), looks up the invite's role/email/cohort via
// GET /api/register?token=... (so it knows which field set to render before
// the person types anything), then posts the role-specific profile fields
// to POST /api/register (src/endpoints/register.ts), which does the real
// validation. The wizard's own per-step checks are a UX convenience only —
// the server-side checks remain the source of truth.
export default function RegisterPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [invite, setInvite] = useState<Invite | null>(null)
  const [lookupError, setLookupError] = useState('')

  const [values, setValues] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [stepIndex, setStepIndex] = useState(0)

  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`/api/register?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) {
          setLookupError(body?.error ?? 'This invite link is not valid.')
          return
        }
        setInvite(body)
      })
      .catch(() => setLookupError('Could not reach the server. Please try again.'))
  }, [token])

  const steps = useMemo(() => (invite ? stepsForRole(invite.role) : []), [invite])
  const reviewStepIndex = steps.length

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function errorsForStep(step: StepDef): Record<string, string> {
    const errors: Record<string, string> = {}
    for (const field of step.fields) {
      const error = fieldError(field, values[field.key] ?? '')
      if (error) errors[field.key] = error
    }
    return errors
  }

  function goNext() {
    const step = steps[stepIndex]
    if (!step) return
    const errors = errorsForStep(step)
    if (Object.keys(errors).length > 0) {
      setTouched((current) => ({
        ...current,
        ...Object.fromEntries(step.fields.map((field) => [field.key, true])),
      }))
      return
    }
    setStepIndex((index) => Math.min(index + 1, reviewStepIndex))
  }

  function goBack() {
    setStepIndex((index) => Math.max(index - 1, 0))
  }

  // Reached via the review step's Submit button, or the Enter key while
  // already on review — never from an earlier step (handleSubmit below
  // routes those to goNext instead). Keeping the submit button's `type`
  // fixed at "button" (see the Next/Submit button further down) avoids a
  // React/DOM gotcha: toggling a <button>'s `type` between "button" and
  // "submit" at the same position lets the browser's native click handling
  // observe the *new* type before this component's own click handler has
  // had a say, silently submitting the form a step early.
  async function submitRegistration() {
    if (!invite) return
    setStatus('submitting')
    setMessage('')

    const body: Record<string, unknown> =
      invite.role === 'intern'
        ? {
            token,
            password: values.password,
            name: values.name,
            dateOfBirth: values.dateOfBirth,
            nationality: values.nationality,
            address: values.address,
            phone: values.phone,
            idNumber: values.idNumber,
            kraPin: values.kraPin,
            shifNumber: values.shifNumber,
            nssfNumber: values.nssfNumber,
            nextOfKin: {
              name: values.nextOfKinName,
              relationship: values.nextOfKinRelationship,
              address: values.nextOfKinAddress,
              phone: values.nextOfKinPhone,
              email: values.nextOfKinEmail,
            },
          }
        : {
            token,
            password: values.password,
            name: values.name,
            occupation: values.occupation,
            organization: values.organization,
            address: values.address,
            phone: values.phone,
            idNumber: values.idNumber,
            kraPin: values.kraPin,
          }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const responseBody = await response.json()

      if (!response.ok) {
        setStatus('error')
        setMessage(responseBody?.error ?? 'Registration failed.')
        return
      }

      setStatus('success')
      setMessage(responseBody?.message ?? 'Registration received. Your account is pending admin approval.')
    } catch {
      setStatus('error')
      setMessage('Could not reach the server. Please try again.')
    }
  }

  // The Enter key still submits the <form> natively regardless of which
  // step is showing, so this is the only path Enter can take: advance like
  // Next on an earlier step, or submit for real once on review.
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (stepIndex !== reviewStepIndex) {
      goNext()
      return
    }
    void submitRegistration()
  }

  const shell = (children: React.ReactNode) => <PageShell narrow>{children}</PageShell>

  if (!token) {
    return shell(
      <>
        <h1 className="text-2xl font-bold text-slate-900">Invalid invite link</h1>
        <p className="mt-2 text-slate-600">
          This link is missing an invite token. Ask your program admin for a fresh invite link.
        </p>
      </>,
    )
  }

  if (lookupError) {
    return shell(
      <>
        <h1 className="text-2xl font-bold text-slate-900">Invalid invite link</h1>
        <p className="mt-2 text-slate-600">{lookupError}</p>
      </>,
    )
  }

  if (status === 'success') {
    return shell(
      <>
        <h1 className="text-2xl font-bold text-slate-900">You&rsquo;re registered</h1>
        <p className="mt-2 text-slate-600">{message}</p>
      </>,
    )
  }

  if (!invite) {
    return shell(<p className="text-slate-600">Loading invite…</p>)
  }

  const onReview = stepIndex === reviewStepIndex
  const currentStep = steps[stepIndex]

  function renderField(field: Field) {
    const value = values[field.key] ?? ''
    const error = touched[field.key] ? fieldError(field, value) : null
    const sharedProps = {
      id: field.key,
      required: field.required,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValue(field.key, e.target.value),
      onBlur: () => setTouched((current) => ({ ...current, [field.key]: true })),
      className: `${inputClass} ${error ? errorInputClass : ''}`,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${field.key}-error` : undefined,
    }

    return (
      <div key={field.key}>
        <label className={labelClass} htmlFor={field.key}>
          {field.label}
          {field.type === 'select' ? (
            <select {...sharedProps}>
              <option value="">Select…</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              minLength={field.minLength}
              {...sharedProps}
            />
          )}
        </label>
        {error && (
          <p id={`${field.key}-error`} className={errorTextClass}>
            {error}
          </p>
        )}
      </div>
    )
  }

  function fieldDisplayValue(field: Field): string {
    const value = values[field.key] ?? ''
    if (!value) return '—'
    if (field.type === 'password') return '•'.repeat(Math.min(value.length, 10))
    if (field.type === 'select') return field.options?.find((option) => option.value === value)?.label ?? value
    return value
  }

  return shell(
    <>
      <h1 className="text-2xl font-bold text-slate-900">
        Register as {invite.role === 'trainer' ? 'a Trainer' : 'an Intern'}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {invite.email}
        {invite.cohortName ? ` · ${invite.cohortName}` : ''}
        {invite.track ? ` · ${invite.track}` : ''}
      </p>

      <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Registration steps">
        {[...steps.map((step) => step.title), 'Review'].map((title, index) => {
          const isCurrent = index === stepIndex
          const isDone = index < stepIndex
          return (
            <li key={title} className="flex items-center gap-2">
              {index > 0 && <span className="text-slate-300">›</span>}
              <span
                className={
                  isCurrent
                    ? 'font-semibold text-brand-700'
                    : isDone
                      ? 'text-slate-500'
                      : 'text-slate-400'
                }
              >
                {index + 1}. {title}
              </span>
            </li>
          )
        })}
      </ol>

      <form onSubmit={handleSubmit} className={`${fieldsetClass} mt-6`}>
        {!onReview && currentStep && <div className={fieldsetClass}>{currentStep.fields.map(renderField)}</div>}

        {onReview && (
          <div className={fieldsetClass}>
            <p className="text-sm text-slate-600">Check your details before submitting.</p>
            {steps.map((step) => (
              <div key={step.title} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">{step.title}</h2>
                  <button
                    type="button"
                    onClick={() => setStepIndex(steps.indexOf(step))}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </button>
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                  {step.fields.map((field) => (
                    <div key={field.key} className="flex justify-between gap-2 sm:block">
                      <dt className="text-xs uppercase tracking-wide text-slate-400">{field.label}</dt>
                      <dd className="text-sm text-slate-700">{fieldDisplayValue(field)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || status === 'submitting'}
            className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Back
          </button>

          <button
            type="button"
            onClick={onReview ? () => void submitRegistration() : goNext}
            disabled={status === 'submitting'}
            className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {onReview ? (status === 'submitting' ? 'Submitting…' : 'Submit registration') : 'Next'}
          </button>
        </div>
        {status === 'error' && <p className="text-sm text-red-600">{message}</p>}
      </form>
    </>,
  )
}
