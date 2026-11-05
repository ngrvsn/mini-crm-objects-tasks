import { expect, test, type Page } from '@playwright/test'

const password = 'LocalTestPassw0rd!'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()
}

test('вход, восстановление, защита cookie и выход', async ({
  page,
  context
}) => {
  await page.goto('/objects')
  await expect(page).toHaveURL(/\/login$/)
  await page.screenshot({ path: 'test-results/login.png', fullPage: true })
  await page.getByLabel('Email').fill('manager1@example.test')
  await page.getByLabel('Пароль').fill('wrong-password')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.locator('.ant-alert-error')).toContainText(
    'Неверный email или пароль'
  )
  await expect(page).toHaveURL(/\/login$/)

  await signIn(page, 'manager1@example.test')
  await expect(page).toHaveURL(/\/objects$/)
  await expect(page.getByRole('link', { name: 'ЖК Северный' })).toBeVisible()
  await expect(page.locator('.ant-spin-spinning')).toHaveCount(0)
  await expect(page.locator('.ant-spin-blur')).toHaveCount(0)
  await expect(page.locator('.ant-spin-container')).toHaveCSS('opacity', '1')
  // Let Ant Design finish the table fade before capturing the visual review.
  await page.waitForTimeout(400)
  await page.screenshot({
    path: 'test-results/desktop-objects.png',
    fullPage: true
  })
  const cookie = (await context.cookies()).find(
    (item) => item.name === 'crm-refresh'
  )
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict' })
  const browserStorage = await page.evaluate(() => ({
    cookie: document.cookie,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage)
  }))
  expect(browserStorage.cookie).not.toContain('crm-refresh')
  expect(browserStorage.local).not.toMatch(
    /access_token|refresh_token|eyJ[A-Za-z0-9_-]{20}/
  )
  expect(browserStorage.session).not.toMatch(
    /access_token|refresh_token|eyJ[A-Za-z0-9_-]{20}/
  )

  const rejected = await context.request.post('/api/auth/refresh', {
    headers: { Origin: 'https://attacker.example' }
  })
  expect(rejected.status()).toBe(403)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()
  await page.goto('/my-tasks')
  await expect(
    page.getByText('Этот раздел предназначен исполнителям')
  ).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Мои задачи' })).toHaveCount(
    0
  )

  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(
    (await context.cookies()).some((item) => item.name === 'crm-refresh')
  ).toBe(false)
  await page.goto('/objects')
  await expect(page).toHaveURL(/\/login$/)
})

test('вход и выход синхронизируются между вкладками', async ({ browser }) => {
  const context = await browser.newContext()
  const first = await context.newPage()
  const second = await context.newPage()
  try {
    await first.goto('/login')
    await second.goto('/login')
    await signIn(first, 'manager1@example.test')
    await expect(second).toHaveURL(/\/objects$/)
    await expect(second.getByRole('button', { name: 'Выйти' })).toBeVisible()

    await Promise.all([first.reload(), second.reload()])
    await expect(first.getByRole('button', { name: 'Выйти' })).toBeVisible()
    await expect(second.getByRole('button', { name: 'Выйти' })).toBeVisible()

    await first.getByRole('button', { name: 'Выйти' }).click()
    await expect(first).toHaveURL(/\/login$/)
    await expect(second).toHaveURL(/\/login$/)
    await second.reload()
    await expect(second).toHaveURL(/\/login$/)
    expect(
      (await context.cookies()).some((item) => item.name === 'crm-refresh')
    ).toBe(false)
  } finally {
    await context.close()
  }
})

test('исполнитель видит только свои объекты и действия, включая узкий экран', async ({
  browser
}) => {
  const managerContext = await browser.newContext()
  const workerContext = await browser.newContext({
    viewport: { width: 390, height: 844 }
  })
  const manager = await managerContext.newPage()
  const worker = await workerContext.newPage()
  try {
    await signIn(manager, 'manager1@example.test')
    await manager.getByRole('link', { name: 'Школа № 8' }).click()
    await expect(manager).toHaveURL(/\/objects\/[0-9a-f-]+$/)
    const foreignObjectUrl = manager.url()
    await manager.getByRole('link', { name: 'Проверить электрику' }).click()
    await expect(manager).toHaveURL(/\/tasks\/[0-9a-f-]+$/)
    const foreignTaskUrl = manager.url()

    await signIn(worker, 'worker2@example.test')
    await expect(worker).toHaveURL(/\/my-tasks$/)
    await expect(
      worker.getByRole('heading', { name: 'Мои задачи' })
    ).toBeVisible()
    await worker.goto('/objects')
    await expect(
      worker.getByRole('link', { name: 'ЖК Северный' })
    ).toBeVisible()
    await expect(
      worker.getByRole('link', { name: 'Бизнес-центр Восток' })
    ).toBeVisible()
    await expect(worker.getByRole('link', { name: 'Школа № 8' })).toHaveCount(0)
    await expect(
      worker.getByRole('button', { name: 'Новый объект' })
    ).toHaveCount(0)
    await expect(worker.getByRole('button', { name: 'Изменить' })).toHaveCount(
      0
    )
    await expect(worker.getByRole('button', { name: 'Удалить' })).toHaveCount(0)
    expect(
      await worker.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(390)
    await worker.setViewportSize({ width: 320, height: 700 })
    expect(
      await worker.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(320)
    await worker.setViewportSize({ width: 390, height: 844 })
    await worker.screenshot({
      path: 'test-results/mobile-objects.png',
      fullPage: true
    })
    await worker.getByRole('button', { name: 'Открыть меню' }).click()
    await expect(worker.locator('.ant-drawer-open')).toBeVisible()
    await worker.getByRole('menuitem', { name: 'Мои задачи' }).click()
    await expect(worker).toHaveURL(/\/my-tasks$/)
    await expect(worker.locator('.ant-drawer-open')).toHaveCount(0)

    await worker.goto(foreignObjectUrl)
    await expect(
      worker.getByText('Объект не найден или нет доступа')
    ).toBeVisible()
    await worker.goto(foreignTaskUrl)
    await expect(
      worker.getByText('Задача не найдена или нет доступа')
    ).toBeVisible()
    await expect(
      worker.getByRole('button', { name: 'Взять в работу' })
    ).toHaveCount(0)
  } finally {
    await managerContext.close()
    await workerContext.close()
  }
})

test('второй постановщик видит все объекты и может управлять задачами', async ({
  page
}) => {
  await signIn(page, 'manager2@example.test')
  await expect(page.getByRole('link', { name: 'ЖК Северный' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Школа № 8' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Бизнес-центр Восток' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Новый объект' })).toBeVisible()
  await page.getByRole('link', { name: 'Школа № 8' }).click()
  await expect(
    page.getByRole('link', { name: 'Проверить электрику' })
  ).toBeVisible()
  await page.getByRole('link', { name: 'Проверить электрику' }).click()
  await expect(page.getByRole('button', { name: 'Изменить' })).toBeVisible()
  await expect(page.getByText('На доработке').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Принять' })).toHaveCount(0)
})
