import axios from 'axios'
import { AutoComplete, Form, Input, Typography } from 'antd'
import { useEffect, useState } from 'react'

type PhotonFeature = {
  properties: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    district?: string
    state?: string
    country?: string
  }
}

function formatAddress({ properties: address }: PhotonFeature): string {
  const street = [address.street, address.housenumber]
    .filter(Boolean)
    .join(', ')
  const parts = [
    address.country,
    address.state,
    address.city,
    address.district,
    street || address.name
  ]
  return parts
    .filter((part): part is string => Boolean(part))
    .filter(
      (part, index, all) =>
        all.findIndex((other) => other.toLowerCase() === part.toLowerCase()) ===
        index
    )
    .join(', ')
}

function AddressField({
  id,
  value,
  onChange
}: {
  id?: string
  value?: string
  onChange?: (value: string) => void
}) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<{ value: string }[]>([])

  useEffect(() => {
    if (query.length < 3) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await axios.get<{ features: PhotonFeature[] }>(
          'https://photon.komoot.io/api/',
          {
            params: { q: query, limit: 5 },
            signal: controller.signal,
            timeout: 5000
          }
        )
        setOptions(
          [...new Set(data.features.map(formatAddress).filter(Boolean))].map(
            (value) => ({ value })
          )
        )
      } catch {
        if (!controller.signal.aborted) setOptions([])
      }
    }, 400)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <>
      <AutoComplete
        id={id}
        value={value}
        options={options}
        filterOption={false}
        onChange={onChange}
        onSearch={(value) => {
          setQuery(value.trim())
          if (value.trim().length < 3) setOptions([])
        }}
        onSelect={() => {
          setQuery('')
          setOptions([])
        }}
        placeholder="Начните вводить адрес"
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Подсказки: ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
        . Можно ввести адрес вручную.
      </Typography.Text>
    </>
  )
}

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
        <AddressField />
      </Form.Item>
    </>
  )
}
