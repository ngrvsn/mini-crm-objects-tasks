'use client'

import { Button, Drawer, Layout, Menu, Space, Spin, Typography } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GuideModal } from '@/components/GuideModal'
import { logout } from '@/lib/auth/session'
import { useAuthStore } from '@/lib/store/auth'

const { Header, Content, Sider } = Layout

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { profile, status } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

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
  const menuItems = [
    { key: '/objects', label: 'Объекты' },
    ...(profile.role === 'executor'
      ? [{ key: '/my-tasks', label: 'Мои задачи' }]
      : [])
  ]
  const navigate = (key: string) => {
    setMenuOpen(false)
    router.push(key)
  }
  return (
    <Layout className="app-layout">
      <Sider width={220} className="app-sider">
        <div className="brand">Мини-CRM</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          onClick={({ key }) => navigate(key)}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header className="app-header" style={{ background: '#fff' }}>
          <div className="app-header-identity">
            <Button
              className="mobile-menu-button"
              type="text"
              aria-label="Открыть меню"
              onClick={() => setMenuOpen(true)}
            >
              <span aria-hidden="true">☰</span>
            </Button>
            <Typography.Text strong className="app-header-name">
              {profile.display_name}
            </Typography.Text>
          </div>
          <Space className="app-header-actions">
            <Button aria-label="Инструкция" onClick={() => setGuideOpen(true)}>
              <span className="guide-button-label">Инструкция</span>
              <span className="guide-button-icon" aria-hidden="true">
                ?
              </span>
            </Button>
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
      <Drawer
        title="Мини-CRM"
        placement="left"
        size={240}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        className="mobile-menu-drawer"
      >
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          onClick={({ key }) => navigate(key)}
          items={menuItems}
        />
      </Drawer>
      <GuideModal
        open={guideOpen}
        role={profile.role}
        onClose={() => setGuideOpen(false)}
      />
    </Layout>
  )
}
