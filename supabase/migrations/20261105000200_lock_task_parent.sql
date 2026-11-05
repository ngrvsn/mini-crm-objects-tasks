-- A task may only be created or moved while its parent object stays active.
-- The row lock serializes these writes with delete_object's soft delete.
create or replace function public.create_task(
  p_object_id uuid, p_title text, p_description text, p_assignee_id uuid
) returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare result public.tasks;
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.objects
  where id = p_object_id and deleted_at is null for update;
  if not found then raise exception 'object not found' using errcode = 'P0002'; end if;
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

revoke execute on function public.create_task(uuid, text, text, uuid)
  from public, anon;
grant execute on function public.create_task(uuid, text, text, uuid)
  to authenticated;

create or replace function public.update_task(
  p_id uuid, p_object_id uuid, p_title text, p_description text, p_assignee_id uuid
) returns public.tasks language plpgsql security definer set search_path = ''
as $$
declare result public.tasks;
begin
  if not public.is_manager() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.objects
  where id = p_object_id and deleted_at is null for update;
  if not found then raise exception 'object not found' using errcode = 'P0002'; end if;
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

revoke execute on function public.update_task(uuid, uuid, text, text, uuid)
  from public, anon;
grant execute on function public.update_task(uuid, uuid, text, text, uuid)
  to authenticated;
