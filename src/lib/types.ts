export type Role = 'manager' | 'executor'
export type TaskStatus =
  'new' | 'in_progress' | 'review' | 'revision' | 'accepted'

export type Profile = {
  id: string
  display_name: string
  role: Role
  created_at: string
}

export type ObjectRecord = {
  id: string
  name: string
  address: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Task = {
  id: string
  object_id: string
  title: string
  description: string
  assignee_id: string
  status: TaskStatus
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type StatusHistory = {
  id: string
  task_id: string
  actor_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
}
