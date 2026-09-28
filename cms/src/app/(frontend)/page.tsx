import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { PageShell } from './components/PageShell'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  return (
    <PageShell>
      <div className="py-12 text-center sm:py-20">
        {user ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Welcome back, {user.email}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-slate-600">
              Head to the admin panel to manage cohorts, enrollments, and logbooks.
            </p>
            <Link
              href="/admin"
              className="mt-8 inline-block rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
            >
              Go to admin panel
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              She Delivers
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-slate-600">
              A driver training program helping women build careers in commercial driving. Browse
              our graduates, or sign in if you&rsquo;re part of the program.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href="/talent-board"
                className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
              >
                View Talent Board
              </Link>
              <Link
                href="/admin"
                className="rounded-md border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Staff sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
