import { CanceledError, type AxiosResponse } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import {
  clearAccessToken,
  getAccessToken,
  getSessionEpoch,
  initializeSessionSync,
  login,
  logout,
  publicApi,
  refreshAccessToken
} from './session'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
  clearAccessToken()
})

it('выход во время ожидающего входа не возвращает пользователя', async () => {
  let finishLogin: (value: AxiosResponse) => void = () => undefined
  let loginStarted: () => void = () => undefined
  const loginResponse = new Promise<AxiosResponse>((resolve) => {
    finishLogin = resolve
  })
  const requestSeen = new Promise<void>((resolve) => {
    loginStarted = resolve
  })
  vi.spyOn(publicApi, 'post').mockImplementation(async (url) => {
    if (url === '/auth/login') {
      loginStarted()
      return loginResponse
    }
    return { data: { ok: true } } as AxiosResponse
  })

  const pendingLogin = login('manager@example.test', 'password').catch(
    (error: unknown) => error
  )
  await requestSeen
  await logout()
  finishLogin({
    data: { accessToken: 'late-login-token', expiresIn: 3600 }
  } as AxiosResponse)
  expect(await pendingLogin).toBeInstanceOf(CanceledError)

  expect(getAccessToken()).toBeNull()
})

it('смена пользователя в другой вкладке сбрасывает старый токен', async () => {
  let receive: (event: MessageEvent<'login'>) => Promise<void> = async () =>
    undefined
  class TestChannel {
    addEventListener(
      _type: string,
      listener: (event: MessageEvent<'login'>) => Promise<void>
    ) {
      receive = listener
    }
    removeEventListener() {}
    postMessage() {}
    close() {}
  }
  vi.stubGlobal('BroadcastChannel', TestChannel)
  vi.spyOn(publicApi, 'post').mockImplementation(async (url) => ({
    data: {
      accessToken: url === '/auth/refresh' ? 'token-b' : 'token-a',
      expiresIn: 3600
    }
  }))
  const dispose = initializeSessionSync()
  try {
    await login('first@example.test', 'password')
    const oldEpoch = getSessionEpoch()
    expect(getAccessToken()).toBe('token-a')

    await receive({ data: 'login' } as MessageEvent<'login'>)

    expect(getSessionEpoch()).toBeGreaterThan(oldEpoch)
    expect(getAccessToken()).toBe('token-b')
  } finally {
    dispose()
  }
})

it('объединяет одновременные обновления access token в один запрос', async () => {
  const post = vi.spyOn(publicApi, 'post').mockResolvedValue({
    data: { accessToken: 'memory-only-token', expiresIn: 3600 }
  } as AxiosResponse)

  const results = await Promise.all([
    refreshAccessToken(),
    refreshAccessToken(),
    refreshAccessToken()
  ])

  expect(post).toHaveBeenCalledTimes(1)
  expect(results).toEqual([
    'memory-only-token',
    'memory-only-token',
    'memory-only-token'
  ])
  expect(getAccessToken()).toBe('memory-only-token')
  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
})
