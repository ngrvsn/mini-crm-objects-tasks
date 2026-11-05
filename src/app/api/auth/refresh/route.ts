import { NextRequest } from 'next/server'
import { isAxiosError } from 'axios'
import {
  authError,
  checkOrigin,
  clearRefreshCookie,
  getRefreshToken,
  tokenRequest,
  tokenResponse
} from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) return authError(403, 'Invalid origin')
  const refreshToken = getRefreshToken(request)
  if (!refreshToken) return authError(401, 'No session')
  try {
    return tokenResponse(
      await tokenRequest('refresh_token', { refresh_token: refreshToken })
    )
  } catch (error) {
    if (
      isAxiosError(error) &&
      [400, 401].includes(error.response?.status ?? 0)
    ) {
      return clearRefreshCookie(authError(401, 'Session expired'))
    }
    return authError(503, 'Authentication is unavailable')
  }
}
