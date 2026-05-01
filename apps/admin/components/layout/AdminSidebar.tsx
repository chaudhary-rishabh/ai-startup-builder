'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Cpu,
  FolderOpen,
  Activity,
  Settings,
  FileText,
  LogOut,
  ChevronRight,
  Cog,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAdminAuthStore } from '@/store/adminAuthStore'
import { adminLogout } from '@/lib/api/auth.api'

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/billing', label: 'Billing', icon: CreditCard },
  { href: '/admin/ai-usage', label: 'AI Usage', icon: Cpu },
  { href: '/admin/projects', label: 'Projects', icon: FolderOpen },
  { href: '/admin/system', label: 'System', icon: Activity },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/audit', label: 'Audit Log', icon: FileText },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { admin, clearAuth } = useAdminAuthStore()

  const handleSignOut = async () => {
    try {
      await adminLogout()
    } catch {
      /* ignore */
    }
    clearAuth()
    router.replace('/admin/login')
  }

  const initials =
    admin?.name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? 'A'

  return (
    <aside
      data-testid="admin-sidebar"
      className="w-60 flex-shrink-0 flex flex-col border-r border-divider bg-sidebar min-h-screen sticky top-0"
    >
      <div className="h-16 flex items-center gap-3 px-5 border-b border-divider">
        <Cog className="w-5 h-5 text-muted" />
        <span className="font-display text-sm font-bold text-heading truncate">
          AI Startup Builder
        </span>
        <span className="ml-auto flex-shrink-0 text-[10px] font-bold text-white bg-error px-1.5 py-0.5 rounded-chip uppercase tracking-wide">
          ADMIN
        </span>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== '/admin/dashboard' && pathname.startsWith(`${href}/`))
          const testId = `nav-${label.toLowerCase().replace(/\s+/g, '-')}`
          return (
            <Link
              key={href}
              href={href}
              data-testid={testId}
              className={cn(
                'flex items-center gap-3 h-9 px-5 text-sm transition-colors',
                'relative group',
                isActive
                  ? 'bg-divider text-heading font-medium'
                  : 'text-brand hover:bg-divider/60 hover:text-heading',
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-0.5 bottom-0.5 w-[3px] bg-brand rounded-r-full" />
              )}
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {isActive && (
                <ChevronRight className="w-3 h-3 ml-auto text-muted" />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-divider p-4">
        <div className="flex items-center gap-3">
          {admin?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external avatar URLs
            <img
              src={admin.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-heading truncate">
              {admin?.name ?? 'Admin'}
            </p>
            <p className="text-[11px] text-muted truncate capitalize">
              {admin?.role?.replace('_', ' ') ?? 'admin'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            data-testid="sign-out-btn"
            title="Sign out"
            className="p-1.5 rounded-chip text-muted hover:text-error hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
