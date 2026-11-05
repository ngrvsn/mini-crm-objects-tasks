import type { AxiosResponse } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import {
  clearAccessToken,
  getAccessToken,
  getSessionEpoch,
  initializeSessionSync,
  login,
  publicApi,
  refreshAccessToken
} from './session'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
  clearAccessToken()
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
