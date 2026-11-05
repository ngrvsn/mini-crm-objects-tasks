import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'standalone',
  reactStrictMode: true,
  turbopack: { root: process.cwd() }
}

export default nextConfig
