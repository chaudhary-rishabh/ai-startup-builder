import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: '#5C4425' }}
    >
      <p className="text-8xl mb-6">⚙️</p>
      <h1 className="font-display text-4xl text-white mb-3">404</h1>
      <p className="text-brand-light mb-8">This admin page does not exist.</p>
      <Link
        href="/admin/dashboard"
        className="px-6 py-3 bg-white text-heading rounded-card text-sm font-semibold hover:bg-bg transition-colors"
      >
        ← Back to Dashboard
      </Link>
    </div>
  )
}
