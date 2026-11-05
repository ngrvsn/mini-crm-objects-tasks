'use client'

import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Timeline,
  Typography
} from 'antd'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { StatusTag } from '@/components/StatusTag'
import {
  deleteTask,
  getHistory,
  getObjects,
  getProfiles,
  getTask,
  transitionTask,
  updateTask,
  type TaskInput
} from '@/lib/api/crm'
import { errorMessage } from '@/lib/error'
import { availableTransitions, statusLabels } from '@/lib/status'
import { useAuthStore } from '@/lib/store/auth'
import type {
  ObjectRecord,
  Profile,
  StatusHistory,
  Task,
  TaskStatus
} from '@/lib/types'

export default function TaskPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile, status } = useAuthStore()
  const { message } = App.useApp()
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<StatusHistory[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [objects, setObjects] = useState<ObjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [revisionModal, setRevisionModal] = useState(false)
  const [editForm] = Form.useForm<TaskInput>()
  const [revisionForm] = Form.useForm<{ comment: string }>()

  const reload = async () => {
    setLoading(true)
    try {
      const [nextTask, nextHistory, nextProfiles, nextObjects] =
        await Promise.all([
          getTask(id),
          getHistory(id),
          getProfiles(),
          getObjects()
        ])
      setTask(nextTask)
      setHistory(nextHistory)
      setProfiles(nextProfiles)
      setObjects(nextObjects)
      setError(nextTask ? null : 'Задача не найдена или нет доступа')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    let active = true
    Promise.all([getTask(id), getHistory(id), getProfiles(), getObjects()])
      .then(([nextTask, nextHistory, nextProfiles, nextObjects]) => {
        if (!active) return
        setTask(nextTask)
        setHistory(nextHistory)
        setProfiles(nextProfiles)
        setObjects(nextObjects)
        setError(nextTask ? null : 'Задача не найдена или нет доступа')
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

  const nameOf = (userId: string) =>
    profiles.find((item) => item.id === userId)?.display_name ?? userId
  const object = objects.find((item) => item.id === task?.object_id)
  const actions = profile && task ? availableTransitions(profile, task) : []

  const transition = async (nextStatus: TaskStatus, comment?: string) => {
    setBusy(true)
    try {
      await transitionTask(id, nextStatus, comment)
      setRevisionModal(false)
      revisionForm.resetFields()
      message.success(`Статус: ${statusLabels[nextStatus]}`)
      await reload()
    } catch (caught) {
      message.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const save = async (values: TaskInput) => {
    setBusy(true)
    try {
      await updateTask(id, values)
      setEditing(false)
      message.success('Задача обновлена')
      await reload()
    } catch (caught) {
      message.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!task) return
    try {
      await deleteTask(id)
      router.replace(`/objects/${task.object_id}`)
    } catch (caught) {
      message.error(errorMessage(caught))
    }
  }

  return (
    <AppShell>
      {task && <Link href={`/objects/${task.object_id}`}>← К объекту</Link>}
      {loading ? (
        <div className="centered">
          <Spin />
        </div>
      ) : (
        task && (
          <>
            <div className="page-heading">
              <Typography.Title level={1}>{task.title}</Typography.Title>
              {profile?.role === 'manager' && (
                <Space>
                  <Button
                    onClick={() => {
                      editForm.setFieldsValue({
                        title: task.title,
                        description: task.description,
                        object_id: task.object_id,
                        assignee_id: task.assignee_id
                      })
                      setEditing(true)
                    }}
                  >
                    Изменить
                  </Button>
                  <Popconfirm
                    title="Удалить задачу? История сохранится."
                    onConfirm={() => void remove()}
                  >
                    <Button danger>Удалить</Button>
                  </Popconfirm>
                </Space>
              )}
            </div>
            <Card className="card-spacing">
              <Descriptions column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Объект">
                  {object ? (
                    <Link href={`/objects/${object.id}`}>{object.name}</Link>
                  ) : (
                    task.object_id
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Статус">
                  <StatusTag status={task.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Исполнитель">
                  {nameOf(task.assignee_id)}
                </Descriptions.Item>
                <Descriptions.Item label="Автор">
                  {nameOf(task.created_by)}
                </Descriptions.Item>
                <Descriptions.Item label="Создана">
                  {new Date(task.created_at).toLocaleString('ru-RU')}
                </Descriptions.Item>
                <Descriptions.Item label="Описание">
                  <span className="task-description">
                    {task.description || 'Нет описания'}
                  </span>
                </Descriptions.Item>
              </Descriptions>
              {actions.length > 0 && (
                <Space wrap>
                  {actions.map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      type={
                        nextStatus === 'accepted' || nextStatus === 'review'
                          ? 'primary'
                          : 'default'
                      }
                      loading={busy}
                      onClick={() =>
                        nextStatus === 'revision'
                          ? setRevisionModal(true)
                          : void transition(nextStatus)
                      }
                    >
                      {nextStatus === 'in_progress'
                        ? 'Взять в работу'
                        : nextStatus === 'review'
                          ? 'Отправить на проверку'
                          : nextStatus === 'accepted'
                            ? 'Принять'
                            : 'Вернуть на доработку'}
                    </Button>
                  ))}
                </Space>
              )}
            </Card>
            <Card title="История статусов">
              <Timeline
                items={history.map((event) => ({
                  content: (
                    <div>
                      <strong>
                        {event.from_status
                          ? statusLabels[event.from_status]
                          : 'Создание'}{' '}
                        → {statusLabels[event.to_status]}
                      </strong>
                      <div>
                        {nameOf(event.actor_id)} ·{' '}
                        {new Date(event.created_at).toLocaleString('ru-RU')}
                      </div>
                      {event.comment && (
                        <Typography.Paragraph className="task-description">
                          {event.comment}
                        </Typography.Paragraph>
                      )}
                    </div>
                  )
                }))}
              />
            </Card>
          </>
        )
      )}
      {error && <Alert type="error" message={error} showIcon />}

      <Modal
        forceRender
        title="Редактировать задачу"
        open={editing}
        onCancel={() => setEditing(false)}
        onOk={() => editForm.submit()}
        confirmLoading={busy}
        okText="Сохранить"
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => void save(values)}
        >
          <Form.Item
            name="title"
            label="Название"
            rules={[{ required: true, whitespace: true, max: 200 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            name="object_id"
            label="Объект"
            rules={[{ required: true }]}
          >
            <Select
              options={objects.map((item) => ({
                value: item.id,
                label: item.name
              }))}
            />
          </Form.Item>
          <Form.Item
            name="assignee_id"
            label="Исполнитель"
            rules={[{ required: true }]}
          >
            <Select
              options={profiles
                .filter((item) => item.role === 'executor')
                .map((item) => ({ value: item.id, label: item.display_name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        forceRender
        title="Вернуть на доработку"
        open={revisionModal}
        onCancel={() => setRevisionModal(false)}
        onOk={() => revisionForm.submit()}
        confirmLoading={busy}
        okText="Вернуть"
      >
        <Form
          form={revisionForm}
          layout="vertical"
          onFinish={(values) => void transition('revision', values.comment)}
        >
          <Form.Item
            name="comment"
            label="Комментарий"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Укажите, что исправить'
              }
            ]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </AppShell>
  )
}
