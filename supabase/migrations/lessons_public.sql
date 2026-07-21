-- Make lessons readable by every signed-in user.
-- Authors can still only insert / update / delete their own rows.
-- Also allow reading other users' display names for the lessons feed.
--
-- Run in: Supabase Dashboard → SQL Editor → New query

-- Lessons: anyone authenticated can read
drop policy if exists "lessons_select_own" on public.lessons;
drop policy if exists "lessons_select_authenticated" on public.lessons;
create policy "lessons_select_authenticated" on public.lessons
  for select using (auth.uid() is not null);

-- Profiles: signed-in users can read display names (needed for author labels)
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.uid() is not null);
