'use client'

import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getCurrentProfile } from '@/lib/api/profiles'
import { login, logout } from '@/lib/auth/session'
import { errorMessage } from '@/lib/error'
import { useAuthStore } from '@/lib/store/auth'

type LoginValues = { email: string; password: string }
const subscribeToHydration = () => () => undefined
const clientHydrated = () => true
const serverHydrated = () => false

export default function LoginPage() {
  const router = useRouter()
  const status = useAuthStore((state) => state.status)
  const profile = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ready = useSyncExternalStore(
    subscribeToHydration,
    clientHydrated,
    serverHydrated
  )

  useEffect(() => {
    if (status === 'authenticated')
      router.replace(profile?.role === 'executor' ? '/my-tasks' : '/objects')
  }, [profile?.role, router, status])

  const submit = async ({ email, password }: LoginValues) => {
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      const profile = await getCurrentProfile()
      setProfile(profile)
      router.replace(profile.role === 'executor' ? '/my-tasks' : '/objects')
    } catch (caught) {
      await logout()
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <Typography.Title level={2}>Вход в мини-CRM</Typography.Title>
        <Typography.Paragraph type="secondary">
          Используйте выданные учётные данные.
        </Typography.Paragraph>
        {error && (
          <Alert type="error" title={error} showIcon className="card-spacing" />
        )}
        <Form<LoginValues> layout="vertical" onFinish={submit}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true }, { type: 'email' }]}
          >
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={busy}
            disabled={!ready}
            block
          >
            Войти
          </Button>
        </Form>
      </Card>
    </div>
  )
}
