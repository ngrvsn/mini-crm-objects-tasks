import { expect, test, type Page } from '@playwright/test'

const password = 'LocalTestPassw0rd!'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()
}

function waitForAuthEvent(page: Page, type: 'login' | 'logout' | 'syncing') {
  return page.evaluate(
    (expected) =>
      new Promise<void>((resolve) => {
        const onChange = (event: Event) => {
          if ((event as CustomEvent<string>).detail !== expected) return
          window.removeEventListener('crm-auth-change', onChange)
          resolve()
        }
        window.addEventListener('crm-auth-change', onChange)
      }),
    type
  )
}

test('смена пользователя в другой вкладке сразу скрывает прежние данные', async ({
  page
}) => {
  await signIn(page, 'manager1@example.test')
  await expect(page.getByRole('button', { name: 'Новый объект' })).toBeVisible()

  let releaseRefresh: () => void = () => undefined
  let refreshStarted: () => void = () => undefined
  const holdRefresh = new Promise<void>((resolve) => {
    releaseRefresh = resolve
  })
  const refreshSeen = new Promise<void>((resolve) => {
    refreshStarted = resolve
  })
  try {
    await page.route('**/api/auth/refresh', async (route) => {
      refreshStarted()
      await holdRefresh
      await route.continue()
    })
    const syncing = waitForAuthEvent(page, 'syncing')
    await page.evaluate(async (password) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'worker1@example.test', password })
      })
      if (!response.ok) throw new Error('Worker login failed')
      const channel = new BroadcastChannel('crm-auth')
      channel.postMessage('login')
      channel.close()
    }, password)
    await syncing
    await refreshSeen
    await expect(
      page.getByRole('button', { name: 'Новый объект' })
    ).toHaveCount(0)
    await expect(page.getByText('Постановщик', { exact: true })).toHaveCount(0)
    releaseRefresh()
    await expect(
      page.getByRole('menuitem', { name: 'Мои задачи' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Новый объект' })
    ).toHaveCount(0)
  } finally {
    releaseRefresh()
  }
})

test('вход, восстановление, защита cookie и выход', async ({
  page,
  context
}) => {
  const loginResponse = await context.request.get('/login')
  expect(loginResponse.headers()['x-frame-options']).toBe('DENY')
  expect(loginResponse.headers()['x-content-type-options']).toBe('nosniff')
  expect(loginResponse.headers()['content-security-policy']).toContain(
    "frame-ancestors 'none'"
  )
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

  for (const route of ['login', 'refresh', 'logout']) {
    const rejected = await context.request.post(`/api/auth/${route}`, {
      headers: { Origin: 'https://attacker.example' }
    })
    expect(rejected.status()).toBe(403)
  }
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

test('выход перекрывает запоздалый refresh из другой вкладки', async ({
  browser
}) => {
  const context = await browser.newContext()
  const first = await context.newPage()
  const second = await context.newPage()
  let releaseRefresh: () => void = () => undefined
  let refreshFinished: () => void = () => undefined
  const holdRefresh = new Promise<void>((resolve) => {
    releaseRefresh = resolve
  })
  const refreshSeen = new Promise<void>((resolve) => {
    refreshFinished = resolve
  })
  try {
    await first.goto('/login')
    await second.goto('/login')
    await signIn(first, 'manager1@example.test')
    await expect(second).toHaveURL(/\/objects$/)
    await second.route('**/api/auth/refresh', async (route) => {
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      refreshFinished()
      await holdRefresh
      await route.fulfill({ response })
    })
    await second.reload()
    await refreshSeen
    const logoutResponse = first.waitForResponse((response) =>
      response.url().includes('/api/auth/logout')
    )
    await first.getByRole('button', { name: 'Выйти' }).click()
    const lateResponse = second.waitForResponse((response) =>
      response.url().includes('/api/auth/refresh')
    )
    releaseRefresh()
    expect((await lateResponse).status()).toBe(200)
    expect((await logoutResponse).status()).toBe(200)
    await expect(first).toHaveURL(/\/login$/)
    expect(
      (await context.cookies()).some((item) => item.name === 'crm-refresh')
    ).toBe(false)
    await expect(second).toHaveURL(/\/login$/)
    await second.unroute('**/api/auth/refresh')
    const replayResponse = second.waitForResponse((response) =>
      response.url().includes('/api/auth/refresh')
    )
    await second.reload()
    expect((await replayResponse).status()).toBe(401)
    await expect(second).toHaveURL(/\/login$/)
    expect(
      (await context.cookies()).some((item) => item.name === 'crm-refresh')
    ).toBe(false)
  } finally {
    releaseRefresh()
    await context.close()
  }
})

test('старый отказ refresh не сбрасывает новый успешный вход', async ({
  browser
}) => {
  const context = await browser.newContext()
  await context.addCookies([
    {
      name: 'crm-refresh',
      value: 'expired',
      domain: '127.0.0.1',
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'Strict'
    }
  ])
  const page = await context.newPage()
  let releaseRefresh: () => void = () => undefined
  let refreshRequested: () => void = () => undefined
  const holdRefresh = new Promise<void>((resolve) => {
    releaseRefresh = resolve
  })
  const requestSeen = new Promise<void>((resolve) => {
    refreshRequested = resolve
  })
  let refreshDone: () => void = () => undefined
  const refreshFinished = new Promise<void>((resolve) => {
    refreshDone = resolve
  })
  try {
    await page.route('**/api/auth/refresh', async (route) => {
      refreshRequested()
      await holdRefresh
      try {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Сессия истекла' })
        })
      } catch (error) {
        if (!String(error).includes('Route is already handled')) throw error
      } finally {
        refreshDone()
      }
    })
    await page.goto('/login')
    await requestSeen
    await page.getByLabel('Email').fill('manager1@example.test')
    await page.getByLabel('Пароль').fill(password)
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()
    releaseRefresh()
    await refreshFinished
    await expect(page).toHaveURL(/\/objects$/)
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()
    await page.unroute('**/api/auth/refresh')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()
  } finally {
    releaseRefresh()
    await context.close()
  }
})

