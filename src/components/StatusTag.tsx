import { Tag } from 'antd'
import { statusColors, statusLabels } from '@/lib/status'
import type { TaskStatus } from '@/lib/types'

export function StatusTag({ status }: { status: TaskStatus }) {
  return <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
}
