import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import axios from 'axios'

const origin = process.env.CRM_PUBLIC_ORIGIN ?? 'https://120nmine.tech'
const supabaseUrl = process.env.CRM_SUPABASE_URL
const key = process.env.CRM_SUPABASE_PUBLISHABLE_KEY
const accountsPath = process.env.CRM_DEMO_ACCOUNTS_FILE
assert(
  supabaseUrl && key && accountsPath,
  'Set CRM Supabase and account env vars'
)
const accounts = JSON.parse(readFileSync(accountsPath, 'utf8'))
const manager = accounts.find((item) => item.role === 'manager')
const workers = accounts.filter((item) => item.role === 'executor')
assert(manager && workers.length === 2)

const publicApi = axios.create({
  baseURL: `${origin}/crm/api/auth`,
  validateStatus: () => true
})
const denied = await publicApi.post('/refresh', null, {
  headers: { Origin: 'https://attacker.example' }
})
assert.equal(denied.status, 403)
const login = await publicApi.post('/login', manager, {
  headers: { Origin: origin }
})
assert.equal(login.status, 200)
const cookie = login.headers['set-cookie']?.[0]
assert(cookie?.includes('__Secure-crm-refresh='))
assert(cookie.includes('Path=/crm/api/auth'))
assert(/HttpOnly/i.test(cookie))
assert(/Secure/i.test(cookie))
assert(/SameSite=Strict/i.test(cookie))
const refresh = await publicApi.post('/refresh', null, {
  headers: { Origin: origin, Cookie: cookie.split(';')[0] }
})
assert.equal(refresh.status, 200)
assert(refresh.data.accessToken)
const logout = await publicApi.post('/logout', null, {
  headers: {
    Origin: origin,
    Cookie: refresh.headers['set-cookie']?.[0]?.split(';')[0]
  }
})
assert.equal(logout.status, 200)

async function authenticate(account) {
  const response = await axios.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    { email: account.email, password: account.password },
    { headers: { apikey: key } }
  )
  return {
    id: response.data.user.id,
    api: axios.create({
      baseURL: `${supabaseUrl}/rest/v1`,
      headers: {
        apikey: key,
        Authorization: `Bearer ${response.data.access_token}`
      },
      validateStatus: () => true
    })
  }
}
const managerUser = await authenticate(manager)
const worker1 = await authenticate(workers[0])
const worker2 = await authenticate(workers[1])
const managerTasks = (
  await managerUser.api.get('/tasks?select=id,assignee_id,status,object_id')
).data
const worker1Tasks = (
  await worker1.api.get('/tasks?select=id,assignee_id,status,object_id')
).data
const worker2Tasks = (
  await worker2.api.get('/tasks?select=id,assignee_id,status,object_id')
).data
assert(managerTasks.length >= 2 && worker1Tasks.length && worker2Tasks.length)
assert(worker1Tasks.every((task) => task.assignee_id === worker1.id))
assert(worker2Tasks.every((task) => task.assignee_id === worker2.id))
const foreign = worker2Tasks[0]
const own = worker1Tasks[0]
assert.equal(
  (await worker1.api.get(`/tasks?select=id&id=eq.${foreign.id}`)).data.length,
  0
)
assert.equal(
  (
    await worker1.api.get(
      `/task_status_history?select=id&task_id=eq.${foreign.id}`
    )
  ).data.length,
  0
)
assert(
  (
    await worker1.api.post('/rpc/transition_task', {
      p_id: foreign.id,
      p_to_status: 'in_progress'
    })
  ).status >= 400
)
assert(
  (await worker1.api.patch(`/tasks?id=eq.${own.id}`, { status: 'accepted' }))
    .status >= 400
)
assert(
  (
    await managerUser.api.patch(`/tasks?id=eq.${own.id}`, {
      status: 'accepted'
    })
  ).status >= 400
)
assert(
  (
    await worker1.api.post('/task_status_history', {
      task_id: own.id,
      actor_id: worker1.id,
      to_status: 'accepted'
    })
  ).status >= 400
)
assert(
  (
    await worker1.api.patch(`/profiles?id=eq.${worker1.id}`, {
      role: 'manager'
    })
  ).status >= 400
)
assert(
  (
    await worker1.api.post('/rpc/create_object', {
      p_name: 'Forbidden',
      p_address: 'Anywhere'
    })
  ).status >= 400
)
console.log('Deployed auth, cookie and direct Supabase RLS checks passed')
