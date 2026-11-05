import { privateApi } from './client'
import type { ObjectRecord } from '@/lib/types'

export type ObjectInput = { name: string; address: string }

export async function getObjects(): Promise<ObjectRecord[]> {
  const { data } = await privateApi.get<ObjectRecord[]>('/objects', {
    params: { select: '*', order: 'created_at.desc' }
  })
  return data
}

export async function getObject(id: string): Promise<ObjectRecord | null> {
  const { data } = await privateApi.get<ObjectRecord[]>('/objects', {
    params: { select: '*', id: `eq.${id}`, limit: 1 }
  })
  return data[0] ?? null
}

export async function createObject(input: ObjectInput): Promise<ObjectRecord> {
  const { data } = await privateApi.post<ObjectRecord>('/rpc/create_object', {
    p_name: input.name,
    p_address: input.address
  })
  return data
}

export async function updateObject(
  id: string,
  input: ObjectInput
): Promise<ObjectRecord> {
  const { data } = await privateApi.post<ObjectRecord>('/rpc/update_object', {
    p_id: id,
    p_name: input.name,
    p_address: input.address
  })
  return data
}

export async function deleteObject(id: string): Promise<void> {
  await privateApi.post('/rpc/delete_object', { p_id: id })
}
