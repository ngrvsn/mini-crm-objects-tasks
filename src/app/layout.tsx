import type { Metadata } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { App as AntdApp, ConfigProvider } from 'antd'
import { AuthProvider } from '@/components/AuthProvider'
import './styles.css'

export const metadata: Metadata = {
  title: 'Мини-CRM — Объекты и задачи',
  description: 'Задачи по строительным объектам'
}

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <AntdRegistry>
          <ConfigProvider
            theme={{ token: { colorPrimary: '#205ca8', borderRadius: 8 } }}
          >
            <AntdApp>
              <AuthProvider>{children}</AuthProvider>
            </AntdApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
