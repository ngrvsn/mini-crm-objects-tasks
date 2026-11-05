import assert from 'node:assert/strict'
import axios from 'axios'
import { localSupabase } from './local-supabase.mjs'

const { url, publishableKey } = localSupabase()
const password = 'LocalTestPassw0rd!'
const auth = async (email) => {
  const { data } = await axios.post(
    `${url}/auth/v1/token?grant_type=password`,
    { email, password },
    { headers: { apikey: publishableKey } }
  )
  return { token: data.access_token, id: data.user.id }
}
const manager = await auth('manager1@example.test')
const worker1 = await auth('worker1@example.test')
const worker2 = await auth('worker2@example.test')
const client = (token) =>
  axios.create({
    baseURL: `${url}/rest/v1`,
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
    validateStatus: () => true
  })
const managerApi = client(manager.token)
const workerApi = client(worker1.token)
const anonymousApi = axios.create({
  baseURL: `${url}/rest/v1`,
  headers: { apikey: publishableKey },
  validateStatus: () => true
})

const managerTasks = (
  await managerApi.get('/tasks?select=id,assignee_id,status,object_id')
).data
const workerTasks = (
  await workerApi.get('/tasks?select=id,assignee_id,status,object_id')
).data
assert(managerTasks.length >= 4)
assert(workerTasks.length > 0)
assert(workerTasks.every((task) => task.assignee_id === worker1.id))
assert(workerTasks.length < managerTasks.length)
const workerObjects = (await workerApi.get('/objects?select=id')).data
assert(
  workerObjects.every((object) =>
    workerTasks.some((task) => task.object_id === object.id)
  )
)

const foreignTask = managerTasks.find((task) => task.assignee_id === worker2.id)
const ownTask = workerTasks.find((task) => task.status === 'in_progress')
assert(foreignTask && ownTask)
const history = (await workerApi.get('/task_status_history?select=task_id'))
  .data
assert(
  history.every((event) =>
    workerTasks.some((task) => task.id === event.task_id)
  )
)
assert((await anonymousApi.get('/tasks?select=id')).status >= 400)
assert(
  (await workerApi.get(`/tasks?select=id&id=eq.${foreignTask.id}`)).data
    .length === 0
)
assert(
  (
    await workerApi.post('/rpc/create_object', {
      p_name: 'Forbidden',
      p_address: 'Anywhere'
    })
  ).status >= 400
)
assert(
  (
    await workerApi.post('/rpc/transition_task', {
      p_id: foreignTask.id,
      p_to_status: 'in_progress'
    })
  ).status >= 400
)
assert(
  (await workerApi.patch(`/tasks?id=eq.${ownTask.id}`, { status: 'accepted' }))
    .status >= 400
)
assert(
  (
    await workerApi.post('/task_status_history', {
      task_id: ownTask.id,
      actor_id: worker1.id,
      to_status: 'accepted'
    })
  ).status >= 400
)
assert(
  (await workerApi.delete(`/task_status_history?task_id=eq.${ownTask.id}`))
    .status >= 400
)
assert(
  (
    await managerApi.post('/rpc/transition_task', {
      p_id: ownTask.id,
      p_to_status: 'accepted'
    })
  ).status >= 400
)

const review = managerTasks.find((task) => task.status === 'revision')
assert(review)
assert(
  (
    await managerApi.post('/rpc/transition_task', {
      p_id: review.id,
      p_to_status: 'accepted'
    })
  ).status >= 400
)

const created = await managerApi.post('/rpc/create_task', {
  p_object_id: ownTask.object_id,
  p_title: `RLS transition test ${Date.now()}`,
  p_description: '',
  p_assignee_id: worker1.id
})
assert.equal(created.status, 200)
const testId = created.data.id
assert.equal(
  (
    await workerApi.post('/rpc/transition_task', {
      p_id: testId,
      p_to_status: 'in_progress'
    })
  ).status,
  200
)
assert.equal(
  (
    await workerApi.post('/rpc/transition_task', {
      p_id: testId,
      p_to_status: 'review'
    })
  ).status,
  200
)
assert(
  (
    await managerApi.post('/rpc/transition_task', {
      p_id: testId,
      p_to_status: 'revision',
      p_comment: '   '
    })
  ).status >= 400
)
assert.equal(
  (
    await managerApi.post('/rpc/transition_task', {
      p_id: testId,
      p_to_status: 'revision',
      p_comment: 'Исправить отчёт'
    })
  ).status,
  200
)
const testHistory = (
  await workerApi.get(
    `/task_status_history?select=from_status,to_status,comment&task_id=eq.${testId}&order=created_at.asc`
  )
).data
assert.deepEqual(
  testHistory.map((event) => event.to_status),
  ['new', 'in_progress', 'review', 'revision']
)
assert.equal(testHistory.at(-1).comment, 'Исправить отчёт')

console.log('Direct Data API security checks passed')
