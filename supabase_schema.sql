-- ============================================================================
-- Supabase Schema & RPC Function for DC Exam Application Persistent Storage
-- ============================================================================
-- Execute this script in your Supabase Project:
-- SQL Editor > New Query > Paste and Run (Ctrl+Enter / Cmd+Enter)
-- ============================================================================

-- 1. Create table public.app_data for permanent application state
create table if not exists public.app_data (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (RLS) to protect data from unauthorized browser access
alter table public.app_data enable row level security;

-- 3. Revoke all access from anonymous and authenticated browser clients
-- (Ensures all operations are mediated exclusively server-side via service_role)
revoke all on table public.app_data from anon, authenticated;

-- 4. Transactional Locking & Concurrency Control RPC function
-- Uses 'SELECT ... FOR UPDATE' to acquire exclusive row lock during updates
-- Validates 'expected_updated_at' to prevent concurrent overwrites
create or replace function public.save_app_data(
  target_id integer,
  new_data jsonb,
  expected_updated_at timestamptz default null
)
returns table (id integer, updated_at timestamptz)
language plpgsql
security definer
as $$
declare
  current_row public.app_data%rowtype;
begin
  -- Lock the row for update if it exists
  select * into current_row
  from public.app_data
  where app_data.id = target_id
  for update;

  if found then
    -- Optimistic concurrency check: if expected_updated_at was provided, verify it matches
    if expected_updated_at is not null and current_row.updated_at != expected_updated_at then
      raise exception 'CONCURRENT_MODIFICATION_CONFLICT: Row % was updated by another process at % (expected %)', target_id, current_row.updated_at, expected_updated_at;
    end if;

    update public.app_data
    set data = new_data,
        updated_at = clock_timestamp()
    where app_data.id = target_id
    returning app_data.id, app_data.updated_at into id, updated_at;
    return next;
  else
    insert into public.app_data (id, data, updated_at)
    values (target_id, new_data, clock_timestamp())
    returning app_data.id, app_data.updated_at into id, updated_at;
    return next;
  end if;
end;
$$;

-- 5. Grant execute permissions on the function to the server service_role key
grant execute on function public.save_app_data(integer, jsonb, timestamptz) to service_role;
