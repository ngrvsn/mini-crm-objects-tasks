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
  if (!checkOrigin(request))
    return authError(403, 'Недопустимый источник запроса')
  const refreshToken = getRefreshToken(request)
  if (!refreshToken) return authError(401, 'Нет активной сессии')
  try {
    return tokenResponse(
      await tokenRequest('refresh_token', { refresh_token: refreshToken })
    )
  } catch (error) {
    if (
      isAxiosError(error) &&
      [400, 401].includes(error.response?.status ?? 0)
    ) {
      return clearRefreshCookie(authError(401, 'Сессия истекла'))
    }
    return authError(503, 'Сервис входа временно недоступен')
  }
}
