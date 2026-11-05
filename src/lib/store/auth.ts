import { create } from 'zustand'
import type { Profile } from '@/lib/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthState = {
  profile: Profile | null
  status: AuthStatus
  setProfile: (profile: Profile) => void
  setAnonymous: () => void
  setLoading: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  status: 'loading',
  setProfile: (profile) => set({ profile, status: 'authenticated' }),
  setAnonymous: () => set({ profile: null, status: 'anonymous' }),
  setLoading: () => set({ profile: null, status: 'loading' })
}))
