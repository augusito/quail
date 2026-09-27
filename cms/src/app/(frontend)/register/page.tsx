'use client'

import { useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'
type Role = 'intern' | 'trainer'
type Invite = { cohortName?: string; email: string; role: Role; track: string | null }
type Education = { endDate: string; qualification: string; school: string; startDate: string }

const inputStyle: React.CSSProperties = { display: 'block', width: '100%' }
const fieldset: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.75rem' }

// §6.2 self-registration form (proposal v2). Reads the invite token from
// the URL (?token=... — the link logged by src/collections/Invites.ts),
// looks up the invite's role/email/cohort via GET /api/register?token=...
// (so it knows which field set to render before the person types
// anything), then posts the role-specific profile fields to
// POST /api/register (src/endpoints/register.ts), which does the real
// validation. Functional, not polished — same scope as the rest of this
// scaffold's frontend.
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

  const shell = (children: React.ReactNode) => (
    <main
      style={{
        maxWidth: 480,
        margin: '4rem auto',
        padding: '0 1rem',
        fontFamily: 'sans-serif',
        background: '#fff',
        color: '#111',
        minHeight: '100vh',
      }}
    >
      {children}
    </main>
  )

  if (!token) {
    return shell(
      <>
        <h1>Invalid invite link</h1>
        <p>This link is missing an invite token. Ask your program admin for a fresh invite link.</p>
      </>,
    )
  }

  if (lookupError) {
    return shell(
      <>
        <h1>Invalid invite link</h1>
        <p>{lookupError}</p>
      </>,
    )
  }

  if (status === 'success') {
    return shell(
      <>
        <h1>You&rsquo;re registered</h1>
        <p>{message}</p>
      </>,
    )
  }

  if (!invite) {
    return shell(<p>Loading invite…</p>)
  }

  return shell(
    <>
      <h1>Register as {invite.role === 'trainer' ? 'a Trainer' : 'an Intern'}</h1>
      <p style={{ color: '#555' }}>
        {invite.email}
        {invite.cohortName ? ` · ${invite.cohortName}` : ''}
        {invite.track ? ` · ${invite.track}` : ''}
      </p>
      <form onSubmit={handleSubmit} style={fieldset}>
        <label>
          Full name
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>

        {invite.role === 'trainer' ? (
          <label>
            Occupation
            <input
              type="text"
              required
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              style={inputStyle}
            />
          </label>
        ) : (
          <>
            <label>
              Date of birth
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              Gender
              <select required value={gender} onChange={(e) => setGender(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Nationality
              <input
                type="text"
                required
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                style={inputStyle}
              />
            </label>
          </>
        )}

        <label>
          Address
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
        </label>
        <label>
          Phone
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
        </label>
        <label>
          National ID / passport number
          <input
            type="text"
            required
            value={nationalIdNumber}
            onChange={(e) => setNationalIdNumber(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label>
          KRA PIN
          <input type="text" required value={kraPin} onChange={(e) => setKraPin(e.target.value)} style={inputStyle} />
        </label>

        {invite.role === 'intern' && (
          <>
            <label>
              SHIF number
              <input
                type="text"
                required
                value={shifNumber}
                onChange={(e) => setShifNumber(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              NSSF number
              <input
                type="text"
                required
                value={nssfNumber}
                onChange={(e) => setNssfNumber(e.target.value)}
                style={inputStyle}
              />
            </label>

            <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}>
              <legend>Next of kin</legend>
              <div style={fieldset}>
                <label>
                  Name
                  <input
                    type="text"
                    required
                    value={nextOfKinName}
                    onChange={(e) => setNextOfKinName(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label>
                  Relationship
                  <input
                    type="text"
                    required
                    value={nextOfKinRelationship}
                    onChange={(e) => setNextOfKinRelationship(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="tel"
                    required
                    value={nextOfKinPhone}
                    onChange={(e) => setNextOfKinPhone(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label>
                  Address
                  <input
                    type="text"
                    value={nextOfKinAddress}
                    onChange={(e) => setNextOfKinAddress(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={nextOfKinEmail}
                    onChange={(e) => setNextOfKinEmail(e.target.value)}
                    style={inputStyle}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem' }}>
              <legend>Education (optional)</legend>
              <div style={fieldset}>
                {education.map((row, index) => (
                  <div key={index} style={{ ...fieldset, borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="School"
                      value={row.school}
                      onChange={(e) => updateEducationRow(index, 'school', e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder="Qualification"
                      value={row.qualification}
                      onChange={(e) => updateEducationRow(index, 'qualification', e.target.value)}
                      style={inputStyle}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="date"
                        value={row.startDate}
                        onChange={(e) => updateEducationRow(index, 'startDate', e.target.value)}
                        style={inputStyle}
                      />
                      <input
                        type="date"
                        value={row.endDate}
                        onChange={(e) => updateEducationRow(index, 'endDate', e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <button type="button" onClick={() => removeEducationRow(index)}>
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addEducationRow}>
                  Add education
                </button>
              </div>
            </fieldset>
          </>
        )}

        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Submitting…' : 'Register'}
        </button>
        {status === 'error' && <p style={{ color: 'crimson' }}>{message}</p>}
      </form>
    </>,
  )
}
