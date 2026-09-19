import Link from 'next/link'
import { getPayload } from 'payload'

import config from '@/payload.config'

// §6.9 public Talent Board — view-only. Fetched with overrideAccess:
// false and user: null so this page renders exactly what an anonymous
// visitor's own API request would see: opted-in AND graduated profiles
// only (readAccess in src/collections/AlumniProfiles.ts), same as
// everyone else — nothing here bypasses that.
export default async function TalentBoardPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const { docs: profiles } = await payload.find({
    collection: 'alumni-profiles',
    depth: 1,
    limit: 100,
    overrideAccess: false,
    user: null,
  })

  return (
    <main
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'sans-serif',
        background: '#fff',
        color: '#111',
        minHeight: '100vh',
      }}
    >
      <h1>Talent Board</h1>
      <p style={{ color: '#555', maxWidth: 640 }}>
        Graduates of the She Delivers program who have chosen to be listed here. This board is
        view-only — if you&rsquo;d like to connect with a graduate, please{' '}
        <a href={`mailto:${process.env.ADMIN_CONTACT_EMAIL || 'info@she-delivers.local'}`}>contact us</a>{' '}
        rather than messaging them directly.
      </p>

      {profiles.length === 0 ? (
        <p>No graduates are listed yet.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.25rem',
            marginTop: '1.5rem',
          }}
        >
          {profiles.map((profile) => {
            const photo = typeof profile.photo === 'object' ? profile.photo : null
            return (
              <Link
                key={profile.id}
                href={`/talent-board/${profile.id}`}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: '1rem',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                }}
              >
                {photo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={photo.alt || profile.name}
                    style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 6 }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: 6,
                      background: '#f0f0f0',
                    }}
                  />
                )}
                <h2 style={{ fontSize: '1.1rem', margin: '0.75rem 0 0.25rem' }}>{profile.name}</h2>
                {profile.employmentStatus && (
                  <p style={{ color: '#555', fontSize: '0.9rem', margin: 0 }}>{profile.employmentStatus}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
