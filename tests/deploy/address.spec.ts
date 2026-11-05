import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('публичные подсказки адреса и ручной ввод', async ({ page }) => {
  const accounts = JSON.parse(
    readFileSync(process.env.CRM_DEMO_ACCOUNTS_FILE!, 'utf8')
  ) as Array<{ email: string; password: string; role: string }>
  const manager = accounts.find((item) => item.role === 'manager')
  if (!manager) throw new Error('Manager demo account is missing')

  await page.goto('/crm/login')
  await page.getByLabel('Email').fill(manager.email)
  await page.getByLabel('Пароль').fill(manager.password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('button', { name: 'Новый объект' })).toBeVisible()
  await page.getByRole('button', { name: 'Новый объект' }).click()
  const address = page.getByRole('dialog').getByLabel('Адрес')
  await address.fill('Москва Тверская')
  const option = page.locator('.ant-select-item-option').first()
  await expect(option).toBeVisible({ timeout: 15000 })
  await expect(option).toContainText('Россия')
  await expect(option).not.toContainText('Russia')
  await option.click()
  await expect(address).not.toHaveValue('Москва Тверская')
  await address.fill('Свой адрес стройплощадки')
  await expect(address).toHaveValue('Свой адрес стройплощадки')
})
