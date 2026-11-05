'use client'

import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { StatusTag } from '@/components/StatusTag'
import { ObjectFields } from '@/components/forms/ObjectFields'
import { TaskFields } from '@/components/forms/TaskFields'
import {
  deleteObject,
  getObject,
  updateObject,
  type ObjectInput
} from '@/lib/api/objects'
import { getProfiles } from '@/lib/api/profiles'
import { createTask, getTasks, type TaskInput } from '@/lib/api/tasks'
import { errorMessage } from '@/lib/error'
import { useAuthStore } from '@/lib/store/auth'
import type { ObjectRecord, Profile, Task } from '@/lib/types'

type TaskFormValues = Omit<TaskInput, 'object_id'>

export default function ObjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile, status } = useAuthStore()
  const { message } = App.useApp()
  const [object, setObject] = useState<ObjectRecord | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taskModal, setTaskModal] = useState(false)
  const [objectModal, setObjectModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [taskForm] = Form.useForm<TaskFormValues>()
  const [objectForm] = Form.useForm<ObjectInput>()

  const reload = async () => {
    try {
      const [nextObject, nextTasks, nextProfiles] = await Promise.all([
        getObject(id),
        getTasks(id),
        getProfiles()
      ])
      setObject(nextObject)
      setTasks(nextTasks)
      setProfiles(nextProfiles)
      setError(nextObject ? null : 'Объект не найден или нет доступа')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    let active = true
    Promise.all([getObject(id), getTasks(id), getProfiles()])
      .then(([nextObject, nextTasks, nextProfiles]) => {
        if (!active) return
        setObject(nextObject)
        setTasks(nextTasks)
        setProfiles(nextProfiles)
        setError(nextObject ? null : 'Объект не найден или нет доступа')
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, status])

  const saveObject = async (values: ObjectInput) => {
    setSaving(true)
    try {
      await updateObject(id, values)
      setObjectModal(false)
      message.success('Объект обновлён')
      await reload()
    } catch (caught) {
      message.error(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  const saveTask = async (values: TaskFormValues) => {
    setSaving(true)
    try {
      await createTask({ ...values, object_id: id })
      setTaskModal(false)
      taskForm.resetFields()
      message.success('Задача создана')
      await reload()
    } catch (caught) {
      message.error(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  const removeObject = async () => {
    try {
      await deleteObject(id)
      router.replace('/objects')
    } catch (caught) {
      message.error(errorMessage(caught))
    }
  }

  const nameOf = (userId: string) =>
    profiles.find((item) => item.id === userId)?.display_name ?? userId
  const columns: ColumnsType<Task> = [
    {
      title: 'Задача',
      dataIndex: 'title',
      render: (title: string, row) => (
        <Link href={`/tasks/${row.id}`}>{title}</Link>
      )
    },
    { title: 'Исполнитель', dataIndex: 'assignee_id', render: nameOf },
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
      <Link href="/objects">← К объектам</Link>
      {loading ? (
        <div className="centered">
          <Spin />
        </div>
      ) : (
        object && (
          <>
            <div className="page-heading">
              <div>
                <Typography.Title level={1}>{object.name}</Typography.Title>
                <Typography.Text type="secondary">
                  {object.address}
                </Typography.Text>
              </div>
              {profile?.role === 'manager' && (
                <Space>
                  <Button
                    onClick={() => {
                      objectForm.setFieldsValue(object)
                      setObjectModal(true)
                    }}
                  >
                    Изменить
                  </Button>
                  <Popconfirm
                    title="Удалить объект и скрыть его задачи?"
                    okText="Удалить"
                    cancelText="Отмена"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => void removeObject()}
                  >
                    <Button danger>Удалить</Button>
                  </Popconfirm>
                </Space>
              )}
            </div>
            <Card
              title="Задачи"
              extra={
                profile?.role === 'manager' && (
                  <Button type="primary" onClick={() => setTaskModal(true)}>
                    Новая задача
                  </Button>
                )
              }
            >
              <Table
                rowKey="id"
                columns={columns}
                dataSource={tasks}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 'max-content' }}
              />
            </Card>
          </>
        )
      )}
      {error && <Alert type="error" title={error} showIcon />}

      <Modal
        forceRender
        title="Новая задача"
        open={taskModal}
        onCancel={() => {
          setTaskModal(false)
          taskForm.resetFields()
        }}
        onOk={() => taskForm.submit()}
        confirmLoading={saving}
        okText="Создать"
        cancelText="Отмена"
      >
        <Form
          form={taskForm}
          layout="vertical"
          onFinish={(values) => void saveTask(values)}
          initialValues={{ description: '' }}
        >
          <TaskFields profiles={profiles} />
        </Form>
      </Modal>
      <Modal
        forceRender
        title="Изменить объект"
        open={objectModal}
        onCancel={() => setObjectModal(false)}
        onOk={() => objectForm.submit()}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form
          form={objectForm}
          layout="vertical"
          onFinish={(values) => void saveObject(values)}
        >
          <ObjectFields />
        </Form>
      </Modal>
    </AppShell>
  )
}
