export class MockEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  static instances: MockEventSource[] = []

  readyState = MockEventSource.OPEN
  listeners: Record<string, Array<(event: { data: string }) => void>> = {}
  withCredentials = false
  onerror: ((event: unknown) => void) | null = null
  onopen: (() => void) | null = null

  constructor(
    public url: string,
    options?: { withCredentials?: boolean },
  ) {
    this.withCredentials = Boolean(options?.withCredentials)
    MockEventSource.instances.push(this)
    queueMicrotask(() => this.onopen?.())
  }

  addEventListener(type: string, fn: (event: { data: string }) => void): void {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type]?.push(fn)
  }

  dispatchEvent(type: string, data: unknown): void {
    const payload = { data: JSON.stringify(data) }
    this.listeners[type]?.forEach((listener) => listener(payload))
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED
  }
}
