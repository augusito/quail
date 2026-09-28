import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { PageShell } from '../../components/PageShell'

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
    <PageShell narrow>
      <Link href="/talent-board" className="text-sm text-brand-600 hover:underline">
        &larr; Back to Talent Board
      </Link>

      <div className="mt-6 flex items-start gap-6">
        {photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.alt || profile.name}
            className="h-35 w-35 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="h-35 w-35 shrink-0 rounded-lg bg-slate-100" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
          {profile.employmentStatus && (
            <p className="mt-1 text-slate-500">{profile.employmentStatus}</p>
          )}
          {(profile.email || profile.phone) && (
            <p className="mt-1 text-sm text-slate-500">
              {[profile.email, profile.phone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {profile.bio && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">About</h2>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{profile.bio}</p>
        </section>
      )}

      {profile.courses && profile.courses.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">Courses & Certifications</h2>
          <ul className="mt-1 list-inside list-disc text-slate-700">
            {profile.courses.map((course, i) => (
              <li key={i}>{course.name}</li>
            ))}
          </ul>
        </section>
      )}

      {profile.workExperience && profile.workExperience.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">Work Experience</h2>
          <ul className="mt-1 list-inside list-disc text-slate-700">
            {profile.workExperience.map((entry, i) => (
              <li key={i}>{entry.description}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-sm text-slate-500">
        Interested in connecting with {profile.name}? This board is view-only —{' '}
        <a href={`mailto:${adminContact}`} className="text-brand-600 hover:underline">
          contact us
        </a>{' '}
        and we&rsquo;ll act as the go-between.
      </p>
    </PageShell>
  )
}
