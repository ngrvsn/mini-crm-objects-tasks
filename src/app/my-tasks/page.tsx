'use client'

import { Alert, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { StatusTag } from '@/components/StatusTag'
import { getObjects, getTasks } from '@/lib/api/crm'
import { errorMessage } from '@/lib/error'
import { useAuthStore } from '@/lib/store/auth'
import type { ObjectRecord, Task } from '@/lib/types'

export default function MyTasksPage() {
  const { profile, status } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [objects, setObjects] = useState<ObjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || profile?.role !== 'executor') return
    Promise.all([getTasks(undefined, profile.id), getObjects()])
      .then(([nextTasks, nextObjects]) => {
        setTasks(nextTasks)
        setObjects(nextObjects)
      })
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false))
  }, [profile?.id, profile?.role, status])

  const columns: ColumnsType<Task> = [
    {
      title: 'Задача',
      dataIndex: 'title',
      render: (title: string, row) => (
        <Link href={`/tasks/${row.id}`}>{title}</Link>
      )
    },
    {
      title: 'Объект',
      dataIndex: 'object_id',
      render: (id: string) => {
        const object = objects.find((item) => item.id === id)
        return object ? <Link href={`/objects/${id}`}>{object.name}</Link> : id
      }
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      render: (value: Task['status']) => <StatusTag status={value} />
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleDateString('ru-RU')
    }
  ]

  return (
    <AppShell>
      <div className="page-heading">
        <Typography.Title level={1}>Мои задачи</Typography.Title>
      </div>
      {profile?.role === 'manager' ? (
        <Alert type="info" message="Этот раздел предназначен исполнителям" />
      ) : (
        <>
          {error && (
            <Alert
              type="error"
              message={error}
              showIcon
              className="card-spacing"
            />
          )}
          <Table
            rowKey="id"
            columns={columns}
            dataSource={tasks}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </>
      )}
    </AppShell>
  )
}
