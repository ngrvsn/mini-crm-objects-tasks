-- All application writes go through narrow RPCs. Neither anon nor authenticated
-- can mutate a table directly, including the append-only status history.
create type public.app_role as enum ('manager', 'executor');
create type public.task_status as enum (
  'new', 'in_progress', 'review', 'revision', 'accepted'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  role public.app_role not null,
  created_at timestamptz not null default now()
);

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  address text not null check (char_length(trim(address)) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '',
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  status public.task_status not null default 'new',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  from_status public.task_status,
  to_status public.task_status not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint revision_comment_required check (
    to_status <> 'revision' or nullif(trim(comment), '') is not null
  )
);

create index tasks_object_active_idx on public.tasks(object_id) where deleted_at is null;
create index tasks_assignee_active_idx on public.tasks(assignee_id) where deleted_at is null;
create index history_task_created_idx on public.task_status_history(task_id, created_at);

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

revoke all on public.profiles, public.objects, public.tasks, public.task_status_history
  from anon, authenticated;
grant select (id, display_name, role, created_at) on public.profiles to authenticated;
grant select on public.objects, public.tasks, public.task_status_history to authenticated;
grant select, insert, update, delete on public.profiles, public.objects,
  public.tasks, public.task_status_history to service_role;

-- The profile table contains no email or secret. Names are visible to signed-in
-- users so task cards can show the author and managers can choose assignees.
create policy profiles_read on public.profiles for select to authenticated
  using ((select auth.uid()) is not null);

create function public.is_manager() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'manager'
  );
$$;

revoke execute on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;

create policy tasks_read on public.tasks for select to authenticated
  using (
    deleted_at is null and
    ((select public.is_manager()) or assignee_id = (select auth.uid()))
  );

create policy objects_read on public.objects for select to authenticated
  using (
    deleted_at is null and (
      (select public.is_manager()) or exists (
        select 1 from public.tasks t
        where t.object_id = objects.id
          and t.assignee_id = (select auth.uid())
          and t.deleted_at is null
      )
    )
  );

create policy history_read on public.task_status_history for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_status_history.task_id)
  );

create function public.current_profile() returns public.profiles
language sql stable security invoker set search_path = ''
as $$
  select p from public.profiles p where p.id = (select auth.uid());
$$;

create function public.create_object(p_name text, p_address text)
returns public.objects language plpgsql security definer set search_path = ''
as $$
declare result public.objects;
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.objects(name, address)
  values (trim(p_name), trim(p_address)) returning * into result;
  return result;
end;
$$;

create function public.update_object(p_id uuid, p_name text, p_address text)
returns public.objects language plpgsql security definer set search_path = ''
as $$
declare result public.objects;
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.objects set name = trim(p_name), address = trim(p_address), updated_at = now()
  where id = p_id and deleted_at is null returning * into result;
  if not found then raise exception 'object not found' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create function public.delete_object(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare removed_at timestamptz := now();
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.objects set deleted_at = removed_at, updated_at = removed_at
  where id = p_id and deleted_at is null;
  if not found then raise exception 'object not found' using errcode = 'P0002'; end if;
  update public.tasks set deleted_at = removed_at, updated_at = removed_at
  where object_id = p_id and deleted_at is null;
  return true;
end;
$$;

create function public.create_task(
  p_object_id uuid, p_title text, p_description text, p_assignee_id uuid
) returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare result public.tasks;
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.objects where id = p_object_id and deleted_at is null) then
    raise exception 'object not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles where id = p_assignee_id and role = 'executor') then
    raise exception 'assignee must be an executor' using errcode = '22023';
  end if;
  insert into public.tasks(object_id, title, description, assignee_id, created_by)
  values (p_object_id, trim(p_title), coalesce(p_description, ''), p_assignee_id, auth.uid())
  returning * into result;
  insert into public.task_status_history(task_id, actor_id, from_status, to_status)
  values (result.id, auth.uid(), null, 'new');
  return result;
end;
$$;

create function public.update_task(
  p_id uuid, p_object_id uuid, p_title text, p_description text, p_assignee_id uuid
) returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare result public.tasks;
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.objects where id = p_object_id and deleted_at is null) then
    raise exception 'object not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles where id = p_assignee_id and role = 'executor') then
    raise exception 'assignee must be an executor' using errcode = '22023';
  end if;
  update public.tasks
  set object_id = p_object_id, title = trim(p_title), description = coalesce(p_description, ''),
      assignee_id = p_assignee_id, updated_at = now()
  where id = p_id and deleted_at is null returning * into result;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create function public.delete_task(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.tasks set deleted_at = now(), updated_at = now()
  where id = p_id and deleted_at is null;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;
  return true;
end;
$$;

create function public.transition_task(
  p_id uuid, p_to_status public.task_status, p_comment text default null
) returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare current_task public.tasks;
declare result public.tasks;
declare actor uuid := auth.uid();
declare manager boolean := public.is_manager();
declare worker_transition boolean;
declare manager_transition boolean;
begin
  if actor is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into current_task from public.tasks where id = p_id and deleted_at is null for update;
  if not found then raise exception 'task not found' using errcode = 'P0002'; end if;

  worker_transition := current_task.assignee_id = actor and (
    (current_task.status = 'new' and p_to_status = 'in_progress') or
    (current_task.status = 'in_progress' and p_to_status = 'review') or
    (current_task.status = 'revision' and p_to_status = 'in_progress')
  );
  manager_transition := manager and current_task.status = 'review' and
    p_to_status in ('accepted', 'revision');
  if not (worker_transition or manager_transition) then
    raise exception 'transition forbidden' using errcode = '42501';
  end if;
  if p_to_status = 'revision' and nullif(trim(p_comment), '') is null then
    raise exception 'revision comment required' using errcode = '22023';
  end if;

  update public.tasks set status = p_to_status, updated_at = now()
  where id = p_id returning * into result;
  insert into public.task_status_history(task_id, actor_id, from_status, to_status, comment)
  values (p_id, actor, current_task.status, p_to_status, nullif(trim(p_comment), ''));
  return result;
end;
$$;

create function public.healthcheck() returns boolean
language sql stable security invoker set search_path = ''
as $$ select true; $$;

revoke execute on function public.current_profile() from public, anon;
revoke execute on function public.create_object(text, text) from public, anon;
revoke execute on function public.update_object(uuid, text, text) from public, anon;
revoke execute on function public.delete_object(uuid) from public, anon;
revoke execute on function public.create_task(uuid, text, text, uuid) from public, anon;
revoke execute on function public.update_task(uuid, uuid, text, text, uuid) from public, anon;
revoke execute on function public.delete_task(uuid) from public, anon;
revoke execute on function public.transition_task(uuid, public.task_status, text) from public, anon;
revoke execute on function public.healthcheck() from public;

grant execute on function public.current_profile() to authenticated;
grant execute on function public.create_object(text, text) to authenticated;
grant execute on function public.update_object(uuid, text, text) to authenticated;
grant execute on function public.delete_object(uuid) to authenticated;
grant execute on function public.create_task(uuid, text, text, uuid) to authenticated;
grant execute on function public.update_task(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.delete_task(uuid) to authenticated;
grant execute on function public.transition_task(uuid, public.task_status, text) to authenticated;
grant execute on function public.healthcheck() to anon, authenticated;
