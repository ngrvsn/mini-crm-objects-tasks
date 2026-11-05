import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const accounts = JSON.parse(
  readFileSync(process.env.CRM_DEMO_ACCOUNTS_FILE!, 'utf8')
) as Array<{ email: string; password: string; role: string; name: string }>

async function signIn(page: Page, name: string) {
  const account = accounts.find((item) => item.name === name)
  if (!account) throw new Error(`Missing demo account: ${name}`)
  await page.goto('/crm/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Пароль').fill(account.password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.locator('.app-header')).toContainText(name)
}

test('три объекта и задачи во всех статусах видны нужным пользователям', async ({
  browser
}) => {
  const managerContext = await browser.newContext()
  const worker1Context = await browser.newContext()
  const worker2Context = await browser.newContext()
  const manager = await managerContext.newPage()
  const worker1 = await worker1Context.newPage()
  const worker2 = await worker2Context.newPage()
  try {
    await signIn(manager, 'Постановщик')
    const expected = [
      {
        object: 'Бизнес-центр Восток',
        tasks: [
          'Сдать вентиляцию',
          'Проверить пожарную сигнализацию',
          'Доработать отделку входной группы',
          'Согласовать график монтажа лифтов'
        ]
      },
      {
        object: 'ЖК Северный',
        tasks: [
          'Проверить фундамент',
          'Подготовить смету',
          'Проверить гидроизоляцию подвала',
          'Уточнить ведомость окон'
        ]
      },
      {
        object: 'Школа № 8',
        tasks: [
          'Проверить электрику',
          'Смонтировать освещение спортзала',
          'Проверить систему отопления'
        ]
      }
    ]
    for (const group of expected) {
      await manager.goto('/crm/objects')
      await manager.getByRole('link', { name: group.object }).click()
      for (const title of group.tasks) {
        await expect(manager.getByRole('link', { name: title })).toBeVisible()
      }
    }
    await manager.goto('/crm/objects')
    await manager.getByRole('link', { name: 'Бизнес-центр Восток' }).click()
    await manager
      .getByRole('link', { name: 'Доработать отделку входной группы' })
      .click()
    await expect(manager.getByText('На доработке').first()).toBeVisible()
    await expect(
      manager.getByText(
        'Исправить примыкания у входных дверей и приложить фото.'
      )
    ).toBeVisible()

    await signIn(worker1, 'Исполнитель 1')
    for (const title of [
      'Проверить пожарную сигнализацию',
      'Согласовать график монтажа лифтов',
      'Уточнить ведомость окон'
    ]) {
      await expect(worker1.getByRole('link', { name: title })).toBeVisible()
    }
    await expect(
      worker1.getByRole('link', { name: 'Смонтировать освещение спортзала' })
    ).toHaveCount(0)

    await signIn(worker2, 'Исполнитель 2')
    for (const title of [
      'Доработать отделку входной группы',
      'Проверить гидроизоляцию подвала',
      'Смонтировать освещение спортзала'
    ]) {
      await expect(worker2.getByRole('link', { name: title })).toBeVisible()
    }
    await expect(
      worker2.getByRole('link', { name: 'Проверить пожарную сигнализацию' })
    ).toHaveCount(0)
  } finally {
    await managerContext.close()
    await worker1Context.close()
    await worker2Context.close()
  }
})
