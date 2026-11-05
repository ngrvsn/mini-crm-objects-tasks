import axios, { isAxiosError } from 'axios'

export const publicApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000
})

type AccessResponse = { accessToken: string; expiresIn: number }
let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null
let sessionEpoch = 0
let channel: BroadcastChannel | null = null
const pendingKey = 'crm-logout-pending'

const inBrowser = () => typeof window !== 'undefined'
const isPending = () =>
  inBrowser() && window.localStorage.getItem(pendingKey) === '1'
const emit = (type: 'login' | 'logout') => {
  if (!inBrowser()) return
  window.dispatchEvent(new CustomEvent('crm-auth-change', { detail: type }))
  channel?.postMessage(type)
}

export const getAccessToken = () => accessToken

export function clearAccessToken(broadcast = false) {
  sessionEpoch += 1
  accessToken = null
  if (broadcast) emit('logout')
  else if (inBrowser())
    window.dispatchEvent(
      new CustomEvent('crm-auth-change', { detail: 'logout' })
    )
}

async function runRefresh(): Promise<string | null> {
  if (isPending()) return null
  const epoch = sessionEpoch
  const request = async () => {
    const { data } = await publicApi.post<AccessResponse>('/auth/refresh')
    if (epoch !== sessionEpoch || isPending()) return null
    accessToken = data.accessToken
    return accessToken
  }
  try {
    if (inBrowser() && 'locks' in navigator && navigator.locks) {
      return await navigator.locks.request('crm-refresh', request)
    }
    return await request()
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401)
      clearAccessToken()
    throw error
  }
}

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = runRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function bootstrapSession(): Promise<string | null> {
  if (isPending()) {
    try {
      await publicApi.post('/auth/logout')
      window.localStorage.removeItem(pendingKey)
    } catch {
      return null
    }
    return null
  }
  if (accessToken) return accessToken
  try {
    return await refreshAccessToken()
  } catch {
    return null
  }
}

export async function login(email: string, password: string): Promise<void> {
  const { data } = await publicApi.post<AccessResponse>('/auth/login', {
    email,
    password
  })
  if (inBrowser()) window.localStorage.removeItem(pendingKey)
  sessionEpoch += 1
  accessToken = data.accessToken
  emit('login')
}

export async function logout(): Promise<void> {
  if (inBrowser()) window.localStorage.setItem(pendingKey, '1')
  clearAccessToken(true)
  try {
    await publicApi.post('/auth/logout')
    if (inBrowser()) window.localStorage.removeItem(pendingKey)
  } catch {
    // Keep the pending marker so a later page load retries server revocation.
  }
}

export function initializeSessionSync(): () => void {
  if (!inBrowser()) return () => undefined
  if (!('BroadcastChannel' in window)) return () => undefined
  channel = new BroadcastChannel('crm-auth')
  const onMessage = async (event: MessageEvent<'login' | 'logout'>) => {
    if (event.data === 'logout') {
      clearAccessToken()
    } else if (event.data === 'login') {
      try {
        if (await refreshAccessToken()) {
          window.dispatchEvent(
            new CustomEvent('crm-auth-change', { detail: 'login' })
          )
        }
      } catch {
        // The current tab remains unauthenticated until the next interaction.
      }
    }
  }
  channel.addEventListener('message', onMessage)
  return () => {
    channel?.removeEventListener('message', onMessage)
    channel?.close()
    channel = null
  }
}
