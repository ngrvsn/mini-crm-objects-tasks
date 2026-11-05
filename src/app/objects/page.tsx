'use client'

import {
  Alert,
  App,
  Button,
  Form,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { ObjectFields } from '@/components/forms/ObjectFields'
import {
  createObject,
  deleteObject,
  getObjects,
  updateObject,
  type ObjectInput
} from '@/lib/api/objects'
import { errorMessage } from '@/lib/error'
import { useAuthStore } from '@/lib/store/auth'
import type { ObjectRecord } from '@/lib/types'

export default function ObjectsPage() {
  const { profile, status } = useAuthStore()
  const { message } = App.useApp()
  const [objects, setObjects] = useState<ObjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ObjectRecord | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ObjectInput>()

  const reload = async () => {
    try {
      setObjects(await getObjects())
      setError(null)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    let active = true
    getObjects()
      .then((items) => {
        if (active) {
          setObjects(items)
          setError(null)
          setLoading(false)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(errorMessage(caught))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [status])

  const openForm = (record: ObjectRecord | 'new') => {
    setEditing(record)
    form.setFieldsValue(record === 'new' ? { name: '', address: '' } : record)
  }

  const save = async (values: ObjectInput) => {
    if (!editing) return
    setSaving(true)
    try {
      if (editing === 'new') await createObject(values)
      else await updateObject(editing.id, values)
      setEditing(null)
      message.success('Объект сохранён')
      await reload()
    } catch (caught) {
      message.error(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteObject(id)
      message.success('Объект удалён')
      await reload()
    } catch (caught) {
      message.error(errorMessage(caught))
    }
  }

  const columns: ColumnsType<ObjectRecord> = [
    {
      title: 'Название',
      dataIndex: 'name',
      render: (name: string, row) => (
        <Link href={`/objects/${row.id}`}>{name}</Link>
      )
    },
    { title: 'Адрес', dataIndex: 'address' },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleDateString('ru-RU')
    },
    ...(profile?.role === 'manager'
      ? [
          {
            title: 'Действия',
            key: 'actions',
            render: (_: unknown, row: ObjectRecord) => (
              <Space>
                <Button size="small" onClick={() => openForm(row)}>
                  Изменить
                </Button>
                <Popconfirm
                  title="Удалить объект и скрыть его задачи?"
                  okText="Удалить"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void remove(row.id)}
                >
                  <Button size="small" danger>
                    Удалить
                  </Button>
                </Popconfirm>
              </Space>
            )
          }
        ]
      : [])
  ]

  return (
    <AppShell>
      <div className="page-heading">
        <Typography.Title level={1}>Объекты</Typography.Title>
        {profile?.role === 'manager' && (
          <Button type="primary" onClick={() => openForm('new')}>
            Новый объект
          </Button>
        )}
      </div>
      {error && (
        <Alert type="error" title={error} showIcon className="card-spacing" />
      )}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={objects}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        forceRender
        title={editing === 'new' ? 'Новый объект' : 'Редактировать объект'}
        open={editing !== null}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={saving}
        onOk={() => form.submit()}
        onCancel={() => setEditing(null)}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => void save(values)}
        >
          <ObjectFields />
        </Form>
      </Modal>
    </AppShell>
  )
}
