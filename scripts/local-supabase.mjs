import { execSync } from 'node:child_process'

export function localSupabase() {
  const output = execSync('pnpm exec supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  })
  const values = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => /^([A-Z_]+)=(.*)$/.exec(line))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^"|"$/g, '')])
  )
  const url = values.API_URL ?? values.SUPABASE_URL
  const publishableKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY
  const serviceKey = values.SERVICE_ROLE_KEY ?? values.SECRET_KEY
  if (
    !url?.startsWith('http://127.0.0.1:54321') ||
    !publishableKey ||
    !serviceKey
  ) {
    throw new Error('Local Supabase is not ready')
  }
  return { url, publishableKey, serviceKey }
}
