import { Form, Input } from 'antd'

export function ObjectFields() {
  return (
    <>
      <Form.Item
        label="Название"
        name="name"
        rules={[{ required: true, whitespace: true, max: 200 }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Адрес"
        name="address"
        rules={[{ required: true, whitespace: true, max: 300 }]}
      >
        <Input />
      </Form.Item>
    </>
  )
}
