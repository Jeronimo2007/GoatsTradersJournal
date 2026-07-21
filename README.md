# Trading Bitacora Goats

A private trading journal built with **Next.js**, **React**, **TypeScript**, **Tailwind CSS**, and **Supabase Auth**.

## Stack

| Layer | Tech |
|--------|------|
| App | Next.js (App Router) on Vercel |
| Auth | Supabase Auth (email + password) |
| Database | Supabase Postgres + Row Level Security |
| Files | Supabase Storage (screenshots + PDFs) |

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Create a Supabase project

1. [supabase.com](https://supabase.com) → New project
2. **Authentication → Providers → Email** — enable Email (optionally disable “Confirm email” while developing)
3. **SQL Editor** — run the full script in [`supabase/schema.sql`](./supabase/schema.sql)
4. **Project Settings → API** — copy URL + `anon` key into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → you’ll be redirected to **/login**. Create an account at **/register**.

`npm run dev` uses **webpack** (more stable / lower memory). If you want Turbopack instead: `npm run dev:turbo`.

On signup, a trigger creates your `profiles` row and a default **Main Account**.

## Deploy on Vercel

1. Push to GitHub and import in Vercel
2. Add the same two `NEXT_PUBLIC_*` env vars
3. In Supabase → Authentication → URL Configuration, add your Vercel URL to **Site URL** and **Redirect URLs**
4. Deploy

## Multi-account data model

```
auth.users (1)
     ├── profiles (1)  → active_account_id (which account is selected)
     └── accounts (N)  → balance, currency, backtest settings
              ├── trades (N) → trade_documents (0..1)
              └── backtest_trades (N)

lessons → shared feed for all signed-in users (author-only edit/delete)
```

| Table | Scope | Purpose |
|--------|--------|---------|
| `profiles` | 1 per user | Display name + currently active account |
| `accounts` | N per user | Each funded/personal account + its settings |
| `trades` | Per account | Live journal rows |
| `trade_documents` | Per trade | TipTap HTML + PDF path |
| `backtest_trades` | Per account | Replay / backtest logs |
| `lessons` | Shared | Lessons feed visible to all signed-in users |

Composite FKs `(account_id, user_id) → accounts(id, user_id)` make it impossible for a trade to point at another user's account. Deleting an account cascades its trades, docs, and backtests.

Storage buckets: `trade-images`, `backtest-images`, `trade-documents`  
Paths: `{user_id}/{account_id}/{filename}`
