'use client'

import { ShellLayout } from '@/components/layout/ShellLayout'
import { TokenBudgetBanner } from '@/components/common/TokenBudgetBanner'
import { useTokenBudget } from '@/hooks/useTokenBudget'

function AppLayoutInner({ children }: { children: React.ReactNode }): JSX.Element {
  useTokenBudget()
  return (
    <div className="flex min-h-screen flex-col">
      <TokenBudgetBanner />
      <ShellLayout>{children}</ShellLayout>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return <AppLayoutInner>{children}</AppLayoutInner>
}
