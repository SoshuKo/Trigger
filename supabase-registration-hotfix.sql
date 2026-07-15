-- TRION ARENA registration limiter hotfix (v27)
-- Safe to run on an existing project. Existing users, rankings, friends and squads are preserved.

begin;

create table if not exists public.registration_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.registration_rate_limits enable row level security;
revoke all on public.registration_rate_limits from public,anon,authenticated;

drop function if exists public.consume_registration_attempt(text,integer,integer);

create function public.consume_registration_attempt(
  p_rate_key text,
  p_max_attempts integer default 5,
  p_window_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  allowed boolean;
begin
  if p_rate_key is null or char_length(p_rate_key)<8 then return false; end if;
  if p_max_attempts<1 or p_window_seconds<60 then return false; end if;

  perform pg_advisory_xact_lock(hashtext(p_rate_key));

  insert into public.registration_rate_limits(key_hash,window_started_at,attempts,updated_at)
  values(p_rate_key,now(),1,now())
  on conflict(key_hash) do update set
    attempts=case
      when public.registration_rate_limits.window_started_at <= now()-make_interval(secs=>p_window_seconds) then 1
      else public.registration_rate_limits.attempts+1
    end,
    window_started_at=case
      when public.registration_rate_limits.window_started_at <= now()-make_interval(secs=>p_window_seconds) then now()
      else public.registration_rate_limits.window_started_at
    end,
    updated_at=now()
  returning attempts<=p_max_attempts into allowed;

  if random()<0.02 then
    delete from public.registration_rate_limits where updated_at<now()-interval '2 days';
  end if;
  return allowed;
end;
$$;

revoke all on function public.consume_registration_attempt(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_registration_attempt(text,integer,integer) to service_role;

commit;

notify pgrst, 'reload schema';

-- Verification: this should return true on the first few calls.
select public.consume_registration_attempt('manual-test-key', 5, 3600) as limiter_ok;
