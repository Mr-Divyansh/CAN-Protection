-- CAN Protection — Initial Supabase PostgreSQL Migration
-- NOTE: Review and execute in Supabase SQL Editor or via Supabase CLI (`supabase db push`).
-- Do not grant anon or authenticated direct table privileges; all reads/writes must go through
-- verified server-side route handlers using the service_role key.

create extension if not exists "pgcrypto";

-- 1. Mobile-number registrations
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  phone_number_normalized text not null,
  status text not null check (status in ('active', 'inactive')),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  deactivated_at timestamptz
);

-- Enforce single record per normalized number and prevent duplicate active registrations.
create unique index if not exists idx_registrations_phone_unique
  on public.registrations (phone_number_normalized);

create unique index if not exists idx_registrations_single_active
  on public.registrations (phone_number_normalized)
  where (status = 'active');

create index if not exists idx_registrations_status
  on public.registrations (status);

-- Automatic updated_at maintenance trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_registrations_updated_at on public.registrations;
create trigger trg_registrations_updated_at
  before update on public.registrations
  for each row
  execute function public.set_updated_at();

-- 2. Short-lived OTP challenges (hashes only; never store plaintext OTP codes)
create table if not exists public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone_number_normalized text not null,
  phone_hash text not null,
  otp_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  expires_at timestamptz not null,
  resend_available_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_otp_challenges_phone_hash
  on public.otp_challenges (phone_hash, created_at desc);

create index if not exists idx_otp_challenges_expires_at
  on public.otp_challenges (expires_at);

-- 3. Short-lived verified ownership sessions (token hashes only)
create table if not exists public.verified_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  phone_number_normalized text not null,
  phone_hash text not null,
  verification_mode text not null check (verification_mode in ('development_test', 'provider')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_verified_sessions_expires_at
  on public.verified_sessions (expires_at);

-- 4. Server-side rate-limit sliding window events
create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at_ms bigint not null
);

create index if not exists idx_rate_limit_events_bucket_time
  on public.rate_limit_events (bucket_key, created_at_ms desc);

-- Row Level Security: Deny ALL direct access from anon/authenticated browser clients.
-- Server-side service_role bypasses RLS intentionally.
alter table public.registrations enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.verified_sessions enable row level security;
alter table public.rate_limit_events enable row level security;

revoke all on public.registrations from anon, authenticated;
revoke all on public.otp_challenges from anon, authenticated;
revoke all on public.verified_sessions from anon, authenticated;
revoke all on public.rate_limit_events from anon, authenticated;
