import { defineConfig, devices } from '@playwright/test'

if (!process.env.CRM_DEMO_ACCOUNTS_FILE) {
  throw new Error('Set CRM_DEMO_ACCOUNTS_FILE to the local demo accounts JSON')
}

export default defineConfig({
  testDir: './tests/deploy',
  timeout: 180000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.CRM_PUBLIC_ORIGIN ?? 'https://120nmine.tech',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'msedge' }
    }
  ]
})
