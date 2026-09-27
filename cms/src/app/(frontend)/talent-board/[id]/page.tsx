import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

// §6.9: public fields are photo, name, courses, work experience, and a
// narrative bio; email/phone are shown only when the alum chose to
// include them (each optional per listing). No messaging UI — employers
// contact admin, who acts as the intermediary.
export default async function TalentBoardProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const profile = await payload
    .findByID({
      collection: 'alumnae',
      id,
      depth: 1,
      overrideAccess: false,
      user: null,
      disableErrors: true,
    })
    .catch(() => null)

  if (!profile) {
    notFound()
  }

  const photo = typeof profile.photo === 'object' ? profile.photo : null
  const adminContact = process.env.ADMIN_CONTACT_EMAIL || 'info@she-delivers.local'

  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'sans-serif',
        background: '#fff',
        color: '#111',
        minHeight: '100vh',
      }}
    >
      <Link href="/talent-board">&larr; Back to Talent Board</Link>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginTop: '1.5rem' }}>
        {photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.alt || profile.name}
            style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 140, height: 140, borderRadius: 8, background: '#f0f0f0', flexShrink: 0 }} />
        )}
        <div>
          <h1 style={{ margin: 0 }}>{profile.name}</h1>
          {profile.employmentStatus && <p style={{ color: '#555', margin: '0.25rem 0' }}>{profile.employmentStatus}</p>}
          {(profile.email || profile.phone) && (
            <p style={{ color: '#555', fontSize: '0.9rem' }}>
              {[profile.email, profile.phone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {profile.bio && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>About</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{profile.bio}</p>
        </section>
      )}

      {profile.courses && profile.courses.length > 0 && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Courses & Certifications</h2>
          <ul>
            {profile.courses.map((course, i) => (
              <li key={i}>{course.name}</li>
            ))}
          </ul>
        </section>
      )}

      {profile.workExperience && profile.workExperience.length > 0 && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Work Experience</h2>
          <ul>
            {profile.workExperience.map((entry, i) => (
              <li key={i}>{entry.description}</li>
            ))}
          </ul>
        </section>
      )}

      <p style={{ marginTop: '2rem', color: '#555', fontSize: '0.9rem' }}>
        Interested in connecting with {profile.name}? This board is view-only —{' '}
        <a href={`mailto:${adminContact}`}>contact us</a> and we&rsquo;ll act as the go-between.
      </p>
    </main>
  )
}
