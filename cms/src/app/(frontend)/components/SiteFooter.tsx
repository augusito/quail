export function SiteFooter() {
  const adminContact = process.env.ADMIN_CONTACT_EMAIL || 'info@she-delivers.local'

  return (
    <footer className="border-t border-slate-200">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-500 sm:px-6">
        <p>
          She Delivers driver training program ·{' '}
          <a href={`mailto:${adminContact}`} className="hover:text-brand-600">
            {adminContact}
          </a>
        </p>
        <p className="mt-1 text-xs tracking-wide text-slate-400 uppercase">
          A Pontypridd Holdings Initiative
        </p>
      </div>
    </footer>
  )
}