test('старый успешный refresh не подменяет новый вход', async ({ page }) => {
  await signIn(page, 'manager1@example.test')
  let releaseRefresh: () => void = () => undefined
  let refreshStarted: () => void = () => undefined
  const holdRefresh = new Promise<void>((resolve) => {
    releaseRefresh = resolve
  })
  const refreshSeen = new Promise<void>((resolve) => {
    refreshStarted = resolve
  })
  let refreshDone: () => void = () => undefined
  const refreshFinished = new Promise<void>((resolve) => {
    refreshDone = resolve
  })
  try {
    await page.route('**/api/auth/refresh', async (route) => {
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      refreshStarted()
      await holdRefresh
      try {
        await route.fulfill({ response })
      } catch (error) {
        if (!String(error).includes('Route is already handled')) throw error
      } finally {
        refreshDone()
      }
    })
    await page.goto('/login')
    await refreshSeen
    await page.getByLabel('Email').fill('worker1@example.test')
    await page.getByLabel('Пароль').fill(password)
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(
      page.getByRole('menuitem', { name: 'Мои задачи' })
    ).toBeVisible()
    releaseRefresh()
    await refreshFinished
    await page.unroute('**/api/auth/refresh')
    await page.reload()
    await expect(
      page.getByRole('menuitem', { name: 'Мои задачи' })
    ).toBeVisible()
  } finally {
    releaseRefresh()
  }
})

test('поздний ответ профиля не возвращает сессию после выхода', async ({
  browser
}) => {
  const context = await browser.newContext()
  const first = await context.newPage()
  const second = await context.newPage()
  let releaseProfile: () => void = () => undefined
  let profileRequested: () => void = () => undefined
  const holdProfile = new Promise<void>((resolve) => {
    releaseProfile = resolve
  })
  const requestSeen = new Promise<void>((resolve) => {
    profileRequested = resolve
  })
  try {
    await first.goto('/login')
    await second.goto('/login')
    await second.route('**/rest/v1/rpc/current_profile', async (route) => {
      profileRequested()
      await holdProfile
      await route.continue()
    })
    await signIn(first, 'manager1@example.test')
    await requestSeen
    const logoutSeen = waitForAuthEvent(second, 'logout')
    await first.getByRole('button', { name: 'Выйти' }).click()
    await logoutSeen
    const profileResponse = second.waitForResponse((response) =>
      response.url().includes('/rpc/current_profile')
    )
    releaseProfile()
    expect((await profileResponse).ok()).toBe(true)
    await second.waitForTimeout(300)
    await expect(second).toHaveURL(/\/login$/)
    await expect(second.getByRole('button', { name: 'Выйти' })).toHaveCount(0)
  } finally {
    releaseProfile()
    await context.close()
  }
})

