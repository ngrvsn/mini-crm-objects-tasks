begin;
select plan(12);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'objects', 'objects exists');
select has_table('public', 'tasks', 'tasks exists');
select has_table('public', 'task_status_history', 'history exists');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.objects'::regclass), 'objects RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.task_status_history'::regclass), 'history RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.tasks', 'UPDATE'), 'no direct task updates');
select ok(not has_table_privilege('authenticated', 'public.task_status_history', 'INSERT'), 'no history inserts');
select ok(not has_table_privilege('authenticated', 'public.task_status_history', 'UPDATE'), 'no history updates');
select ok(not has_table_privilege('authenticated', 'public.task_status_history', 'DELETE'), 'no history deletes');

select * from finish();
rollback;
