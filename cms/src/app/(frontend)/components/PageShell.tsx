import React from 'react'

export function PageShell({
  children,
  narrow = false,
}: {
  children: React.ReactNode
  narrow?: boolean
}) {
  return (
    <main className={`mx-auto px-4 py-10 sm:px-6 ${narrow ? 'max-w-xl' : 'max-w-5xl'}`}>
      {children}
    </main>
  )
}
