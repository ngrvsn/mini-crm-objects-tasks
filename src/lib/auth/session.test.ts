import type { AxiosResponse } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import {
  clearAccessToken,
  getAccessToken,
  publicApi,
  refreshAccessToken
} from './session'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  clearAccessToken()
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
