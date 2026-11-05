'use client'

import { useEffect } from 'react'
import { getCurrentProfile } from '@/lib/api/crm'
import { bootstrapSession, initializeSessionSync } from '@/lib/auth/session'
import { useAuthStore } from '@/lib/store/auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setProfile = useAuthStore((state) => state.setProfile)
  const setAnonymous = useAuthStore((state) => state.setAnonymous)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        if (!(await bootstrapSession())) {
          if (mounted) setAnonymous()
          return
        }
        const profile = await getCurrentProfile()
        if (mounted) setProfile(profile)
      } catch {
        if (mounted) setAnonymous()
      }
    }
    const onChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === 'logout') {
        setAnonymous()
      } else {
        void load()
      }
    }
    const dispose = initializeSessionSync()
    window.addEventListener('crm-auth-change', onChange)
    void load()
    return () => {
      mounted = false
      window.removeEventListener('crm-auth-change', onChange)
      dispose()
    }
  }, [setAnonymous, setProfile])

  return children
}
