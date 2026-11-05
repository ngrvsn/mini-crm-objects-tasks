import { NextRequest, NextResponse } from 'next/server'
import { isAxiosError } from 'axios'
import {
  authError,
  checkOrigin,
  clearRefreshCookie,
  getRefreshToken,
  revokeSession,
  tokenRequest
} from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  if (!checkOrigin(request))
    return authError(403, 'Недопустимый источник запроса')
  const cookie = getRefreshToken(request)
  if (!cookie) return clearRefreshCookie(NextResponse.json({ ok: true }))

  try {
    // Refreshing ensures we can revoke the session even after a page reload.
    const tokens = await tokenRequest('refresh_token', {
      refresh_token: cookie
    })
    await revokeSession(tokens.access_token)
    return clearRefreshCookie(NextResponse.json({ ok: true }))
  } catch (error) {
    if (
      isAxiosError(error) &&
      [400, 401].includes(error.response?.status ?? 0)
    ) {
      return clearRefreshCookie(NextResponse.json({ ok: true }))
    }
    return authError(503, 'Не удалось завершить сессию. Повторите выход')
  }
}