test('ожидающий вход не восстанавливает сессию после выхода в другой вкладке', async ({
  browser
}) => {
  const context = await browser.newContext()
  const first = await context.newPage()
  const second = await context.newPage()
  let releaseProfile: () => void = () => undefined
  const holdProfile = new Promise<void>((resolve) => {
    releaseProfile = resolve
  })
  try {
    await first.goto('/login')
    await second.goto('/login')
    await first.route('**/rest/v1/rpc/current_profile', async (route) => {
      await holdProfile
      await route.continue()
    })
    await first.getByLabel('Email').fill('manager1@example.test')
    await first.getByLabel('Пароль').fill(password)
    await first.getByRole('button', { name: 'Войти' }).click()
    await expect(second.getByRole('button', { name: 'Выйти' })).toBeVisible()

    const logoutSeen = waitForAuthEvent(first, 'logout')
    await second.getByRole('button', { name: 'Выйти' }).click()
    await logoutSeen
    releaseProfile()
    await expect(first.getByRole('button', { name: 'Войти' })).toBeEnabled()
    await expect(first).toHaveURL(/\/login$/)
    await expect(first.getByRole('button', { name: 'Выйти' })).toHaveCount(0)
  } finally {
    releaseProfile()
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

test('карточки и формы помещаются на экране шириной 320 px', async ({
  browser
}) => {
  const managerContext = await browser.newContext({
    viewport: { width: 320, height: 700 }
  })
  const workerContext = await browser.newContext({
    viewport: { width: 320, height: 700 }
  })
  const manager = await managerContext.newPage()
  const worker = await workerContext.newPage()
  const expectNoOverflow = async (page: Page) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(320)
  }
  try {
    await signIn(manager, 'manager1@example.test')
    await expectNoOverflow(manager)
    await manager.getByRole('button', { name: 'Новый объект' }).click()
    await expect(manager.getByRole('dialog').getByLabel('Адрес')).toBeVisible()
    await expectNoOverflow(manager)
    await manager
      .getByRole('dialog')
      .getByRole('button', { name: 'Отмена' })
      .click()
    await manager.getByRole('link', { name: 'ЖК Северный' }).click()
    await expect(
      manager.getByRole('heading', { name: 'ЖК Северный' })
    ).toBeVisible()
    await expectNoOverflow(manager)
    await manager.screenshot({
      path: 'test-results/mobile-object-card.png',
      fullPage: true
    })
    await manager.getByRole('button', { name: 'Изменить' }).click()
    await expect(manager.getByRole('dialog').getByLabel('Адрес')).toBeVisible()
    await expectNoOverflow(manager)
    await manager
      .getByRole('dialog')
      .getByRole('button', { name: 'Отмена' })
      .click()
    const taskScroller = manager.locator('.ant-table-content')
    expect(
      await taskScroller.evaluate(
        (element) => element.scrollWidth > element.clientWidth
      )
    ).toBe(true)
    await taskScroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })
    await expect(
      manager.getByRole('columnheader', { name: 'Создана' })
    ).toBeInViewport()
    await taskScroller.evaluate((element) => {
      element.scrollLeft = 0
    })
    await manager.getByRole('button', { name: 'Новая задача' }).click()
    const taskDialog = manager.getByRole('dialog')
    await expect(taskDialog.getByLabel('Исполнитель')).toBeVisible()
    await expectNoOverflow(manager)
    await taskDialog.getByRole('button', { name: 'Отмена' }).click()
    await manager.getByRole('link', { name: 'Проверить фундамент' }).click()
    await expect(manager.getByText('История статусов')).toBeVisible()
    await expectNoOverflow(manager)
    await manager.screenshot({
      path: 'test-results/mobile-task-card.png',
      fullPage: true
    })
    await manager.getByRole('button', { name: 'Изменить' }).click()
    await expect(manager.getByRole('dialog').getByLabel('Объект')).toBeVisible()
    await expectNoOverflow(manager)

    await signIn(worker, 'worker1@example.test')
    await expect(
      worker.getByRole('heading', { name: 'Мои задачи' })
    ).toBeVisible()
    await expect(
      worker.getByRole('link', { name: 'Проверить фундамент' })
    ).toBeVisible()
    await expect(worker.locator('.ant-spin-blur')).toHaveCount(0)
    await expect(worker.locator('.ant-spin-container')).toHaveCSS(
      'opacity',
      '1'
    )
    await worker.waitForTimeout(400)
    await expectNoOverflow(worker)
    await worker.screenshot({
      path: 'test-results/mobile-my-tasks.png',
      fullPage: true
    })
    await worker.getByRole('link', { name: 'Проверить фундамент' }).click()
    await expect(
      worker.getByRole('heading', { name: 'Проверить фундамент' })
    ).toBeVisible()
    await expectNoOverflow(worker)
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
