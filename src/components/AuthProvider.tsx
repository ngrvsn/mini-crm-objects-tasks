'use client'

import { useEffect } from 'react'
import { getCurrentProfile } from '@/lib/api/profiles'
import { bootstrapSession, initializeSessionSync } from '@/lib/auth/session'
import { useAuthStore } from '@/lib/store/auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setProfile = useAuthStore((state) => state.setProfile)
  const setAnonymous = useAuthStore((state) => state.setAnonymous)

  useEffect(() => {
    let mounted = true
    let generation = 0
    const load = async () => {
      const currentGeneration = ++generation
      try {
        if (!(await bootstrapSession())) {
          if (mounted && currentGeneration === generation) setAnonymous()
          return
        }
        const profile = await getCurrentProfile()
        if (mounted && currentGeneration === generation) setProfile(profile)
      } catch {
        if (mounted && currentGeneration === generation) setAnonymous()
      }
    }
    const onChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === 'logout') {
        generation += 1
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
      generation += 1
      window.removeEventListener('crm-auth-change', onChange)
      dispose()
    }
  }, [setAnonymous, setProfile])

  return children
}
