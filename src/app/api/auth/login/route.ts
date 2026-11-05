import { NextRequest } from 'next/server'
import { isAxiosError } from 'axios'
import {
  authError,
  checkOrigin,
  tokenRequest,
  tokenResponse
} from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) return authError(403, 'Invalid origin')
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return authError(400, 'Invalid request')
  }
  const email = body.email?.trim()
  const password = body.password
  if (!email || !password)
    return authError(400, 'Email and password are required')
  try {
    return tokenResponse(await tokenRequest('password', { email, password }))
  } catch (error) {
    if (
      isAxiosError(error) &&
      [400, 401, 422].includes(error.response?.status ?? 0)
    ) {
      return authError(401, 'Invalid email or password')
    }
    return authError(503, 'Authentication is unavailable')
  }
}
