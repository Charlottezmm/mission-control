# Mission Control (Supabase + Vercel)

This Next.js app now uses Supabase for task storage (no localhost:3000 dependency).

## Environment Variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hkarpznjtrhehauvcphf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Required Supabase SQL (run once)

`/rest/v1/rpc/exec_sql` is not enabled for this project with anon role, so run this SQL manually in Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  status text not null default 'backlog',
  assignee text,
  category text,
  priority text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Install & Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

```bash
vercel --yes
```

If environment variables are missing in Vercel, add:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```
