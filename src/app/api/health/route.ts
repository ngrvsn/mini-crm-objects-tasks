import axios from 'axios'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return NextResponse.json({ status: 'unavailable' }, { status: 503 })
  }
  try {
    const { data } = await axios.post<boolean>(
      `${url}/rest/v1/rpc/healthcheck`,
      {},
      { headers: { apikey: key }, timeout: 3000 }
    )
    if (data !== true) throw new Error('Unexpected health response')
    return NextResponse.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
