'use client'

import { useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { PageShell } from '../components/PageShell'

type Status = 'idle' | 'submitting' | 'success' | 'error'
type Role = 'intern' | 'trainer'
type Invite = { cohortName?: string; email: string; role: Role; track: string | null }
type Education = { endDate: string; qualification: string; school: string; startDate: string }

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
const labelClass = 'block text-sm font-medium text-slate-700'
const fieldsetClass = 'flex flex-col gap-4'

// §6.2 self-registration form (proposal v2). Reads the invite token from
// the URL (?token=... — the link logged by src/collections/Invites.ts),
// looks up the invite's role/email/cohort via GET /api/register?token=...
// (so it knows which field set to render before the person types
// anything), then posts the role-specific profile fields to
// POST /api/register (src/endpoints/register.ts), which does the real
// validation.
export default function RegisterPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [invite, setInvite] = useState<Invite | null>(null)
  const [lookupError, setLookupError] = useState('')

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [nationalIdNumber, setNationalIdNumber] = useState('')
  const [kraPin, setKraPin] = useState('')
  // Trainer-only
  const [occupation, setOccupation] = useState('')
  // Intern-only
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [nationality, setNationality] = useState('')
  const [shifNumber, setShifNumber] = useState('')
  const [nssfNumber, setNssfNumber] = useState('')
  const [nextOfKinName, setNextOfKinName] = useState('')
  const [nextOfKinRelationship, setNextOfKinRelationship] = useState('')
  const [nextOfKinAddress, setNextOfKinAddress] = useState('')
  const [nextOfKinPhone, setNextOfKinPhone] = useState('')
  const [nextOfKinEmail, setNextOfKinEmail] = useState('')
  const [education, setEducation] = useState<Education[]>([])

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

  function addEducationRow() {
    setEducation((rows) => [...rows, { school: '', startDate: '', endDate: '', qualification: '' }])
  }

  function updateEducationRow(index: number, field: keyof Education, value: string) {
    setEducation((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function removeEducationRow(index: number) {
    setEducation((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!invite) return
    setStatus('submitting')
    setMessage('')

    const body: Record<string, unknown> =
      invite.role === 'intern'
        ? {
            token,
            password,
            name,
            dateOfBirth,
            gender,
            nationality,
            address,
            phone,
            nationalIdNumber,
            kraPin,
            shifNumber,
            nssfNumber,
            nextOfKin: {
              name: nextOfKinName,
              relationship: nextOfKinRelationship,
              address: nextOfKinAddress,
              phone: nextOfKinPhone,
              email: nextOfKinEmail,
            },
            education: education.filter((row) => row.school && row.qualification),
          }
        : { token, password, name, occupation, address, phone, nationalIdNumber, kraPin }

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
      <form onSubmit={handleSubmit} className={`${fieldsetClass} mt-6`}>
        <label className={labelClass}>
          Full name
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {invite.role === 'trainer' ? (
          <label className={labelClass}>
            Occupation
            <input
              type="text"
              required
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className={inputClass}
            />
          </label>
        ) : (
          <>
            <label className={labelClass}>
              Date of birth
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Gender
              <select
                required
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className={inputClass}
              >
                <option value="">Select…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className={labelClass}>
              Nationality
              <input
                type="text"
                required
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className={inputClass}
              />
            </label>
          </>
        )}

        <label className={labelClass}>
          Address
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Phone
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          National ID / passport number
          <input
            type="text"
            required
            value={nationalIdNumber}
            onChange={(e) => setNationalIdNumber(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          KRA PIN
          <input
            type="text"
            required
            value={kraPin}
            onChange={(e) => setKraPin(e.target.value)}
            className={inputClass}
          />
        </label>

        {invite.role === 'intern' && (
          <>
            <label className={labelClass}>
              SHIF number
              <input
                type="text"
                required
                value={shifNumber}
                onChange={(e) => setShifNumber(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              NSSF number
              <input
                type="text"
                required
                value={nssfNumber}
                onChange={(e) => setNssfNumber(e.target.value)}
                className={inputClass}
              />
            </label>

            <fieldset className="rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-sm font-medium text-slate-700">Next of kin</legend>
              <div className={fieldsetClass}>
                <label className={labelClass}>
                  Name
                  <input
                    type="text"
                    required
                    value={nextOfKinName}
                    onChange={(e) => setNextOfKinName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Relationship
                  <input
                    type="text"
                    required
                    value={nextOfKinRelationship}
                    onChange={(e) => setNextOfKinRelationship(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Phone
                  <input
                    type="tel"
                    required
                    value={nextOfKinPhone}
                    onChange={(e) => setNextOfKinPhone(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Address
                  <input
                    type="text"
                    value={nextOfKinAddress}
                    onChange={(e) => setNextOfKinAddress(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Email
                  <input
                    type="email"
                    value={nextOfKinEmail}
                    onChange={(e) => setNextOfKinEmail(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-sm font-medium text-slate-700">Education (optional)</legend>
              <div className={fieldsetClass}>
                {education.map((row, index) => (
                  <div key={index} className={`${fieldsetClass} border-b border-slate-100 pb-3`}>
                    <input
                      type="text"
                      placeholder="School"
                      value={row.school}
                      onChange={(e) => updateEducationRow(index, 'school', e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      placeholder="Qualification"
                      value={row.qualification}
                      onChange={(e) => updateEducationRow(index, 'qualification', e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={row.startDate}
                        onChange={(e) => updateEducationRow(index, 'startDate', e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="date"
                        value={row.endDate}
                        onChange={(e) => updateEducationRow(index, 'endDate', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEducationRow(index)}
                      className="self-start text-sm text-slate-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEducationRow}
                  className="self-start text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Add education
                </button>
              </div>
            </fieldset>
          </>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="mt-2 rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {status === 'submitting' ? 'Submitting…' : 'Register'}
        </button>
        {status === 'error' && <p className="text-sm text-red-600">{message}</p>}
      </form>
    </>,
  )
}
