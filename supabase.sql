-- Private per-user task storage. Requires Supabase Auth sign-in in the client.
create table if not exists public.taskflow_tasks (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.taskflow_tasks enable row level security;
drop policy if exists "Read own tasks" on public.taskflow_tasks;
create policy "Read own tasks" on public.taskflow_tasks for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own tasks" on public.taskflow_tasks;
create policy "Insert own tasks" on public.taskflow_tasks for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own tasks" on public.taskflow_tasks;
create policy "Update own tasks" on public.taskflow_tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select,insert,update on public.taskflow_tasks to authenticated;

-- Run this addition to broadcast changes instantly to other devices.
-- Safe to run more than once.
do $$ begin
  alter publication supabase_realtime add table public.taskflow_tasks;
exception when duplicate_object then null;
end $$;
