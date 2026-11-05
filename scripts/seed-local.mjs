import axios from 'axios'
import { localSupabase } from './local-supabase.mjs'

const { url, publishableKey, serviceKey } = localSupabase()
const admin = axios.create({
  baseURL: url,
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
})
const password = 'LocalTestPassw0rd!'
const accounts = [
  { email: 'manager1@example.test', name: 'Постановщик 1', role: 'manager' },
  { email: 'manager2@example.test', name: 'Постановщик 2', role: 'manager' },
  { email: 'worker1@example.test', name: 'Исполнитель 1', role: 'executor' },
  { email: 'worker2@example.test', name: 'Исполнитель 2', role: 'executor' }
]

const { data: listed } = await admin.get('/auth/v1/admin/users?per_page=100')
const users = {}
for (const account of accounts) {
  let user = listed.users.find((item) => item.email === account.email)
  if (!user) {
    const { data } = await admin.post('/auth/v1/admin/users', {
      email: account.email,
      password,
      email_confirm: true
    })
    user = data
  }
  users[account.email] = user.id
  await admin.post(
    '/rest/v1/profiles?on_conflict=id',
    {
      id: user.id,
      display_name: account.name,
      role: account.role
    },
    { headers: { Prefer: 'resolution=merge-duplicates' } }
  )
}

async function login(email) {
  const { data } = await axios.post(
    `${url}/auth/v1/token?grant_type=password`,
    { email, password },
    { headers: { apikey: publishableKey } }
  )
  return axios.create({
    baseURL: `${url}/rest/v1`,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${data.access_token}`
    }
  })
}
const manager = await login('manager1@example.test')
const worker1 = await login('worker1@example.test')
const worker2 = await login('worker2@example.test')

async function rpc(client, name, args) {
  const { data } = await client.post(`/rpc/${name}`, args)
  return data
}

const { data: existing } = await manager.get('/objects?select=id&limit=1')
if (existing.length === 0) {
  const sites = []
  for (const [name, address] of [
    ['ЖК Северный', 'Москва, ул. Северная, 10'],
    ['Школа № 8', 'Москва, ул. Школьная, 8'],
    ['Бизнес-центр Восток', 'Москва, Восточный проспект, 3']
  ]) {
    sites.push(
      await rpc(manager, 'create_object', { p_name: name, p_address: address })
    )
  }
  const first = await rpc(manager, 'create_task', {
    p_object_id: sites[0].id,
    p_title: 'Проверить фундамент',
    p_description: 'Сверить отметки и подготовить фотоотчёт',
    p_assignee_id: users['worker1@example.test']
  })
  await rpc(manager, 'create_task', {
    p_object_id: sites[0].id,
    p_title: 'Подготовить смету',
    p_description: 'Обновить стоимость материалов',
    p_assignee_id: users['worker2@example.test']
  })
  const third = await rpc(manager, 'create_task', {
    p_object_id: sites[1].id,
    p_title: 'Проверить электрику',
    p_description: 'Составить акт осмотра',
    p_assignee_id: users['worker1@example.test']
  })
  const fourth = await rpc(manager, 'create_task', {
    p_object_id: sites[2].id,
    p_title: 'Сдать вентиляцию',
    p_description: 'Передать результат на проверку',
    p_assignee_id: users['worker2@example.test']
  })
  await rpc(worker1, 'transition_task', {
    p_id: first.id,
    p_to_status: 'in_progress'
  })
  await rpc(worker1, 'transition_task', {
    p_id: third.id,
    p_to_status: 'in_progress'
  })
  await rpc(worker1, 'transition_task', {
    p_id: third.id,
    p_to_status: 'review'
  })
  await rpc(manager, 'transition_task', {
    p_id: third.id,
    p_to_status: 'revision',
    p_comment: 'Приложить фото щита'
  })
  await rpc(worker2, 'transition_task', {
    p_id: fourth.id,
    p_to_status: 'in_progress'
  })
  await rpc(worker2, 'transition_task', {
    p_id: fourth.id,
    p_to_status: 'review'
  })
  await rpc(manager, 'transition_task', {
    p_id: fourth.id,
    p_to_status: 'accepted'
  })
  console.log('Local CRM seed created: 3 objects, 4 tasks, 4 users')
} else {
  console.log('Local CRM seed already exists')
}
