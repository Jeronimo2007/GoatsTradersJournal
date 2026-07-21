-- Trading Bitacora Goats — Supabase schema
-- Run once in: Dashboard → SQL Editor → New query
--
-- Prerequisites: Authentication → Providers → Email enabled
--
-- Data model (multi-account):
--
--   auth.users (1)
--        │
--        ├── profiles (1) ──────── active_account_id ──┐
--        │                                              │
--        └── accounts (N) ◄────────────────────────────┘
--                 │
--                 ├── trades (N) ── trade_documents (0..1)
--                 └── backtest_trades (N)
--
--   lessons are a shared feed for ALL signed-in users
--   (only the author can edit / delete / pin their own lessons)
--   Storage paths: {user_id}/{account_id}/{filename}

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- Holds which trading account is currently selected in the UI.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  active_account_id text, -- FK added after accounts exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Accounts — each user can own many (funded, personal, prop firm, …)
-- Settings (balance, currency, backtest risk) live HERE, not on the user.
-- ---------------------------------------------------------------------------

create table if not exists public.accounts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  account_balance numeric not null default 10000,
  currency text not null default 'USD',
  bt_risk_per_trade numeric not null default 100,
  bt_currency text not null default 'USD',

  -- Needed so child rows can FK (account_id, user_id) → accounts(id, user_id)
  constraint accounts_id_user_unique unique (id, user_id),

  -- Unique display name per user (case-insensitive)
  constraint accounts_user_name_unique unique (user_id, name)
);

create index if not exists accounts_user_id_idx on public.accounts (user_id);

-- Active account must belong to THIS user (composite FK)
alter table public.profiles
  drop constraint if exists profiles_active_account_id_fkey;

alter table public.profiles
  add constraint profiles_active_account_user_fkey
  foreign key (active_account_id, id)
  references public.accounts (id, user_id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- Live trades — always belong to ONE account of the owning user
-- ---------------------------------------------------------------------------

create table if not exists public.trades (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id text not null,
  opened_at text not null default '',
  closed_at text not null default '',
  session text not null default '',
  asset text not null default '',
  direction text not null default 'long' check (direction in ('long', 'short')),
  entry_price numeric not null default 0,
  exit_price numeric not null default 0,
  stop_loss numeric,
  take_profit numeric,
  position_size numeric not null default 0,
  net_pnl numeric not null default 0,
  net_pnl_percent numeric,
  fees numeric not null default 0,
  setups jsonb not null default '[]'::jsonb,
  order_type text not null default 'market' check (order_type in ('market', 'limit', 'stop')),
  screenshot_before text not null default '',
  screenshot_after text not null default '',
  moved_to_break_even boolean not null default false,
  took_partials boolean not null default false,
  closed_manually boolean not null default false,
  management_notes text not null default '',
  pre_trade_mindset text not null default '',
  in_trade_behavior text not null default '',
  post_trade_review text not null default '',
  compliance text check (compliance is null or compliance in ('compliant', 'mistake')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Guarantees account_id belongs to the same user_id (no cross-account leaks)
  constraint trades_account_user_fkey
    foreign key (account_id, user_id)
    references public.accounts (id, user_id)
    on delete cascade
);

create index if not exists trades_user_id_idx on public.trades (user_id);
create index if not exists trades_account_id_idx on public.trades (account_id);
create index if not exists trades_user_account_idx on public.trades (user_id, account_id);
create index if not exists trades_opened_at_idx on public.trades (opened_at);

-- ---------------------------------------------------------------------------
-- Trade documents (1:1 with a trade → inherits that trade's account)
-- ---------------------------------------------------------------------------

create table if not exists public.trade_documents (
  trade_id bigint primary key references public.trades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id text not null,
  html text not null default '',
  pdf_path text,
  updated_at timestamptz,
  pdf_updated_at timestamptz,

  constraint trade_documents_account_user_fkey
    foreign key (account_id, user_id)
    references public.accounts (id, user_id)
    on delete cascade
);

create index if not exists trade_documents_user_id_idx on public.trade_documents (user_id);
create index if not exists trade_documents_account_id_idx on public.trade_documents (account_id);

-- ---------------------------------------------------------------------------
-- Lessons — shared feed for all signed-in users
-- ---------------------------------------------------------------------------

create table if not exists public.lessons (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lessons_user_id_idx on public.lessons (user_id);

-- ---------------------------------------------------------------------------
-- Backtest / replay trades — scoped per account (like live trades)
-- ---------------------------------------------------------------------------

create table if not exists public.backtest_trades (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id text not null,
  date text not null default '',
  session text not null default 'NY' check (session in ('NY', 'Tokyo')),
  direction text not null default 'long' check (direction in ('long', 'short')),
  asset text not null default '',
  setups jsonb not null default '[]'::jsonb,
  outcome text not null default 'win' check (outcome in ('win', 'loss', 'be')),
  rr numeric not null default 0,
  planned_rr numeric,
  risk_amount numeric,
  contracts numeric,
  net_pnl numeric,
  screenshot text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint backtest_trades_account_user_fkey
    foreign key (account_id, user_id)
    references public.accounts (id, user_id)
    on delete cascade
);

create index if not exists backtest_trades_user_id_idx on public.backtest_trades (user_id);
create index if not exists backtest_trades_account_id_idx on public.backtest_trades (account_id);
create index if not exists backtest_trades_user_account_idx on public.backtest_trades (user_id, account_id);
create index if not exists backtest_trades_date_idx on public.backtest_trades (date);

-- ---------------------------------------------------------------------------
-- Signup: create profile + first ("Main Account") for every new user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id text;
  chosen_name text;
begin
  new_account_id := 'acc-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  chosen_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'trader'), '@', 1),
    'Trader'
  );

  insert into public.profiles (id, email, display_name, active_account_id)
  values (new.id, new.email, chosen_name, null);

  insert into public.accounts (id, user_id, name)
  values (new_account_id, new.id, 'Main Account');

  -- Now that the account exists, set it as active (composite FK is valid)
  update public.profiles
  set active_account_id = new_account_id,
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage buckets (private)
-- Paths: {user_id}/{account_id}/{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('trade-images', 'trade-images', false),
  ('backtest-images', 'backtest-images', false),
  ('trade-documents', 'trade-documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security — every row is owned by auth.uid()
-- Inserts that touch an account also require ownership of that account.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.trades enable row level security;
alter table public.trade_documents enable row level security;
alter table public.lessons enable row level security;
alter table public.backtest_trades enable row level security;

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.uid() is not null);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Accounts (user may have many)
drop policy if exists "accounts_select_own" on public.accounts;
drop policy if exists "accounts_insert_own" on public.accounts;
drop policy if exists "accounts_update_own" on public.accounts;
drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_select_own" on public.accounts
  for select using (auth.uid() = user_id);
create policy "accounts_insert_own" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts_update_own" on public.accounts
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "accounts_delete_own" on public.accounts
  for delete using (auth.uid() = user_id);

-- Trades (filtered by active account in the app; RLS enforces user ownership)
drop policy if exists "trades_select_own" on public.trades;
drop policy if exists "trades_insert_own" on public.trades;
drop policy if exists "trades_update_own" on public.trades;
drop policy if exists "trades_delete_own" on public.trades;
create policy "trades_select_own" on public.trades
  for select using (auth.uid() = user_id);
create policy "trades_insert_own" on public.trades
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );
create policy "trades_update_own" on public.trades
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );
create policy "trades_delete_own" on public.trades
  for delete using (auth.uid() = user_id);

-- Trade documents
drop policy if exists "trade_documents_select_own" on public.trade_documents;
drop policy if exists "trade_documents_insert_own" on public.trade_documents;
drop policy if exists "trade_documents_update_own" on public.trade_documents;
drop policy if exists "trade_documents_delete_own" on public.trade_documents;
create policy "trade_documents_select_own" on public.trade_documents
  for select using (auth.uid() = user_id);
create policy "trade_documents_insert_own" on public.trade_documents
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );
create policy "trade_documents_update_own" on public.trade_documents
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "trade_documents_delete_own" on public.trade_documents
  for delete using (auth.uid() = user_id);

-- Lessons (shared feed; write still owner-only)
drop policy if exists "lessons_select_own" on public.lessons;
drop policy if exists "lessons_select_authenticated" on public.lessons;
drop policy if exists "lessons_insert_own" on public.lessons;
drop policy if exists "lessons_update_own" on public.lessons;
drop policy if exists "lessons_delete_own" on public.lessons;
create policy "lessons_select_authenticated" on public.lessons
  for select using (auth.uid() is not null);
create policy "lessons_insert_own" on public.lessons
  for insert with check (auth.uid() = user_id);
create policy "lessons_update_own" on public.lessons
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "lessons_delete_own" on public.lessons
  for delete using (auth.uid() = user_id);

-- Shared feed helper (callable from the app)
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

-- Backtests
drop policy if exists "backtest_trades_select_own" on public.backtest_trades;
drop policy if exists "backtest_trades_insert_own" on public.backtest_trades;
drop policy if exists "backtest_trades_update_own" on public.backtest_trades;
drop policy if exists "backtest_trades_delete_own" on public.backtest_trades;
create policy "backtest_trades_select_own" on public.backtest_trades
  for select using (auth.uid() = user_id);
create policy "backtest_trades_insert_own" on public.backtest_trades
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );
create policy "backtest_trades_update_own" on public.backtest_trades
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid()
    )
  );
