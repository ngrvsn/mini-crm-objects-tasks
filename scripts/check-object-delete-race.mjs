import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'

const container = execFileSync('docker', ['ps', '--format', '{{.Names}}'], {
  encoding: 'utf8'
})
  .split(/\r?\n/)
  .find((name) => name === 'supabase_db_mini-crm-objects-tasks')
assert(container, 'Start local Supabase before the concurrency check')

const psqlArgs = [
  'exec',
  container,
  'psql',
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-X',
  '-q',
  '-A',
  '-t',
  '-v',
  'ON_ERROR_STOP=1'
]
const sql = (query) =>
  execFileSync('docker', [...psqlArgs, '-c', query], {
    encoding: 'utf8',
    timeout: 10000
  }).trim()
const asyncSql = (query) =>
  new Promise((resolve, reject) => {
    const process = spawn('docker', [...psqlArgs, '-c', query])
    let output = ''
    let errors = ''
    process.stdout.on('data', (chunk) => (output += chunk))
    process.stderr.on('data', (chunk) => (errors += chunk))
    process.on('error', reject)
    process.on('close', (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(errors))
    )
  })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const mode = process.argv[2] ?? 'create'
assert(['create', 'move'].includes(mode), 'Expected create or move mode')

const managerId = sql(
  "select id from public.profiles where role = 'manager' order by created_at limit 1"
)
const assigneeId = sql(
  "select id from public.profiles where role = 'executor' order by created_at limit 1"
)
assert(managerId && assigneeId, 'Seed local users before the concurrency check')
const objectId = sql(
  `insert into public.objects(name, address) values ('Race ${mode} test ${Date.now()}', 'Local test only') returning id`
)
const sourceObjectId =
  mode === 'move'
    ? sql(
        `insert into public.objects(name, address) values ('Race source ${Date.now()}', 'Local test only') returning id`
      )
    : null
const taskId = sourceObjectId
  ? sql(`
      insert into public.tasks(object_id, title, assignee_id, created_by)
      values ('${sourceObjectId}', 'Task to move', '${assigneeId}', '${managerId}')
      returning id
    `)
  : null
const lockKey = 947201106
let lockProcess
let taskWrite
let objectDelete

try {
  sql(`
    create function public.crm_test_pause_task_insert() returns trigger
    language plpgsql as $$
    begin
      if new.object_id::text = current_setting('crm.test_object_id', true) then
        perform pg_advisory_xact_lock(${lockKey});
      end if;
      return new;
    end;
    $$;
    create trigger crm_test_pause_task_insert before insert on public.tasks
      for each row execute function public.crm_test_pause_task_insert();
    create trigger crm_test_pause_task_move before update of object_id on public.tasks
      for each row execute function public.crm_test_pause_task_insert();
  `)

  lockProcess = spawn('docker', ['exec', '-i', container, ...psqlArgs.slice(2)])
  const lockReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Advisory lock timeout')),
      5000
    )
    lockProcess.stdout.on('data', (chunk) => {
      if (String(chunk).includes('LOCK_READY')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    lockProcess.on('error', reject)
    lockProcess.on('close', () => reject(new Error('Advisory lock exited')))
  })
  lockProcess.stdin.write(
    `select pg_advisory_lock(${lockKey}); select 'LOCK_READY';\n`
  )
  await lockReady

  taskWrite = asyncSql(
    mode === 'move'
      ? `
        select set_config('request.jwt.claim.sub', '${managerId}', false);
        select set_config('crm.test_object_id', '${objectId}', false);
        select public.update_task(
          '${taskId}', '${objectId}', 'Moved task', '', '${assigneeId}'
        );
      `
      : `
        select set_config('request.jwt.claim.sub', '${managerId}', false);
        select set_config('crm.test_object_id', '${objectId}', false);
        select public.create_task(
          '${objectId}', 'Concurrent task', '', '${assigneeId}'
        );
      `
  )
  let waiting = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    waiting =
      sql(`
        select count(*) from pg_stat_activity
        where wait_event_type = 'Lock' and wait_event = 'advisory'
          and query like '%${mode === 'move' ? 'update_task' : 'create_task'}%'
      `) === '1'
    if (waiting) break
    await delay(100)
  }
  assert(waiting, 'Task write did not reach the insert barrier')

  objectDelete = asyncSql(`
    select set_config('request.jwt.claim.sub', '${managerId}', false);
    select public.delete_object('${objectId}');
  `)
  await delay(1000)
  lockProcess.stdin.write(`select pg_advisory_unlock(${lockKey});\n`)
  lockProcess.stdin.end()
  await Promise.all([taskWrite, objectDelete])

  const activeOrphans = Number(
    sql(`
      select count(*) from public.tasks t
      join public.objects o on o.id = t.object_id
      where o.id = '${objectId}' and o.deleted_at is not null
        and t.deleted_at is null
    `)
  )
  assert.equal(activeOrphans, 0, 'Task remained active under a deleted object')
  console.log(`Concurrent task ${mode} and object deletion are consistent`)
} finally {
  if (lockProcess && !lockProcess.stdin.writableEnded) {
    lockProcess.stdin.write(`select pg_advisory_unlock(${lockKey});\n`)
    lockProcess.stdin.end()
  }
  await Promise.allSettled([taskWrite, objectDelete].filter(Boolean))
  const testObjects = [objectId, sourceObjectId]
    .filter(Boolean)
    .map((id) => `'${id}'`)
    .join(', ')
  sql(`
    drop trigger if exists crm_test_pause_task_insert on public.tasks;
    drop trigger if exists crm_test_pause_task_move on public.tasks;
    drop function if exists public.crm_test_pause_task_insert();
    delete from public.task_status_history where task_id in (
      select id from public.tasks where object_id in (${testObjects})
    );
    delete from public.tasks where object_id in (${testObjects});
    delete from public.objects where id in (${testObjects});
  `)
}
