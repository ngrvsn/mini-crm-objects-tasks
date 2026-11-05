import { expect, test, type Page } from '@playwright/test'

const password = 'LocalTestPassw0rd!'

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()
}

test('постановщик и два исполнителя проходят весь цикл задачи', async ({
  browser
}) => {
  const managerContext = await browser.newContext()
  const worker1Context = await browser.newContext()
  const worker2Context = await browser.newContext()
  const manager = await managerContext.newPage()
  const worker1 = await worker1Context.newPage()
  const worker2 = await worker2Context.newPage()
  const suffix = Date.now()
  const objectName = `Тестовый объект ${suffix}`
  const taskOne = `Проверить перекрытие ${suffix}`
  const taskTwo = `Сверить ведомость ${suffix}`

  try {
    await signIn(manager, 'manager1@example.test')
    await manager.getByRole('button', { name: 'Новый объект' }).click()
    const objectDialog = manager.getByRole('dialog')
    await objectDialog.getByRole('button', { name: 'Сохранить' }).click()
    await expect(objectDialog).toBeVisible()
    await objectDialog.getByLabel('Название').fill(objectName)
    await objectDialog.getByLabel('Адрес').fill('Москва, Тестовая, 1')
    await objectDialog.getByRole('button', { name: 'Сохранить' }).click()
    await manager.getByRole('link', { name: objectName }).click()
    await expect(manager).toHaveURL(/\/objects\/[0-9a-f-]+$/)
    const objectUrl = manager.url()
    await manager.getByRole('button', { name: 'Новая задача' }).click()
    const taskDialog = manager.getByRole('dialog')
    await taskDialog.getByRole('button', { name: 'Создать' }).click()
    await expect(taskDialog).toBeVisible()
    await taskDialog.getByLabel('Название').fill(taskOne)
    await taskDialog
      .getByLabel('Описание')
      .fill('Проверить и отправить на приёмку')
    await taskDialog.getByLabel('Исполнитель').click()
    await manager.getByText('Исполнитель 1', { exact: true }).last().click()
    await taskDialog.getByRole('button', { name: 'Создать' }).click()
    await manager.getByRole('link', { name: taskOne }).click()
    await expect(manager).toHaveURL(/\/tasks\/[0-9a-f-]+$/)
    const taskOneUrl = manager.url()
    await expect(manager.getByRole('button', { name: 'Принять' })).toHaveCount(
      0
    )
    await expect(
      manager.getByRole('button', { name: 'Взять в работу' })
    ).toHaveCount(0)

    await signIn(worker1, 'worker1@example.test')
    await expect(worker1.getByRole('link', { name: taskOne })).toBeVisible()
    await worker1.getByRole('link', { name: taskOne }).click()
    await expect(worker1.getByRole('button', { name: 'Изменить' })).toHaveCount(
      0
    )
    await expect(worker1.getByRole('button', { name: 'Удалить' })).toHaveCount(
      0
    )
    await expect(worker1.getByRole('button', { name: 'Принять' })).toHaveCount(
      0
    )
    await worker1.getByRole('button', { name: 'Взять в работу' }).click()
    await expect(worker1.getByText('В работе').first()).toBeVisible()
    await expect(worker1.getByText('Новый статус: В работе')).toBeVisible()
    await worker1.reload()
    await expect(
      worker1.getByRole('button', { name: 'Отправить на проверку' })
    ).toBeVisible()
    await worker1.getByRole('button', { name: 'Отправить на проверку' }).click()
    await expect(worker1.getByText('На проверке').first()).toBeVisible()

    await manager.goto(taskOneUrl)
    await manager.getByRole('button', { name: 'Изменить' }).click()
    const editTaskDialog = manager.getByRole('dialog')
    await editTaskDialog.getByLabel('Описание').fill('Исправленное описание')
    await editTaskDialog.getByRole('button', { name: 'Сохранить' }).click()
    await expect(manager.locator('span.task-description')).toHaveText(
      'Исправленное описание'
    )
    await manager.getByRole('button', { name: 'Принять' }).click()
    await expect(manager.getByText('Принята').first()).toBeVisible()
    await expect(
      manager.getByRole('button', { name: 'Изменить' })
    ).toBeDisabled()
    await manager.getByTestId('edit-task-tooltip').hover()
    await expect(manager.getByRole('tooltip')).toHaveText('Задача уже принята')
    await expect(manager.getByRole('button', { name: 'Принять' })).toHaveCount(
      0
    )

    await manager.goto(objectUrl)
    await manager.getByRole('button', { name: 'Новая задача' }).click()
    const secondDialog = manager.getByRole('dialog')
    await secondDialog.getByLabel('Название').fill('Черновик, который отменили')
    await secondDialog.getByRole('button', { name: 'Отмена' }).click()
    await manager.getByRole('button', { name: 'Новая задача' }).click()
    await expect(secondDialog.getByLabel('Название')).toHaveValue('')
    await secondDialog.getByLabel('Название').fill(taskTwo)
    await secondDialog.getByLabel('Исполнитель').click()
    await manager.getByText('Исполнитель 2', { exact: true }).last().click()
    await secondDialog.getByRole('button', { name: 'Создать' }).click()
    await manager.getByRole('link', { name: taskTwo }).click()
    await expect(manager).toHaveURL(/\/tasks\/[0-9a-f-]+$/)
    const taskTwoUrl = manager.url()

    await signIn(worker2, 'worker2@example.test')
    await expect(worker2.getByRole('link', { name: taskOne })).toHaveCount(0)
    await worker2.goto(taskTwoUrl)
    await worker2.getByRole('button', { name: 'Взять в работу' }).click()
    await worker2.getByRole('button', { name: 'Отправить на проверку' }).click()

    await manager.goto(taskTwoUrl)
    await manager.getByRole('button', { name: 'Вернуть на доработку' }).click()
    const revisionDialog = manager.getByRole('dialog')
    await revisionDialog.getByLabel('Комментарий').fill('Отменённый черновик')
    await revisionDialog.getByRole('button', { name: 'Отмена' }).click()
    await manager.getByRole('button', { name: 'Вернуть на доработку' }).click()
    await expect(revisionDialog.getByLabel('Комментарий')).toHaveValue('')
    await revisionDialog.getByRole('button', { name: 'Вернуть' }).click()
    await expect(
      revisionDialog.getByText('Укажите, что исправить')
    ).toBeVisible()
    await expect(manager.getByText('На проверке').first()).toBeVisible()
    await revisionDialog
      .getByLabel('Комментарий')
      .fill('Исправить количество материалов')
    await revisionDialog.getByRole('button', { name: 'Вернуть' }).click()
    await expect(
      manager.getByText('Исправить количество материалов')
    ).toBeVisible()

    await worker2.reload()
    await expect(
      worker2.getByRole('button', { name: 'Взять в работу' })
    ).toBeVisible()
    await expect(
      worker2.getByText('Исправить количество материалов')
    ).toBeVisible()
    await worker2.getByRole('button', { name: 'Взять в работу' }).click()
    await worker2.getByRole('button', { name: 'Отправить на проверку' }).click()
    await manager.reload()
    await manager.getByRole('button', { name: 'Принять' }).click()
    await expect(manager.getByText('Принята').first()).toBeVisible()
    await expect(manager.locator('.ant-timeline-item')).toHaveCount(7)
    await expect(manager.getByText(/Создание.*Новая/)).toBeVisible()
    await expect(manager.getByText(/На проверке.*На доработке/)).toBeVisible()
    await expect(manager.getByText(/На проверке.*Принята/)).toBeVisible()
    await manager.screenshot({
      path: 'test-results/task-accepted.png',
      fullPage: true
    })
    await worker2.reload()
    await expect(worker2.getByText('Принята').first()).toBeVisible()
    await expect(
      worker2.getByRole('button', { name: 'Взять в работу' })
    ).toHaveCount(0)
    await expect(
      worker2.getByRole('button', { name: 'Отправить на проверку' })
    ).toHaveCount(0)
    await worker2.getByRole('button', { name: 'Выйти' }).click()
    await expect(worker2.getByRole('button', { name: 'Войти' })).toBeVisible()

    await manager.goto(taskOneUrl)
    await expect(
      manager.getByRole('button', { name: 'Изменить' })
    ).toBeDisabled()
    await manager.getByRole('button', { name: 'Удалить' }).click()
    await manager
      .locator('.ant-popconfirm')
      .getByRole('button', { name: 'Удалить' })
      .click()
    await expect(manager).toHaveURL(/\/objects\/[0-9a-f-]+$/)

    await manager.goto(objectUrl)
    await manager.getByRole('button', { name: 'Изменить' }).click()
    const editObjectDialog = manager.getByRole('dialog')
    await editObjectDialog.getByLabel('Адрес').fill('Москва, Новая Тестовая, 2')
    await editObjectDialog.getByRole('button', { name: 'Сохранить' }).click()
    await expect(
      manager.getByText('Москва, Новая Тестовая, 2').first()
    ).toBeVisible()
    await manager.getByRole('button', { name: 'Удалить' }).click()
    await manager
      .locator('.ant-popconfirm')
      .getByRole('button', { name: 'Удалить' })
      .click()
    await expect(manager).toHaveURL(/\/objects$/)
    await expect(manager.getByRole('link', { name: objectName })).toHaveCount(0)
  } finally {
    await managerContext.close()
    await worker1Context.close()
    await worker2Context.close()
  }
})
