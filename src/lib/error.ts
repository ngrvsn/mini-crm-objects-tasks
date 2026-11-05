import { isAxiosError } from 'axios'

export function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      { message?: string; error?: string } | undefined
    if (data?.message) return data.message
    if (data?.error) return data.error
    if (error.response?.status === 403) return 'Недостаточно прав'
  }
  if (error instanceof Error) return error.message
  return 'Не удалось выполнить действие'
}
