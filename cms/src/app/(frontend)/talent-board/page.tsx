import Link from 'next/link'
import { getPayload } from 'payload'
import type { Where } from 'payload'

import config from '@/payload.config'
import { PageShell } from '../components/PageShell'

// §6.9 public Talent Board — view-only. Fetched with overrideAccess:
// false and user: null so this page renders exactly what an anonymous
// visitor's own API request would see: opted-in AND graduated profiles
// only (readAccess in src/collections/Alumna.ts), same as
// everyone else — nothing here bypasses that.
export default async function TalentBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q = '', status = '' } = await searchParams
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Fetch the full public listing once to derive the set of employment
  // statuses to offer as filter options, since they're free text and not
  // a fixed enum on the Alumna collection.
  const { docs: allProfiles } = await payload.find({
    collection: 'alumnae',
    depth: 1,
    limit: 100,
    overrideAccess: false,
    user: null,
  })
  const statusOptions = Array.from(
    new Set(allProfiles.map((profile) => profile.employmentStatus).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b))

  const trimmedQuery = q.trim()
  const where: Where | undefined =
    trimmedQuery || status
      ? {
          and: [
            ...(trimmedQuery
              ? [
                  {
                    or: [
                      { name: { contains: trimmedQuery } },
                      { bio: { contains: trimmedQuery } },
                      { 'courses.name': { contains: trimmedQuery } },
                    ],
                  },
                ]
              : []),
            ...(status ? [{ employmentStatus: { equals: status } }] : []),
          ],
        }
      : undefined

  const { docs: profiles } = where
    ? await payload.find({
        collection: 'alumnae',
        depth: 1,
        limit: 100,
        overrideAccess: false,
        user: null,
        where,
      })
    : { docs: allProfiles }

  return (
    <PageShell>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Talent Board
      </h1>
      <p className="mt-2 max-w-xl text-slate-600">
        Graduates of the She Delivers program who have chosen to be listed here. This board is
        view-only — if you&rsquo;d like to connect with a graduate, please{' '}
        <a
          href={`mailto:${process.env.ADMIN_CONTACT_EMAIL || 'info@she-delivers.local'}`}
          className="text-brand-600 hover:underline"
        >
          contact us
        </a>{' '}
        rather than messaging them directly.
      </p>

      <form className="mt-6 flex flex-wrap gap-3" action="/talent-board">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name, skills, or courses"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {statusOptions.length > 0 && (
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All employment statuses</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Search
        </button>
        {(trimmedQuery || status) && (
          <Link
            href="/talent-board"
            className="self-center text-sm text-slate-500 hover:text-brand-600"
          >
            Clear filters
          </Link>
        )}
      </form>

      {profiles.length === 0 ? (
        <p className="mt-8 text-slate-500">
          {allProfiles.length === 0
            ? 'No graduates are listed yet.'
            : 'No graduates match your search.'}
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
          {profiles.map((profile) => {
            const photo = typeof profile.photo === 'object' ? profile.photo : null
            return (
              <Link
                key={profile.id}
                href={`/talent-board/${profile.id}`}
                className="block rounded-lg border border-slate-200 p-4 transition hover:border-brand-300 hover:shadow-sm"
              >
                {photo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={photo.alt || profile.name}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-md bg-slate-100" />
                )}
                <h2 className="mt-3 text-base font-semibold text-slate-900">{profile.name}</h2>
                {profile.employmentStatus && (
                  <p className="mt-1 text-sm text-slate-500">{profile.employmentStatus}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
