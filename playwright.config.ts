import { execSync } from 'node:child_process'
import { defineConfig, devices } from '@playwright/test'

const lines = execSync('pnpm exec supabase status -o env', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore']
})
const values = Object.fromEntries(
  lines
    .split(/\r?\n/)
    .map((line) => /^([A-Z_]+)=(.*)$/.exec(line))
    .filter((item): item is RegExpExecArray => Boolean(item))
    .map((item) => [item[1], item[2].replace(/^"|"$/g, '')])
)
const supabaseUrl = values.API_URL ?? values.SUPABASE_URL
const publishableKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY
if (!supabaseUrl || !publishableKey)
  throw new Error('Start local Supabase before E2E tests')

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: publishableKey,
  APP_ORIGIN: 'http://127.0.0.1:3100'
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.CI ? {} : { channel: 'msedge' })
      }
    }
  ],
  webServer: {
    command: 'pnpm dev --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: false,
    timeout: 120000,
    env: environment
  }
})
