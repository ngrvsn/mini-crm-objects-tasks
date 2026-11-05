import { spawn } from 'node:child_process'
import { localSupabase } from './local-supabase.mjs'

const { url, publishableKey } = localSupabase()
const app = spawn(process.execPath, ['.next/standalone/server.js'], {
  env: {
    ...process.env,
    HOSTNAME: '127.0.0.1',
    PORT: '3100',
    SUPABASE_URL: url,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    APP_ORIGIN: 'http://127.0.0.1:3100'
  },
  stdio: 'inherit'
})

try {
  let healthy = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (app.exitCode !== null) throw new Error('App exited before healthcheck')
    try {
      const response = await fetch('http://127.0.0.1:3100/api/health')
      if (response.ok && (await response.json()).status === 'ok') {
        healthy = true
        break
      }
    } catch {
      // Wait for the server to bind.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!healthy) throw new Error('Healthcheck did not return status ok')
  console.log('Final runtime and Supabase healthcheck passed')
} finally {
  app.kill()
}
