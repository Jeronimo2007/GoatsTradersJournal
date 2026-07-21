-- Shared lessons feed for all signed-in users.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- After this, every authenticated user can read all lessons;
-- only the author can edit / delete / pin their own.

-- 1) Table policies
drop policy if exists "lessons_select_own" on public.lessons;
drop policy if exists "lessons_select_authenticated" on public.lessons;
create policy "lessons_select_authenticated" on public.lessons
  for select using (auth.uid() is not null);

-- Keep write policies owner-only (recreate if missing)
drop policy if exists "lessons_insert_own" on public.lessons;
drop policy if exists "lessons_update_own" on public.lessons;
drop policy if exists "lessons_delete_own" on public.lessons;
create policy "lessons_insert_own" on public.lessons
  for insert with check (auth.uid() = user_id);
create policy "lessons_update_own" on public.lessons
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "lessons_delete_own" on public.lessons
  for delete using (auth.uid() = user_id);

-- 2) Profiles: allow reading display names for the feed
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.uid() is not null);

-- 3) RPC fallback (security definer) — used by the app to list the feed
create or replace function public.list_lessons()
returns setof public.lessons
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.lessons
  where auth.uid() is not null
  order by pinned desc, created_at desc;
$$;

revoke all on function public.list_lessons() from public;
grant execute on function public.list_lessons() to authenticated;
