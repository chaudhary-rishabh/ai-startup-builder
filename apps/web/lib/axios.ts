import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '',
  withCredentials: true,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

let isRefreshing = false
let refreshSubscribers: Array<() => void> = []

const notifyRefreshSubscribers = (): void => {
  for (const callback of refreshSubscribers) {
    callback()
  }
  refreshSubscribers = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryableAxiosRequestConfig | undefined
    const requestUrl = String(original?.url ?? '')
    const isAuthRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/verify-email')

    if (error.response?.status === 401 && original && !original._retry && !isAuthRequest) {
      original._retry = true

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push(() => {
            resolve(api(original))
          })
        })
      }

      isRefreshing = true
      try {
        await api.post('/auth/refresh')
        isRefreshing = false
        notifyRefreshSubscribers()
        return api(original)
      } catch (refreshError) {
        isRefreshing = false
        refreshSubscribers = []
        if (typeof window !== 'undefined') {
          window.location.href = '/?expired=1'
        }
        return Promise.reject(refreshError)
      }
    }

    const appError = {
      code: error.response?.data?.error?.code ?? 'NETWORK_ERROR',
      message: error.response?.data?.error?.message ?? error.message ?? 'An unexpected error occurred',
      status: error.response?.status ?? 0,
    }

    return Promise.reject(appError)
  },
)

export default api
