import axios, { isAxiosError } from 'axios'

export const publicApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000
})

type AccessResponse = { accessToken: string; expiresIn: number }
let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null
let refreshController: AbortController | null = null
let sessionEpoch = 0
let channel: BroadcastChannel | null = null
const pendingKey = 'crm-logout-pending'

const inBrowser = () => typeof window !== 'undefined'
const isPending = () =>
  inBrowser() && window.localStorage.getItem(pendingKey) === '1'
const withRefreshLock = async <T>(request: () => Promise<T>): Promise<T> => {
  if (inBrowser() && 'locks' in navigator && navigator.locks) {
    return navigator.locks.request('crm-refresh', request)
  }
  return request()
}
const emit = (type: 'login' | 'logout') => {
  if (!inBrowser()) return
  window.dispatchEvent(new CustomEvent('crm-auth-change', { detail: type }))
  channel?.postMessage(type)
}

export const getAccessToken = () => accessToken
export const getSessionEpoch = () => sessionEpoch

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
    if (epoch !== sessionEpoch || isPending()) return null
    const controller = new AbortController()
    refreshController = controller
    try {
      const { data } = await publicApi.post<AccessResponse>(
        '/auth/refresh',
        undefined,
        { signal: controller.signal }
      )
      if (epoch !== sessionEpoch || isPending()) return null
      accessToken = data.accessToken
      return accessToken
    } finally {
      if (refreshController === controller) refreshController = null
    }
  }
  try {
    return await withRefreshLock(request)
  } catch (error) {
    // A refresh started before a new login cannot invalidate that login.
    if (
      epoch === sessionEpoch &&
      isAxiosError(error) &&
      error.response?.status === 401
    )
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
    const epoch = sessionEpoch
    try {
      await withRefreshLock(async () => {
        if (epoch !== sessionEpoch || !isPending()) return
        await publicApi.post('/auth/logout')
        if (epoch === sessionEpoch && isPending())
          window.localStorage.removeItem(pendingKey)
      })
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
  // A delayed refresh response must not restore the previous user's cookie.
  refreshController?.abort()
  const { data } = await withRefreshLock(() =>
    publicApi.post<AccessResponse>('/auth/login', { email, password })
  )
  if (inBrowser()) window.localStorage.removeItem(pendingKey)
  sessionEpoch += 1
  accessToken = data.accessToken
  emit('login')
}

export async function logout(): Promise<void> {
  if (inBrowser()) window.localStorage.setItem(pendingKey, '1')
  clearAccessToken(true)
  const epoch = sessionEpoch
  try {
    await withRefreshLock(async () => {
      if (epoch !== sessionEpoch || !isPending()) return
      await publicApi.post('/auth/logout')
      if (epoch === sessionEpoch && isPending())
        window.localStorage.removeItem(pendingKey)
    })
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
      // A different tab may have replaced the shared refresh cookie and user.
      sessionEpoch += 1
      const epoch = sessionEpoch
      accessToken = null
      window.dispatchEvent(
        new CustomEvent('crm-auth-change', { detail: 'syncing' })
      )
      try {
        await refreshPromise?.catch(() => null)
        if (epoch !== sessionEpoch) return
        if (await refreshAccessToken()) {
          if (epoch !== sessionEpoch) return
          window.dispatchEvent(
            new CustomEvent('crm-auth-change', { detail: 'login' })
          )
        } else if (epoch === sessionEpoch) {
          window.dispatchEvent(
            new CustomEvent('crm-auth-change', { detail: 'logout' })
          )
        }
      } catch {
        if (epoch === sessionEpoch)
          window.dispatchEvent(
            new CustomEvent('crm-auth-change', { detail: 'logout' })
          )
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