create policy "backtest_trades_delete_own" on public.backtest_trades
  for delete using (auth.uid() = user_id);

-- Storage: folder 1 = user_id, folder 2 = account_id
drop policy if exists "trade_images_select_own" on storage.objects;
drop policy if exists "trade_images_insert_own" on storage.objects;
drop policy if exists "trade_images_update_own" on storage.objects;
drop policy if exists "trade_images_delete_own" on storage.objects;
create policy "trade_images_select_own" on storage.objects
  for select using (
    bucket_id = 'trade-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "trade_images_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'trade-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "trade_images_update_own" on storage.objects
  for update using (
    bucket_id = 'trade-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "trade_images_delete_own" on storage.objects
  for delete using (
    bucket_id = 'trade-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "backtest_images_select_own" on storage.objects;
drop policy if exists "backtest_images_insert_own" on storage.objects;
drop policy if exists "backtest_images_update_own" on storage.objects;
drop policy if exists "backtest_images_delete_own" on storage.objects;
create policy "backtest_images_select_own" on storage.objects
  for select using (
    bucket_id = 'backtest-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "backtest_images_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'backtest-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "backtest_images_update_own" on storage.objects
  for update using (
    bucket_id = 'backtest-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "backtest_images_delete_own" on storage.objects
  for delete using (
    bucket_id = 'backtest-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "trade_documents_storage_select_own" on storage.objects;
drop policy if exists "trade_documents_storage_insert_own" on storage.objects;
drop policy if exists "trade_documents_storage_update_own" on storage.objects;
drop policy if exists "trade_documents_storage_delete_own" on storage.objects;
create policy "trade_documents_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'trade-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "trade_documents_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'trade-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "trade_documents_storage_update_own" on storage.objects
  for update using (
    bucket_id = 'trade-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "trade_documents_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'trade-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
