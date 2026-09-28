import { headers as getHeaders } from 'next/headers.js'
import React from 'react'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import './globals.css'

export const metadata = {
  description: 'She Delivers driver training program.',
  title: 'She Delivers',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader isStaff={Boolean(user)} />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  )
}
