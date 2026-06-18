# Threatbase API — Supabase Setup

Run the SQL below in your **Supabase SQL Editor** (Dashboard → SQL Editor → New query → Run).
The API will return `401 Invalid or revoked API key` until this is applied.

The schema and the RPC signature below are written to match the code exactly:

- `Profile.tsx` inserts `{ user_id, key_hash, prefix }` and filters/revokes on `is_active`.
- `functions/api/v1/_middleware.ts` calls `validate_api_key_hash({ client_hash })` and expects a **single `uuid`** back.

```sql
-- =============================================================
-- 1. api_keys table
--    Only the SHA-256 hash of each key is ever stored.
-- =============================================================
create table if not exists public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  key_hash    text not null unique,           -- SHA-256 hex of the plaintext key
  prefix      text not null,                  -- e.g. "tb_api_a3f9..." (first 15 chars, display only)
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists api_keys_user_id_idx on public.api_keys (user_id);
create index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);

-- =============================================================
-- 2. Row Level Security
--    Users may only see / create / revoke their OWN keys.
--    The plaintext key is never stored, so nothing recoverable
--    is exposed even to the owner.
-- =============================================================
alter table public.api_keys enable row level security;

drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own"
  on public.api_keys for select
  using (auth.uid() = user_id);

drop policy if exists "api_keys_insert_own" on public.api_keys;
create policy "api_keys_insert_own"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

drop policy if exists "api_keys_update_own" on public.api_keys;
create policy "api_keys_update_own"
  on public.api_keys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy: keys are revoked (is_active = false), not deleted.

-- =============================================================
-- 3. validate_api_key_hash RPC
--    SECURITY DEFINER so the edge middleware (anon/publishable
--    key) can verify a hash WITHOUT being able to read the table.
--    Returns the owning user_id for an active key, else NULL.
-- =============================================================
create or replace function public.validate_api_key_hash(client_hash text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select user_id
  from public.api_keys
  where key_hash = client_hash
    and is_active = true
  limit 1;
$$;

-- The middleware uses the publishable (anon) key, so anon must be
-- allowed to CALL the function. It still cannot read the table
-- directly — only this function (which returns just a uuid) is exposed.
revoke all on function public.validate_api_key_hash(text) from public;
grant execute on function public.validate_api_key_hash(text) to anon, authenticated;
```

## Notes / things worth knowing

- **The edge functions use the publishable (anon) key**, not a service-role key.
  Validation works because `validate_api_key_hash` is `SECURITY DEFINER`. The
  `/report` endpoint's `profiles` read and `reported_ips` insert rely on your
  **existing** RLS policies that already permit the public client to do the same
  thing from the website. If those endpoints ever return permission errors,
  the cause is the `profiles`/`reported_ips` policies, not this file.
- **`prefix` is display-only** (first 15 chars). It is not unique and is not used
  for authentication — only `key_hash` is matched.
- **Rate limiting** (1000/day/key) only activates when the `IOC_CACHE` KV
  namespace is bound to the Pages project. KV is eventually consistent, so the
  limit is approximate under bursts of concurrent requests — fine for abuse
  prevention, not a hard accounting quota.
- **Key entropy:** keys are 24 random bytes (`tb_api_` + 48 hex chars). Plain
  SHA-256 is acceptable here only because the key is high-entropy; do not lower
  the random length.

## Verify it worked

```sql
-- Should list the table and the function with no errors:
select count(*) from public.api_keys;
select public.validate_api_key_hash('nonexistent');  -- returns NULL, no error
```

Then: start the dev server, generate a key on your Profile page, and run:

```bash
curl -H "x-api-key: tb_api_YOUR_KEY_HERE" "http://localhost:8788/api/v1/scan?ip=1.1.1.1"
```
