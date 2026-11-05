import { Form, Input, Select } from 'antd'
import type { ObjectRecord, Profile } from '@/lib/types'

export function TaskFields({
  profiles,
  objects
}: {
  profiles: Profile[]
  objects?: ObjectRecord[]
}) {
  return (
    <>
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
      {objects && (
        <Form.Item name="object_id" label="Объект" rules={[{ required: true }]}>
          <Select
            options={objects.map((item) => ({
              value: item.id,
              label: item.name
            }))}
          />
        </Form.Item>
      )}
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
    </>
  )
}
