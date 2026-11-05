import { expect, it } from 'vitest'
import { errorMessage } from './error'

function apiError(status: number, message: string) {
  return { isAxiosError: true, response: { status, data: { message } } }
}

it('не показывает внутренние ошибки базы пользователю', () => {
  expect(errorMessage(apiError(403, 'permission denied for table tasks'))).toBe(
    'Недостаточно прав'
  )
  expect(
    errorMessage(apiError(400, 'constraint task_status_history_pkey'))
  ).toBe('Не удалось выполнить действие. Проверьте данные и повторите попытку')
})

it('показывает понятную ошибку запрещённого перехода', () => {
  expect(errorMessage(apiError(403, 'transition forbidden'))).toBe(
    'Этот переход статуса недоступен'
  )
})
