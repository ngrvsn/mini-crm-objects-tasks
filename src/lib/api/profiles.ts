import { privateApi } from './client'
import type { Profile } from '@/lib/types'

export async function getCurrentProfile(): Promise<Profile> {
  const { data } = await privateApi.post<Profile>('/rpc/current_profile', {})
  if (!data?.id) throw new Error('У пользователя не назначена роль')
  return data
}

export async function getProfiles(): Promise<Profile[]> {
  const { data } = await privateApi.get<Profile[]>('/profiles', {
    params: {
      select: 'id,display_name,role,created_at',
      order: 'display_name.asc'
    }
  })
  return data
}
