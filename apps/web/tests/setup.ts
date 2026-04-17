import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { server } from './mocks/server'
import { useUIStore } from '@/store/uiStore'
import { MockEventSource } from './mocks/mockEventSource'

if (!globalThis.localStorage) {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key)
      }),
      clear: vi.fn(() => storage.clear()),
    },
  })
}

if (!globalThis.sessionStorage) {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key)
      }),
      clear: vi.fn(() => storage.clear()),
    },
  })
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
})

Object.defineProperty(globalThis, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(globalThis, 'EventSource', {
  writable: true,
  value: MockEventSource,
})

Object.defineProperty(globalThis.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
})

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  MockEventSource.instances = []
  useUIStore.setState({
    sidebarCollapsed: false,
    contextPanelOpen: false,
    toasts: [],
    tokenWarning: null,
  })
})
