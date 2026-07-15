-- TRION ARENA registration limiter repair v27
-- Supabase Dashboard -> SQL Editor で全文実行してください。

begin;

create table if not exists public.registration_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now()
);

alter table public.registration_rate_limits enable row level security;
revoke all on public.registration_rate_limits from public, anon, authenticated;

create or replace function public.consume_registration_attempt_v2(
  p_rate_key text,
  p_max_attempts integer default 5,
  p_window_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  if p_rate_key is null or char_length(p_rate_key) < 8 then
    return false;
  end if;
  if p_max_attempts < 1 or p_window_seconds < 60 then
    return false;
  end if;

  with changed as (
    insert into public.registration_rate_limits(
      key_hash, window_started_at, attempts, updated_at
    )
    values (p_rate_key, now(), 1, now())
    on conflict (key_hash) do update set
      attempts = case
        when public.registration_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
        else public.registration_rate_limits.attempts + 1
      end,
      window_started_at = case
        when public.registration_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
        else public.registration_rate_limits.window_started_at
      end,
      updated_at = now()
    returning attempts
  )
  select attempts into v_attempts from changed;

  if random() < 0.02 then
    delete from public.registration_rate_limits
    where updated_at < now() - interval '2 days';
  end if;

  return coalesce(v_attempts, p_max_attempts + 1) <= p_max_attempts;
end;
$$;

-- 旧Edge Functionとの互換性を保つラッパー。
create or replace function public.consume_registration_attempt(
  rate_key text,
  max_attempts integer default 5,
  window_seconds integer default 3600
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.consume_registration_attempt_v2(rate_key, max_attempts, window_seconds);
$$;

revoke all on function public.consume_registration_attempt_v2(text, integer, integer) from public, anon, authenticated;
revoke all on function public.consume_registration_attempt(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_registration_attempt_v2(text, integer, integer) to service_role;
grant execute on function public.consume_registration_attempt(text, integer, integer) to service_role;

notify pgrst, 'reload schema';

commit;
