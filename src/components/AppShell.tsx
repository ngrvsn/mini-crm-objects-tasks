'use client'

import { Button, Layout, Menu, Space, Spin, Typography } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { logout } from '@/lib/auth/session'
import { useAuthStore } from '@/lib/store/auth'

const { Header, Content, Sider } = Layout

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { profile, status } = useAuthStore()

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login')
  }, [router, status])

  if (status !== 'authenticated' || !profile) {
    return (
      <div className="centered">
        <Spin size="large" />
      </div>
    )
  }

  const selected = pathname.startsWith('/my-tasks') ? '/my-tasks' : '/objects'
  return (
    <Layout className="app-layout">
      <Sider breakpoint="lg" collapsedWidth="0" className="app-sider">
        <div className="brand">Мини-CRM</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          onClick={({ key }) => router.push(key)}
          items={[
            { key: '/objects', label: 'Объекты' },
            ...(profile.role === 'executor'
              ? [{ key: '/my-tasks', label: 'Мои задачи' }]
              : [])
          ]}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Text strong>{profile.display_name}</Typography.Text>
          <Space>
            <Typography.Text type="secondary">
              {profile.role === 'manager' ? 'Постановщик' : 'Исполнитель'}
            </Typography.Text>
            <Button
              onClick={async () => {
                await logout()
                router.replace('/login')
              }}
            >
              Выйти
            </Button>
          </Space>
        </Header>
        <Content className="app-content">{children}</Content>
      </Layout>
    </Layout>
  )
}
