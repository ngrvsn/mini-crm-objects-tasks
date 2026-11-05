import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('публичная инструкция и PDF', async ({ browser, request }) => {
  const accounts = JSON.parse(
    readFileSync(process.env.CRM_DEMO_ACCOUNTS_FILE!, 'utf8')
  ) as Array<{ email: string; password: string; role: string }>
  const pdf = await request.get('/crm/mini-crm-guide.pdf')
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toContain('application/pdf')
  expect((await pdf.body()).length).toBeGreaterThan(10000)

  for (const role of ['manager', 'executor']) {
    const account = accounts.find((item) => item.role === role)
    if (!account) throw new Error(`Missing ${role} demo account`)
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto('/crm/login')
      await page.getByLabel('Email').fill(account.email)
      await page.getByLabel('Пароль').fill(account.password)
      await page.getByRole('button', { name: 'Войти' }).click()
      await page.getByRole('button', { name: 'Инструкция' }).click()
      const guide = page.getByRole('dialog', {
        name: 'Как пользоваться мини-CRM'
      })
      await expect(
        guide.getByRole('tab', {
          name: role === 'manager' ? 'Я заказчик' : 'Я исполнитель'
        })
      ).toHaveAttribute('aria-selected', 'true')
      await expect(
        guide.getByRole('link', { name: 'Скачать памятку PDF' })
      ).toHaveAttribute('href', '/crm/mini-crm-guide.pdf')
    } finally {
      await context.close()
    }
  }
})
