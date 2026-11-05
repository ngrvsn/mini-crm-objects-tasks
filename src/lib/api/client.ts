import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import {
  getAccessToken,
  publicApi,
  refreshAccessToken
} from '@/lib/auth/session'

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean }
const baseURL = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/rest/v1`
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''

export { publicApi }

export const privateApi = axios.create({
  baseURL,
  timeout: 10000,
  headers: { apikey: publishableKey }
})

privateApi.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (!token) throw new Error('Not authenticated')
  config.headers = AxiosHeaders.from(config.headers)
  config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

privateApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryConfig | undefined
    if (error.response?.status !== 401 || !original || original._retried) {
      return Promise.reject(error)
    }
    original._retried = true
    try {
      const token = await refreshAccessToken()
      if (!token) return Promise.reject(error)
      original.headers = AxiosHeaders.from(original.headers)
      original.headers.set('Authorization', `Bearer ${token}`)
      return privateApi.request(original)
    } catch {
      return Promise.reject(error)
    }
  }
)
