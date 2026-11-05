import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import axios from 'axios'

const url = process.env.CRM_SUPABASE_URL
const key = process.env.CRM_SUPABASE_PUBLISHABLE_KEY
const accountsPath = process.env.CRM_DEMO_ACCOUNTS_FILE
assert(url && key && accountsPath, 'Set CRM Supabase and demo account env vars')

const accounts = JSON.parse(readFileSync(accountsPath, 'utf8'))
const managerAccount = accounts.find((item) => item.role === 'manager')
const workerAccounts = accounts.filter((item) => item.role === 'executor')
assert(managerAccount && workerAccounts.length === 2)

async function signIn(account) {
  const { data } = await axios.post(
    `${url}/auth/v1/token?grant_type=password`,
    { email: account.email, password: account.password },
    { headers: { apikey: key }, timeout: 10000 }
  )
  return {
    id: data.user.id,
    api: axios.create({
      baseURL: `${url}/rest/v1`,
      headers: { apikey: key, Authorization: `Bearer ${data.access_token}` },
      timeout: 10000
    })
  }
}

const manager = await signIn(managerAccount)
const workers = await Promise.all(workerAccounts.map(signIn))
const workerByName = new Map(
  workerAccounts.map((account, index) => [account.name, workers[index]])
)
const { data: objects } = await manager.api.get('/objects?select=id,name')
const { data: tasks } = await manager.api.get(
  '/tasks?select=id,title,object_id'
)
const objectByName = new Map(objects.map((object) => [object.name, object.id]))

const plans = [
  {
    object: 'Бизнес-центр Восток',
    title: 'Проверить пожарную сигнализацию',
    description:
      'Проверить датчики на этажах и передать результаты на проверку.',
    worker: 'Исполнитель 1',
    status: 'review'
  },
  {
    object: 'Бизнес-центр Восток',
    title: 'Доработать отделку входной группы',
    description: 'Исправить замечания по стыкам и окраске входной группы.',
    worker: 'Исполнитель 2',
    status: 'revision',
    comment: 'Исправить примыкания у входных дверей и приложить фото.'
  },
  {
    object: 'Бизнес-центр Восток',
    title: 'Согласовать график монтажа лифтов',
    description: 'Подготовить сроки монтажа и согласовать их с подрядчиком.',
    worker: 'Исполнитель 1',
    status: 'new'
  },
  {
    object: 'ЖК Северный',
    title: 'Проверить гидроизоляцию подвала',
    description: 'Проверить швы и оформить результат осмотра.',
    worker: 'Исполнитель 2',
    status: 'review'
  },
  {
    object: 'ЖК Северный',
    title: 'Уточнить ведомость окон',
    description: 'Сверить размеры окон по секциям с проектом.',
    worker: 'Исполнитель 1',
    status: 'revision',
    comment: 'Сверить размеры окон в секции Б и обновить ведомость.'
  },
  {
    object: 'Школа № 8',
    title: 'Смонтировать освещение спортзала',
    description: 'Смонтировать светильники и проверить включение групп.',
    worker: 'Исполнитель 2',
    status: 'accepted'
  },
  {
    object: 'Школа № 8',
    title: 'Проверить систему отопления',
    description: 'Проверить радиаторы и подготовить перечень замечаний.',
    worker: 'Исполнитель 2',
    status: 'new'
  }
]

for (const plan of plans) {
  const objectId = objectByName.get(plan.object)
  const worker = workerByName.get(plan.worker)
  assert(objectId && worker, `Missing object or worker for ${plan.title}`)
  if (
    tasks.some(
      (task) => task.object_id === objectId && task.title === plan.title
    )
  ) {
    console.log(`Already exists: ${plan.title}`)
    continue
  }
  const { data: created } = await manager.api.post('/rpc/create_task', {
    p_object_id: objectId,
    p_title: plan.title,
    p_description: plan.description,
    p_assignee_id: worker.id
  })
  const taskId = created.id
  if (plan.status !== 'new') {
    await worker.api.post('/rpc/transition_task', {
      p_id: taskId,
      p_to_status: 'in_progress'
    })
  }
  if (['review', 'revision', 'accepted'].includes(plan.status)) {
    await worker.api.post('/rpc/transition_task', {
      p_id: taskId,
      p_to_status: 'review'
    })
  }
  if (plan.status === 'revision' || plan.status === 'accepted') {
    await manager.api.post('/rpc/transition_task', {
      p_id: taskId,
      p_to_status: plan.status,
      p_comment: plan.comment ?? null
    })
  }
  console.log(`Created: ${plan.title} (${plan.status})`)
}

const { data: finalTasks } = await manager.api.get(
  '/tasks?select=id,object_id,title,status,assignee_id'
)
const statuses = new Set(finalTasks.map((task) => task.status))
for (const expected of [
  'new',
  'in_progress',
  'review',
  'revision',
  'accepted'
]) {
  assert(statuses.has(expected), `Missing demo status: ${expected}`)
}
assert.equal(objects.length, 3)
assert(finalTasks.length >= 11)
for (const worker of workers) {
  const { data: visible } = await worker.api.get('/tasks?select=id,assignee_id')
  assert(visible.every((task) => task.assignee_id === worker.id))
}
const distribution = Object.fromEntries(
  [...statuses].map((status) => [
    status,
    finalTasks.filter((task) => task.status === status).length
  ])
)
console.log(
  `Demo ready: ${objects.length} objects, ${finalTasks.length} tasks, ${JSON.stringify(distribution)}`
)
