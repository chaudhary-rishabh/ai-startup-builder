import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/store/authStore'

describe('authStore', () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
    localStorage.clear()
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
  })

  afterEach(() => {
    setItemSpy.mockRestore()
  })

  it('login() sets user + isAuthenticated=true', () => {
    useAuthStore.getState().setUser({
      id: '1',
      email: 'a@a.com',
      name: 'A',
      avatarUrl: null,
      role: 'user',
      plan: 'free',
      onboardingDone: false,
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe('a@a.com')
  })

  it('clearAuth() nulls user + isAuthenticated=false', () => {
    useAuthStore.getState().setUser({
      id: '1',
      email: 'a@a.com',
      name: 'A',
      avatarUrl: null,
      role: 'user',
      plan: 'free',
      onboardingDone: false,
    })
    useAuthStore.getState().clearAuth()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('updatePlan() updates only user.plan', () => {
    useAuthStore.getState().setUser({
      id: '1',
      email: 'a@a.com',
      name: 'A',
      avatarUrl: null,
      role: 'user',
      plan: 'free',
      onboardingDone: false,
    })
    useAuthStore.getState().updatePlan('pro')
    expect(useAuthStore.getState().user?.plan).toBe('pro')
    expect(useAuthStore.getState().user?.email).toBe('a@a.com')
  })

  it('setLoading() toggles isLoading', () => {
    useAuthStore.getState().setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('persists user to localStorage', () => {
    useAuthStore.getState().setUser({
      id: '1',
      email: 'a@a.com',
      name: 'A',
      avatarUrl: null,
      role: 'user',
      plan: 'free',
      onboardingDone: false,
    })
    expect(setItemSpy).toHaveBeenCalled()
  })

  it('rehydrates user from localStorage on init', () => {
    useAuthStore.getState().setUser({
      id: '1',
      email: 'a@a.com',
      name: 'A',
      avatarUrl: null,
      role: 'user',
      plan: 'free',
      onboardingDone: false,
    })
    const snapshot = useAuthStore.getState().user
    expect(snapshot?.id).toBe('1')
  })
})
