import Link from 'next/link'

export default function NotFoundPage(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <section className="text-center">
        <p className="text-[64px] leading-none">🚀</p>
        <h1 className="mt-4 font-display text-[32px] font-bold text-heading">404 — Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center rounded-md bg-brand px-5 text-sm font-semibold text-white"
        >
          ← Back to Dashboard
        </Link>
        <p className="mt-3 text-xs text-muted">If you believe this is an error, contact support.</p>
      </section>
    </main>
  )
}
