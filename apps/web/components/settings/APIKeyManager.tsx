'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { createApiKey, listApiKeys, revokeApiKey, type ApiKey } from '@/api/user.api'
import * as AlertDialog from '@radix-ui/react-alert-dialog'

export function APIKeyManager(): JSX.Element {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [reveal, setReveal] = useState<{ secret: string; prefix: string } | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  const keysQuery = useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys,
  })

  const createMut = useMutation({
    mutationFn: () => createApiKey(name.trim() || 'API Key'),
    onSuccess: (data) => {
      setReveal({ secret: data.secret, prefix: data.prefix })
      setName('')
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: () => toast.error('Could not create key'),
  })

  const revokeMut = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      setRevokeId(null)
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('Key revoked')
    },
    onError: () => toast.error('Could not revoke key'),
  })

  const keys = keysQuery.data ?? []

  return (
    <section className="border-t border-divider pt-10">
      <h2 className="font-display text-xl text-heading">API Keys</h2>
      <p className="mt-1 text-sm text-muted">Use these keys to access the AI Startup Builder API.</p>

      <div className="mt-6 overflow-hidden rounded-card border border-divider">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Prefix</th>
              <th className="px-4 py-2">Last Used</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k: ApiKey) => (
              <tr key={k.id} className="border-t border-divider">
                <td className="px-4 py-2 text-heading">{k.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{k.prefix}…</td>
                <td className="px-4 py-2 text-xs text-muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-2 text-xs text-muted">{new Date(k.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  <button type="button" className="text-xs text-error hover:underline" onClick={() => setRevokeId(k.id)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted">Key name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My API Key"
            className="mt-1 h-10 w-full rounded-md border border-divider bg-bg px-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => createMut.mutate()}
          className="h-10 rounded-md border border-brand px-4 text-sm font-medium text-brand hover:bg-brand/10"
        >
          Create Key
        </button>
      </div>

      <Dialog.Root open={Boolean(reveal)} onOpenChange={(open: boolean) => !open && setReveal(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-divider bg-card p-6 shadow-xl"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <Dialog.Title className="text-lg font-semibold text-heading">Save your API key</Dialog.Title>
            <p className="mt-2 text-sm text-error">Copy this now — you won&apos;t see it again</p>
            {reveal ? (
              <div className="mt-4 flex items-start gap-2 rounded-md bg-bg p-3 font-mono text-xs text-heading">
                <code className="flex-1 break-all">{reveal.secret}</code>
                <button
                  type="button"
                  className="shrink-0 rounded border border-divider p-1"
                  aria-label="Copy key"
                  onClick={() => void navigator.clipboard.writeText(reveal.secret).then(() => toast.success('Copied'))}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="mt-6 h-10 w-full rounded-md bg-brand text-sm font-semibold text-white"
              onClick={() => setReveal(null)}
            >
              I&apos;ve saved my key
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root open={Boolean(revokeId)} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(400px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-divider bg-card p-6 shadow-lg">
            <AlertDialog.Title className="text-heading">Revoke API key?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted">This key will stop working immediately.</AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialog.Cancel className="rounded-md border border-divider px-3 py-2 text-sm">Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                className="rounded-md bg-error px-3 py-2 text-sm font-medium text-white"
                onClick={() => revokeId && revokeMut.mutate(revokeId)}
              >
                Revoke
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  )
}
