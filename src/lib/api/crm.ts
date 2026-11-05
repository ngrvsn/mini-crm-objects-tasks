import { privateApi } from './client'
import type {
  ObjectRecord,
  Profile,
  StatusHistory,
  Task,
  TaskStatus
} from '@/lib/types'

export type ObjectInput = { name: string; address: string }
export type TaskInput = {
  object_id: string
  title: string
  description: string
  assignee_id: string
}

export async function getCurrentProfile(): Promise<Profile> {
  const { data } = await privateApi.post<Profile>('/rpc/current_profile', {})
  if (!data?.id) throw new Error('У пользователя не назначена роль')
  return data
}

export async function getProfiles(): Promise<Profile[]> {
  const { data } = await privateApi.get<Profile[]>('/profiles', {
    params: {
      select: 'id,display_name,role,created_at',
      order: 'display_name.asc'
    }
  })
  return data
}

export async function getObjects(): Promise<ObjectRecord[]> {
  const { data } = await privateApi.get<ObjectRecord[]>('/objects', {
    params: { select: '*', order: 'created_at.desc' }
  })
  return data
}

export async function getObject(id: string): Promise<ObjectRecord | null> {
  const { data } = await privateApi.get<ObjectRecord[]>('/objects', {
    params: { select: '*', id: `eq.${id}`, limit: 1 }
  })
  return data[0] ?? null
}

export async function createObject(input: ObjectInput): Promise<ObjectRecord> {
  const { data } = await privateApi.post<ObjectRecord>('/rpc/create_object', {
    p_name: input.name,
    p_address: input.address
  })
  return data
}

export async function updateObject(
  id: string,
  input: ObjectInput
): Promise<ObjectRecord> {
  const { data } = await privateApi.post<ObjectRecord>('/rpc/update_object', {
    p_id: id,
    p_name: input.name,
    p_address: input.address
  })
  return data
}

export async function deleteObject(id: string): Promise<void> {
  await privateApi.post('/rpc/delete_object', { p_id: id })
}

export async function getTasks(
  objectId?: string,
  assigneeId?: string
): Promise<Task[]> {
  const { data } = await privateApi.get<Task[]>('/tasks', {
    params: {
      select: '*',
      ...(objectId ? { object_id: `eq.${objectId}` } : {}),
      ...(assigneeId ? { assignee_id: `eq.${assigneeId}` } : {}),
      order: 'created_at.desc'
    }
  })
  return data
}

export async function getTask(id: string): Promise<Task | null> {
  const { data } = await privateApi.get<Task[]>('/tasks', {
    params: { select: '*', id: `eq.${id}`, limit: 1 }
  })
  return data[0] ?? null
}

export async function createTask(input: TaskInput): Promise<Task> {
  const { data } = await privateApi.post<Task>('/rpc/create_task', {
    p_object_id: input.object_id,
    p_title: input.title,
    p_description: input.description,
    p_assignee_id: input.assignee_id
  })
  return data
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  const { data } = await privateApi.post<Task>('/rpc/update_task', {
    p_id: id,
    p_object_id: input.object_id,
    p_title: input.title,
    p_description: input.description,
    p_assignee_id: input.assignee_id
  })
  return data
}

export async function deleteTask(id: string): Promise<void> {
  await privateApi.post('/rpc/delete_task', { p_id: id })
}

export async function transitionTask(
  id: string,
  status: TaskStatus,
  comment?: string
): Promise<Task> {
  const { data } = await privateApi.post<Task>('/rpc/transition_task', {
    p_id: id,
    p_to_status: status,
    p_comment: comment ?? null
  })
  return data
}

export async function getHistory(taskId: string): Promise<StatusHistory[]> {
  const { data } = await privateApi.get<StatusHistory[]>(
    '/task_status_history',
    {
      params: { select: '*', task_id: `eq.${taskId}`, order: 'created_at.asc' }
    }
  )
  return data
}
