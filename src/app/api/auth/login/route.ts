import { NextRequest } from 'next/server'
import { isAxiosError } from 'axios'
import {
  authError,
  checkOrigin,
  tokenRequest,
  tokenResponse
} from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  if (!checkOrigin(request))
    return authError(403, 'Недопустимый источник запроса')
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return authError(400, 'Некорректный запрос')
  }
  const email = body.email?.trim()
  const password = body.password
  if (!email || !password) return authError(400, 'Укажите email и пароль')
  try {
    return tokenResponse(await tokenRequest('password', { email, password }))
  } catch (error) {
    if (
      isAxiosError(error) &&
      [400, 401, 422].includes(error.response?.status ?? 0)
    ) {
      return authError(401, 'Неверный email или пароль')
    }
    return authError(503, 'Сервис входа временно недоступен')
  }
}
