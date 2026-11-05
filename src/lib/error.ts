import { isAxiosError } from 'axios'

export function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      { message?: string; error?: string } | undefined
    const detail = data?.message ?? data?.error
    if (detail === 'Неверный email или пароль') return detail
    if (detail === 'Укажите, что исправить') return detail
    if (detail === 'transition forbidden')
      return 'Этот переход статуса недоступен'
    if (detail === 'revision comment required') return 'Укажите, что исправить'
    if (detail === 'task not found') return 'Задача не найдена'
    if (detail === 'object not found') return 'Объект не найден'
    if (error.response?.status === 401) return 'Сессия истекла. Войдите снова'
    if (error.response?.status === 403 || detail === 'forbidden')
      return 'Недостаточно прав'
    if (error.response?.status === 404) return 'Запись не найдена'
    if (!error.response) return 'Нет соединения с сервером'
    if (error.response.status >= 500) return 'Сервис временно недоступен'
    return 'Не удалось выполнить действие. Проверьте данные и повторите попытку'
  }
  if (error instanceof Error && error.message === 'Not authenticated')
    return 'Войдите в систему'
  if (error instanceof Error) return error.message
  return 'Не удалось выполнить действие'
}
