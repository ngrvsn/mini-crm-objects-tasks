import type { Profile, Task, TaskStatus } from './types'

export const statusLabels: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  revision: 'На доработке',
  accepted: 'Принята'
}

export const statusColors: Record<TaskStatus, string> = {
  new: 'default',
  in_progress: 'processing',
  review: 'warning',
  revision: 'error',
  accepted: 'success'
}

export function availableTransitions(
  profile: Profile,
  task: Task
): TaskStatus[] {
  if (profile.role === 'manager') {
    return task.status === 'review' ? ['accepted', 'revision'] : []
  }
  if (task.assignee_id !== profile.id) return []
  if (task.status === 'new' || task.status === 'revision')
    return ['in_progress']
  if (task.status === 'in_progress') return ['review']
  return []
}
