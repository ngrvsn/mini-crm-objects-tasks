import axios from 'axios'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
}

const production = process.env.NODE_ENV === 'production'
const cookieName = production ? '__Secure-crm-refresh' : 'crm-refresh'
const cookiePath = '/api/auth'

export function checkOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const expected = process.env.APP_ORIGIN ?? request.nextUrl.origin
  return origin === expected
}

function authConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key || key.startsWith('sb_secret_')) {
    throw new Error('Supabase auth is not configured')
  }
  return { url, key }
}

export async function tokenRequest(
  grantType: 'password' | 'refresh_token',
  payload: Record<string, string>
): Promise<TokenResponse> {
  const { url, key } = authConfig()
  const { data } = await axios.post<TokenResponse>(
    `${url}/auth/v1/token?grant_type=${grantType}`,
    payload,
    { headers: { apikey: key }, timeout: 10000 }
  )
  return data
}

export async function revokeSession(accessToken: string): Promise<void> {
  const { url, key } = authConfig()
  await axios.post(
    `${url}/auth/v1/logout?scope=local`,
    {},
    {
      headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
      timeout: 10000
    }
  )
}

export function getRefreshToken(request: NextRequest): string | undefined {
  return request.cookies.get(cookieName)?.value
}

export function withRefreshCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: production,
    sameSite: 'strict',
    path: cookiePath,
    maxAge: 60 * 60 * 24 * 30
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function clearRefreshCookie(response: NextResponse): NextResponse {
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: production,
    sameSite: 'strict',
    path: cookiePath,
    maxAge: 0
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function tokenResponse(tokens: TokenResponse): NextResponse {
  return withRefreshCookie(
    NextResponse.json({
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in
    }),
    tokens.refresh_token
  )
}

export function authError(status: number, message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}
