import Link from 'next/link'

export function SiteHeader({ isStaff }: { isStaff: boolean }) {
  return (
    <header className="border-b border-slate-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          She Delivers
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/talent-board" className="hover:text-brand-600">
            Talent Board
          </Link>
          <Link
            href="/admin"
            className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
          >
            {isStaff ? 'Admin panel' : 'Staff sign in'}
          </Link>
        </nav>
      </div>
    </header>
  )
}
