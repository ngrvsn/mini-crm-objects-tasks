import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { privateApi } from './client'
import { clearAccessToken, login, publicApi } from '@/lib/auth/session'

const originalAdapter = privateApi.defaults.adapter

afterEach(() => {
  privateApi.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
  window.localStorage.clear()
  clearAccessToken()
})

it('не повторяет старый запрос с токеном нового пользователя', async () => {
  let releaseFirst: () => void = () => undefined
  let firstStarted: () => void = () => undefined
  const holdFirst = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const firstRequest = new Promise<void>((resolve) => {
    firstStarted = resolve
  })
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    if (adapter.mock.calls.length === 1) {
      firstStarted()
      await holdFirst
      throw new AxiosError(
        'Unauthorized',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        {
          data: {},
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config
        }
      )
    }
    return {
      data: { id: 'replayed' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    }
  })
  privateApi.defaults.adapter = adapter

  let loginToken = 'token-a'
  vi.spyOn(publicApi, 'post').mockImplementation(async (url) => ({
    data: {
      accessToken: url === '/auth/refresh' ? 'token-b-refreshed' : loginToken,
      expiresIn: 3600
    }
  }))
  await login('first@example.test', 'password')
  const pending = privateApi
    .post('/rpc/create_object', { p_name: 'Old request' })
    .catch((error: unknown) => error)
  await firstRequest

  loginToken = 'token-b'
  await login('second@example.test', 'password')
  releaseFirst()

  expect(await pending).toBeInstanceOf(AxiosError)
  expect(adapter).toHaveBeenCalledTimes(1)
  expect(
    AxiosHeaders.from(adapter.mock.calls[0][0].headers).get('Authorization')
  ).toBe('Bearer token-a')
})
