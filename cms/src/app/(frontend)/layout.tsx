import { headers as getHeaders } from 'next/headers.js'
import { Jost } from 'next/font/google'
import React from 'react'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import './globals.css'

const jost = Jost({
  subsets: ['latin'],
  variable: '--font-geo',
})

export const metadata = {
  description: 'She Delivers driver training program.',
  icons: {
    apple: '/apple-touch-icon.png',
    icon: '/favicon.ico',
  },
  title: 'She Delivers',
}

export const viewport = {
  themeColor: '#977591',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  return (
    <html lang="en" className={jost.variable}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader isStaff={Boolean(user)} />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  )
}
