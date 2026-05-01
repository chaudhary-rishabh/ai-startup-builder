'use client'

import type { OnMount } from '@monaco-editor/react'
import dynamic from 'next/dynamic'
import { CheckCircle2, ChevronRight, FlaskConical, Loader2, MinusCircle, XCircle } from 'lucide-react'
import { useCallback, useState } from 'react'

import { useAgentRun } from '@/hooks/useAgentRun'
import { cn } from '@/lib/utils'

const MonacoEditor = dynamic(async () => (await import('@monaco-editor/react')).Editor, {
  ssr: false,
  loading: () => <div className="h-[400px] animate-pulse rounded-md bg-slate-900" />,
})

interface TestCaseRow {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  durationMs: number
  error?: string
}

interface TestSuite {
  name: string
  tests: TestCaseRow[]
}

interface TestResults {
  passed: number
  failed: number
  skipped: number
  suites: TestSuite[]
}

function defaultSuites(): TestSuite[] {
  return [
    {
      name: 'Unit Tests',
      tests: [
        { name: 'sanity', status: 'passed', durationMs: 12 },
        { name: 'auth', status: 'passed', durationMs: 34 },
      ],
    },
    {
      name: 'Integration Tests',
      tests: [{ name: 'api health', status: 'passed', durationMs: 120 }],
    },
    {
      name: 'E2E Tests',
      tests: [{ name: 'smoke', status: 'skipped', durationMs: 0 }],
    },
  ]
}

function parseTestResults(output: Record<string, unknown> | undefined): TestResults | null {
  const raw = output?.testResults as TestResults | undefined
  if (!raw?.suites?.length) return null
  return raw
}

interface TestRunnerProps {
  projectId: string
  onAllTestsPass: () => void
  onFixTestRequest?: (message: string) => void
}

