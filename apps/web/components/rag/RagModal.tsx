'use client'

import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Brain,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  deleteDocument,
  deleteNamespace,
  getNamespaceStats,
  ingestUrl,
  listDocuments,
  uploadDocument,
  type RagDocument,
  type RagNamespaceStats,
} from '@/api/rag.api'
import { cn } from '@/lib/utils'

interface RagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function NamespaceStatsBar({ stats }: { stats: RagNamespaceStats }): JSX.Element {
  const pct = stats.docLimit > 0 ? Math.min(100, (stats.docCount / stats.docLimit) * 100) : 0
  const barColor = pct < 60 ? 'bg-success' : pct < 90 ? 'bg-amber-500' : 'bg-error'
  const dot =
    stats.status === 'active' ? 'bg-success' : stats.status === 'at_limit' ? 'animate-pulse bg-warning' : 'bg-muted'

  return (
    <div className="border-b border-divider px-6 py-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          <span className={cn('mr-1.5 inline-block h-2 w-2 rounded-full align-middle', dot)} />
          {stats.docCount} of {stats.docLimit} documents used
        </p>
        <span className="text-[11px] text-muted">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-divider">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DocRow({
  doc,
  onDelete,
}: {
  doc: RagDocument
  onDelete: (id: string) => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 border-b border-divider py-2 text-sm last:border-0">
      <FileText className="h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-heading">{doc.filename}</p>
        <p className="text-[11px] text-muted">{formatBytes(doc.fileSizeBytes)}</p>
      </div>
      {doc.status === 'indexed' ? (
        <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-medium text-success">Indexed</span>
      ) : null}
      {doc.status === 'processing' ? (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing…
        </span>
      ) : null}
      {doc.status === 'failed' ? (
        <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-medium text-error">Failed</span>
      ) : null}
      {doc.status === 'pending' ? (
        <span className="rounded-full bg-divider px-2 py-0.5 text-[10px] text-muted">Pending</span>
      ) : null}
      <button
        type="button"
        aria-label={`Delete ${doc.filename}`}
        className="rounded p-1 text-muted hover:bg-divider"
        onClick={() => onDelete(doc.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function RagModal({ open, onOpenChange }: RagModalProps): JSX.Element {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [queue, setQueue] = useState<File[]>([])
  const [uploadNote, setUploadNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [urlInput, setUrlInput] = useState('')
  const [urlQueue, setUrlQueue] = useState<string[]>([])
  const [urlNote, setUrlNote] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const [urlProgress, setUrlProgress] = useState({ current: 0, total: 0 })

  const statsQuery = useQuery({
    queryKey: ['rag-namespace'],
    queryFn: getNamespaceStats,
    enabled: open,
  })

  const docsQuery = useQuery({
    queryKey: ['rag-documents'],
    queryFn: listDocuments,
    enabled: open,
    refetchInterval: (query) => {
      const list = query.state.data as RagDocument[] | undefined
      if (!list?.length) return false
      return list.some((d) => d.status === 'processing' || d.status === 'pending') ? 3000 : false
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteDocument,
    onMutate: async (docId) => {
      await queryClient.cancelQueries({ queryKey: ['rag-documents'] })
      const prev = queryClient.getQueryData<RagDocument[]>(['rag-documents'])
      if (prev) {
        queryClient.setQueryData(
          ['rag-documents'],
          prev.filter((d) => d.id !== docId),
        )
      }
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['rag-documents'], ctx.prev)
      toast.error('Could not delete document')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['rag-documents'] })
      void queryClient.invalidateQueries({ queryKey: ['rag-namespace'] })
    },
  })

  const clearNsMut = useMutation({
    mutationFn: deleteNamespace,
    onSuccess: async () => {
      toast.success('AI Brain cleared')
      await queryClient.invalidateQueries({ queryKey: ['rag-documents'] })
      await queryClient.invalidateQueries({ queryKey: ['rag-namespace'] })
    },
    onError: () => toast.error('Could not clear namespace'),
  })

  const stats = statsQuery.data

  const addFiles = useCallback((files: FileList | File[]) => {
    setQueue((q) => [...q, ...Array.from(files)])
  }, [])

  const runUploads = async (): Promise<void> => {
    if (!queue.length) return
    setUploading(true)
    setUploadProgress({})
    let ok = 0
    for (const file of queue) {
      setUploadProgress((p) => ({ ...p, [file.name]: 10 }))
      try {
        await uploadDocument(file, uploadNote || undefined)
        setUploadProgress((p) => ({ ...p, [file.name]: 100 }))
        ok += 1
      } catch {
        setUploadProgress((p) => ({ ...p, [file.name]: 0 }))
        toast.error(`Upload failed: ${file.name}`)
      }
    }
    setQueue([])
    setUploadNote('')
    setUploading(false)
    await queryClient.invalidateQueries({ queryKey: ['rag-documents'] })
    await queryClient.invalidateQueries({ queryKey: ['rag-namespace'] })
    if (ok) toast.success(`Brain updated with ${ok} document${ok === 1 ? '' : 's'}`)
  }

  const runUrlIngest = async (): Promise<void> => {
    if (!urlQueue.length) return
    setUrlBusy(true)
    setUrlProgress({ current: 0, total: urlQueue.length })
    let ok = 0
    for (let i = 0; i < urlQueue.length; i += 1) {
      const url = urlQueue[i]!
      setUrlProgress({ current: i + 1, total: urlQueue.length })
      try {
        await ingestUrl(url, urlNote || undefined)
        ok += 1
      } catch {
        toast.error(`Ingest failed: ${url}`)
      }
    }
    setUrlQueue([])
    setUrlNote('')
    setUrlBusy(false)
    await queryClient.invalidateQueries({ queryKey: ['rag-documents'] })
    await queryClient.invalidateQueries({ queryKey: ['rag-namespace'] })
    if (ok) toast.success(`Queued ${ok} URL source${ok === 1 ? '' : 's'}`)
  }

  const docs = docsQuery.data ?? []

  const settingsSummary = useMemo(() => {
    if (!stats) return null
    return (
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-muted">Documents:</span>{' '}
          <span className="font-medium text-heading">
            {stats.docCount} / {stats.docLimit}
          </span>
        </p>
        <p>
          <span className="text-muted">Chunks:</span>{' '}
          <span className="font-medium text-heading">
            {stats.chunkCount} / {stats.chunkLimit}
          </span>
        </p>
        <p className="text-muted">
          Last indexed:{' '}
          <span className="text-heading">{stats.lastIndexedAt ? new Date(stats.lastIndexedAt).toLocaleString() : '—'}</span>
        </p>
        <p className="text-muted">
          Status:{' '}
          <span className="font-medium text-heading">
            {stats.status === 'active' ? 'Active' : stats.status === 'at_limit' ? 'At limit' : 'Empty'}
          </span>
        </p>
      </div>
    )
  }, [stats])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-divider bg-card p-0 shadow-xl focus:outline-none">
          <div className="flex items-start justify-between border-b border-divider px-6 py-4">
            <div>
              <Dialog.Title className="font-display text-lg text-heading">
                <Brain className="w-5 h-5 inline text-muted mr-1" /> My AI Brain
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Train the AI with your documents and URLs
              </Dialog.Description>
            </div>
            <Dialog.Close
              type="button"
              className="rounded-md p-1 text-muted hover:bg-divider"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {stats ? <NamespaceStatsBar stats={stats} /> : (
            <div className="border-b border-divider px-6 py-3">
              <div className="h-2 w-full animate-pulse rounded-full bg-divider" />
            </div>
          )}

          <Tabs.Root defaultValue="upload" className="px-0 pb-4 pt-2">
            <Tabs.List className="flex gap-2 border-b border-divider px-6">
              {(['upload', 'urls', 'settings'] as const).map((tab) => (
                <Tabs.Trigger
                  key={tab}
                  value={tab}
                  data-testid={`rag-tab-${tab}`}
                  className="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted data-[state=active]:border-brand data-[state=active]:text-heading"
                >
                  {tab === 'upload' ? 'Upload' : tab === 'urls' ? 'URLs' : 'Settings'}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="upload" className="px-6 pt-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onDragOver={(ev) => {
                  ev.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(ev) => {
                  ev.preventDefault()
                  setDragOver(false)
                  if (ev.dataTransfer.files?.length) addFiles(ev.dataTransfer.files)
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex min-h-[160px] w-full flex-col items-center justify-center rounded-card border border-dashed border-divider bg-bg px-4 py-8 text-center transition-colors',
                  dragOver && 'border-brand bg-brand/5',
                )}
              >
                <Upload className="mb-2 h-8 w-8 text-muted" />
                <p className="text-sm font-medium text-heading">Drag files here or click to browse</p>
                <p className="mt-1 text-xs text-muted">PDF · TXT · MD · DOCX · Max 20MB each</p>
              </button>

              {queue.length ? (
                <div className="mt-4 space-y-2">
                  {queue.map((f) => (
                    <div key={f.name} className="flex items-center gap-2 rounded-md border border-divider bg-card px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted">{formatBytes(f.size)}</span>
                      <button
                        type="button"
                        className="text-muted hover:text-heading"
                        onClick={() => setQueue((q) => q.filter((x) => x !== f))}
                        aria-label="Remove file"
                      >
                        ×
                      </button>
                      {uploadProgress[f.name] != null ? (
                        <div className="w-24">
                          <div className="h-1.5 overflow-hidden rounded-full bg-divider">
                            <div
                              className="h-full bg-brand transition-all"
                              style={{ width: `${uploadProgress[f.name]}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <label className="mt-2 block text-xs font-medium text-heading">Custom instructions (optional)</label>
                  <textarea
                    value={uploadNote}
                    onChange={(e) => setUploadNote(e.target.value)}
                    placeholder="Tell the AI how to use these docs..."
                    rows={4}
                    className="mt-1 w-full rounded-md border border-divider bg-bg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => void runUploads()}
                    className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-brand text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      'Upload & Train'
                    )}
                  </button>
                </div>
              ) : null}

              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Existing documents</p>
                <div className="max-h-[220px] overflow-y-auto rounded-card border border-divider bg-bg px-3">
                  {docsQuery.isLoading ? (
                    <p className="py-6 text-center text-sm text-muted">Loading…</p>
                  ) : docs.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">No documents yet</p>
                  ) : (
                    docs.map((doc) => (
                      <DocRow key={doc.id} doc={doc} onDelete={(id) => void deleteMut.mutateAsync(id)} />
                    ))
                  )}
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="urls" className="space-y-4 px-6 pt-4">
              <div className="flex gap-2">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/about"
                  className="h-10 flex-1 rounded-md border border-divider bg-bg px-3 text-sm"
                />
                <button
                  type="button"
                  className="h-10 shrink-0 rounded-md border border-brand px-3 text-sm font-medium text-brand hover:bg-brand/10"
                  onClick={() => {
                    const u = urlInput.trim()
                    if (!u) return
                    setUrlQueue((q) => [...q, u])
                    setUrlInput('')
                  }}
                >
                  + Add URL
                </button>
              </div>
              {urlQueue.length ? (
                <ul className="space-y-1 rounded-md border border-divider bg-bg p-2">
                  {urlQueue.map((u) => (
                    <li key={u} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-heading">{u}</span>
                      <button
                        type="button"
                        className="text-muted hover:text-heading"
                        onClick={() => setUrlQueue((q) => q.filter((x) => x !== u))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <textarea
                value={urlNote}
                onChange={(e) => setUrlNote(e.target.value)}
                placeholder="Custom instructions (optional)"
                rows={4}
                className="w-full rounded-md border border-divider bg-bg px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={urlBusy || !urlQueue.length}
                onClick={() => void runUrlIngest()}
                className="flex h-11 w-full items-center justify-center rounded-md bg-brand text-sm font-semibold text-white disabled:opacity-50"
              >
                {urlBusy ? `Ingesting ${urlProgress.current} of ${urlProgress.total}…` : 'Ingest All'}
              </button>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Crawling respects robots.txt. Private pages behind login cannot be ingested.
              </div>
            </Tabs.Content>

            <Tabs.Content value="settings" className="space-y-6 px-6 pt-4">
              {settingsSummary}
              <div className="rounded-md border border-error/40 bg-error/5 p-4">
                <p className="text-sm font-medium text-error">Danger zone</p>
                <AlertDialog.Root>
                  <AlertDialog.Trigger asChild>
                    <button
                      type="button"
                      className="mt-3 w-full rounded-md border border-error px-3 py-2 text-sm font-medium text-error hover:bg-error/10"
                    >
                      Delete All Documents
                    </button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Portal>
                    <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
                    <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-divider bg-card p-6 shadow-xl">
                      <AlertDialog.Title className="text-lg font-semibold text-heading">Delete all documents?</AlertDialog.Title>
                      <AlertDialog.Description className="mt-2 text-sm text-muted">
                        This will permanently delete all {stats?.docCount ?? docs.length} documents from your AI Brain. This cannot be
                        undone.
                      </AlertDialog.Description>
                      <div className="mt-6 flex justify-end gap-2">
                        <AlertDialog.Cancel className="rounded-md border border-divider px-3 py-2 text-sm">Cancel</AlertDialog.Cancel>
                        <AlertDialog.Action
                          className="rounded-md bg-error px-3 py-2 text-sm font-medium text-white"
                          onClick={() => void clearNsMut.mutateAsync()}
                        >
                          Delete everything
                        </AlertDialog.Action>
                      </div>
                    </AlertDialog.Content>
                  </AlertDialog.Portal>
                </AlertDialog.Root>
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
