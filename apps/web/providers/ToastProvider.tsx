'use client'

import { useEffect, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { Toaster, toast } from 'sonner'

import { useUIStore } from '@/store/uiStore'

export function ToastProvider({ children }: PropsWithChildren): JSX.Element {
  const toasts = useUIStore((state) => state.toasts)
  const removeToast = useUIStore((state) => state.removeToast)
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const entry of toasts) {
      if (seenIds.current.has(entry.id)) {
        continue
      }
      seenIds.current.add(entry.id)
      toast(entry.title, {
        id: entry.id,
        description: entry.message,
        duration: entry.duration ?? 4000,
        onDismiss: () => {
          removeToast(entry.id)
          seenIds.current.delete(entry.id)
        },
      })
    }
  }, [toasts, removeToast])

  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            border: '1px solid #E8DFD0',
            borderRadius: '12px',
            color: '#5C4425',
          },
        }}
      />
    </>
  )
}