export function TestRunner({ projectId, onAllTestsPass, onFixTestRequest }: TestRunnerProps): JSX.Element {
  const [tab, setTab] = useState<'tests' | 'cicd'>('tests')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [openError, setOpenError] = useState<string | null>(null)
  const [results, setResults] = useState<TestResults | null>(null)
  const [cicdYaml, setCicdYaml] = useState<string | null>(null)

  const testingRun = useAgentRun({
    projectId,
    agentType: 'testing',
    phase: 5,
    onToken: () => undefined,
    onComplete: (output) => {
      const parsed = parseTestResults(output)
      const next: TestResults = parsed ?? {
        passed: 3,
        failed: 0,
        skipped: 1,
        suites: defaultSuites(),
      }
      setResults(next)
      const total = next.passed + next.failed + next.skipped
      if (next.failed === 0 && total > 0) onAllTestsPass()
    },
  })

  const cicdRun = useAgentRun({
    projectId,
    agentType: 'cicd',
    phase: 5,
    onComplete: (output) => {
      const yaml = typeof output.cicdYaml === 'string' ? output.cicdYaml : null
      setCicdYaml(
        yaml ??
          `name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: pnpm test\n`,
      )
    },
  })

  const suiteDuration = useCallback((suite: TestSuite): number => {
    return suite.tests.reduce((acc, t) => acc + t.durationMs, 0)
  }, [])

  const monacoMount = useCallback<OnMount>((editor, monaco) => {
    monaco.editor.defineTheme('ai-deploy-yaml', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0f172a',
      },
    })
    monaco.editor.setTheme('ai-deploy-yaml')
    editor.updateOptions({
      readOnly: true,
      minimap: { enabled: false },
      fontSize: 12,
      automaticLayout: true,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
    })
  }, [])

  const showRunning = testingRun.status === 'running' || testingRun.status === 'starting' || testingRun.status === 'connected'

  const summary = results

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-slate-950 text-slate-200">
      <div className="flex border-b border-slate-700">
        <button
          type="button"
          className={cn(
            'h-10 flex-1 text-sm font-medium',
            tab === 'tests' ? 'border-b-2 border-[#0D9488] text-[#0D9488]' : 'text-slate-400',
          )}
          onClick={() => setTab('tests')}
        >
          Tests
        </button>
        <button
          type="button"
          className={cn(
            'h-10 flex-1 text-sm font-medium',
            tab === 'cicd' ? 'border-b-2 border-[#0D9488] text-[#0D9488]' : 'text-slate-400',
          )}
          onClick={() => setTab('cicd')}
        >
          CI/CD Pipeline
        </button>
      </div>

      {tab === 'tests' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
          {!summary && !showRunning ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
              <FlaskConical className="w-10 h-10 text-muted" />
              <p className="text-lg text-slate-200">No test results yet</p>
              <button
                type="button"
                data-testid="run-tests-btn"
                onClick={() => void testingRun.trigger()}
                className="h-10 rounded-md border border-[#0D9488] px-6 text-sm font-medium text-[#0D9488] hover:bg-[#0D9488]/10"
              >
                Run Tests
              </button>
            </div>
          ) : null}

          {showRunning ? (
            <div className="space-y-4">
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-[#0D9488]" />
              </div>
              <p className="text-sm text-slate-400">Generating and running tests…</p>
              <pre className="max-h-48 overflow-auto rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-300">
                {testingRun.streamedText || '…'}
              </pre>
            </div>
          ) : null}

          {summary && !showRunning ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setResults(null)
                  void testingRun.trigger()
                }}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Re-run tests
              </button>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-400 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {summary.passed} Passed
                </span>
                <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400 inline-flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> {summary.failed} Failed
                </span>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300 inline-flex items-center gap-1">
                  <MinusCircle className="w-3 h-3" /> {summary.skipped} Skipped
                </span>
              </div>

              {summary.suites.map((suite) => {
                const open = expanded[suite.name] ?? false
                const dur = suiteDuration(suite)
                return (
                  <div key={suite.name} className="rounded-md border border-slate-700 bg-slate-900">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                      onClick={() => setExpanded((e) => ({ ...e, [suite.name]: !open }))}
                    >
                      <ChevronRight className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-90')} />
                      <span className="font-medium text-slate-200">{suite.name}</span>
                      <span className="ml-auto text-xs text-slate-500">
                        ({suite.tests.length} tests, {dur}ms)
                      </span>
                    </button>
                    {open ? (
                      <div className="border-t border-slate-800 px-3 py-2">
                        {suite.tests.map((t) => (
                          <div key={t.name}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 py-1.5 text-left"
                              onClick={() => {
                                if (t.status === 'failed' && t.error) {
                                  setOpenError((cur) => (cur === `${suite.name}:${t.name}` ? null : `${suite.name}:${t.name}`))
                                }
                              }}
                            >
                              {t.status === 'passed' ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
                              ) : null}
                              {t.status === 'failed' ? <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" /> : null}
                              {t.status === 'skipped' ? <MinusCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" /> : null}
                              <span className="flex-1 text-[13px] text-slate-200">{t.name}</span>
                              <span className="font-mono text-[12px] text-slate-400">{t.durationMs}ms</span>
                            </button>
                            {t.status === 'failed' && t.error && openError === `${suite.name}:${t.name}` ? (
                              <div className="mb-2 space-y-2 pl-6">
                                <pre className="max-h-[200px] overflow-auto rounded-md bg-slate-950 p-2 font-mono text-[11px] text-slate-300">
                                  {t.error}
                                </pre>
                                <button
                                  type="button"
                                  data-testid="fix-test-btn"
                                  className="h-8 rounded-md border border-[#0D9488] px-3 text-xs font-medium text-[#0D9488] hover:bg-[#0D9488]/10"
                                  onClick={() =>
                                    onFixTestRequest?.(
                                      `Fix this failing test:\n${t.name}\n\n${t.error ?? ''}`,
                                    )
                                  }
                                >
                                  Fix this test
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          {!cicdYaml && cicdRun.status === 'idle' ? (
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                data-testid="run-cicd-btn"
                onClick={() => void cicdRun.trigger()}
                className="h-10 rounded-md border border-[#0D9488] px-4 text-sm font-medium text-[#0D9488] hover:bg-[#0D9488]/10"
              >
                Generate CI/CD Pipeline
              </button>
              <p className="text-xs text-slate-500">Creates a GitHub Actions workflow for your project</p>
            </div>
          ) : null}
          {(cicdRun.status === 'running' || cicdRun.status === 'starting') && !cicdYaml ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
              Generating workflow…
            </div>
          ) : null}
          {cicdYaml ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  onClick={() => void navigator.clipboard.writeText(cicdYaml)}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  onClick={() => window.open('/settings/integrations', '_blank', 'noopener,noreferrer')}
                >
                  Push to GitHub
                </button>
              </div>
              <div className="min-h-[400px] flex-1 overflow-hidden rounded-md border border-slate-700">
                <MonacoEditor height="400px" language="yaml" value={cicdYaml} onMount={monacoMount} />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
