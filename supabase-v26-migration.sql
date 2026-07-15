-- v26 community/account migration
-- Safe to run repeatedly. Existing room, profile and ranking data is retained.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username)) where username is not null;

alter table public.rankings add column if not exists defense_round integer not null default 0;
alter table public.rankings drop constraint if exists rankings_mode_check;
alter table public.rankings
  add constraint rankings_mode_check check (mode in ('solo','team','defense'));

create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  name text not null default '新設隊' check (char_length(name) between 1 and 12),
  color text not null default '#4aa8ff' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  emblem_pixels text not null default repeat('0',1024) check (char_length(emblem_pixels)=1024 and emblem_pixels ~ '^[01]+$'),
  leader_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.squad_members (
  squad_id uuid not null references public.squads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (squad_id,user_id)
);

create index if not exists squad_members_user_idx on public.squad_members(user_id);

create table if not exists public.site_stats (
  id integer primary key default 1 check (id=1),
  access_count bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.site_stats(id,access_count) values(1,0) on conflict(id) do nothing;

create table if not exists public.registration_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
alter table public.site_stats enable row level security;
alter table public.registration_rate_limits enable row level security;

drop policy if exists "squads direct access disabled" on public.squads;
drop policy if exists "squad members direct access disabled" on public.squad_members;
drop policy if exists "site stats direct access disabled" on public.site_stats;

create or replace function public.remove_friend(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  delete from public.friends
  where (owner_id=auth.uid() and friend_id=target_id)
     or (owner_id=target_id and friend_id=auth.uid());
  return true;
end;
$$;

create or replace function public.list_my_squads()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(item order by item->>'name'),'[]'::jsonb)
  from (
    select jsonb_build_object(
      'id',s.id,
      'name',s.name,
      'color',s.color,
      'emblem_pixels',s.emblem_pixels,
      'leader_id',s.leader_id,
      'created_at',s.created_at,
      'updated_at',s.updated_at,
      'members',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'user_id',m.user_id,
          'display_name',p.display_name,
          'friend_code',p.friend_code,
          'joined_at',m.joined_at
        ) order by m.joined_at),'[]'::jsonb)
        from public.squad_members m
        join public.profiles p on p.id=m.user_id
        where m.squad_id=s.id
      )
    ) as item
    from public.squads s
    where exists(
      select 1 from public.squad_members own
      where own.squad_id=s.id and own.user_id=auth.uid()
    )
  ) rows;
$$;

create or replace function public.create_squad_with_members(
  squad_name text,
  squad_color text,
  squad_emblem text,
  member_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_id uuid;
  member_id uuid;
  clean_name text:=left(coalesce(nullif(trim(squad_name),''),'新設隊'),12);
  clean_color text:=case when coalesce(squad_color,'') ~ '^#[0-9A-Fa-f]{6}$' then squad_color else '#4aa8ff' end;
  clean_emblem text:=case when char_length(coalesce(squad_emblem,''))=1024 and squad_emblem ~ '^[01]+$' then squad_emblem else repeat('0',1024) end;
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  insert into public.squads(name,color,emblem_pixels,leader_id)
  values(clean_name,clean_color,clean_emblem,auth.uid()) returning id into new_id;
  insert into public.squad_members(squad_id,user_id) values(new_id,auth.uid());
  foreach member_id in array coalesce(member_ids,array[]::uuid[]) loop
    if member_id<>auth.uid() and exists(
      select 1 from public.friends where owner_id=auth.uid() and friend_id=member_id
    ) then
      insert into public.squad_members(squad_id,user_id) values(new_id,member_id) on conflict do nothing;
    end if;
  end loop;
  return new_id;
end;
$$;

create or replace function public.update_squad_identity(
  target_squad uuid,
  squad_name text,
  squad_color text,
  squad_emblem text
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists(select 1 from public.squads where id=target_squad and leader_id=auth.uid()) then
    raise exception '隊長だけが隊設定を変更できます。';
  end if;
  update public.squads set
    name=left(coalesce(nullif(trim(squad_name),''),name),12),
    color=case when coalesce(squad_color,'') ~ '^#[0-9A-Fa-f]{6}$' then squad_color else color end,
    emblem_pixels=case when char_length(coalesce(squad_emblem,''))=1024 and squad_emblem ~ '^[01]+$' then squad_emblem else emblem_pixels end,
    updated_at=now()
  where id=target_squad;
  return true;
end;
$$;

create or replace function public.set_squad_leader(target_squad uuid,new_leader uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists(select 1 from public.squads where id=target_squad and leader_id=auth.uid()) then
    raise exception '現在の隊長だけが変更できます。';
  end if;
  if not exists(select 1 from public.squad_members where squad_id=target_squad and user_id=new_leader) then
    raise exception '隊員から新しい隊長を選んでください。';
  end if;
  update public.squads set leader_id=new_leader,updated_at=now() where id=target_squad;
  return true;
end;
$$;

create or replace function public.leave_squad(target_squad uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  next_leader uuid;
begin
  if not exists(select 1 from public.squad_members where squad_id=target_squad and user_id=auth.uid()) then
    raise exception 'この隊に所属していません。';
  end if;
  delete from public.squad_members where squad_id=target_squad and user_id=auth.uid();
  if not exists(select 1 from public.squad_members where squad_id=target_squad) then
    delete from public.squads where id=target_squad;
    return true;
  end if;
  if exists(select 1 from public.squads where id=target_squad and leader_id=auth.uid()) then
    select user_id into next_leader from public.squad_members where squad_id=target_squad order by joined_at limit 1;
    update public.squads set leader_id=next_leader,updated_at=now() where id=target_squad;
  end if;
  return true;
end;
$$;

create or replace function public.register_page_visit()
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  total bigint;
begin
  insert into public.site_stats(id,access_count,updated_at) values(1,1,now())
  on conflict(id) do update set access_count=public.site_stats.access_count+1,updated_at=now()
  returning access_count into total;
  return total;
end;
$$;

create or replace function public.consume_registration_attempt(
  rate_key text,
  max_attempts integer default 5,
  window_seconds integer default 3600
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  allowed boolean;
begin
  if rate_key is null or char_length(rate_key)<8 then return false; end if;
  if max_attempts<1 or window_seconds<60 then return false; end if;
  insert into public.registration_rate_limits(key_hash,window_started_at,attempts,updated_at)
  values(rate_key,now(),1,now())
  on conflict(key_hash) do update set
    attempts=case
      when public.registration_rate_limits.window_started_at <= now()-make_interval(secs=>window_seconds) then 1
      else public.registration_rate_limits.attempts+1
    end,
    window_started_at=case
      when public.registration_rate_limits.window_started_at <= now()-make_interval(secs=>window_seconds) then now()
      else public.registration_rate_limits.window_started_at
    end,
    updated_at=now()
  returning attempts<=max_attempts into allowed;
  if random()<0.02 then
    delete from public.registration_rate_limits where updated_at<now()-interval '2 days';
  end if;
  return allowed;
end;
$$;

revoke all on public.squads from anon,authenticated;
revoke all on public.squad_members from anon,authenticated;
revoke all on public.site_stats from anon,authenticated;
revoke all on public.registration_rate_limits from public,anon,authenticated;

revoke all on function public.consume_registration_attempt(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_registration_attempt(text,integer,integer) to service_role;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.list_my_squads() to authenticated;
grant execute on function public.create_squad_with_members(text,text,text,uuid[]) to authenticated;
grant execute on function public.update_squad_identity(uuid,text,text,text) to authenticated;
grant execute on function public.set_squad_leader(uuid,uuid) to authenticated;
grant execute on function public.leave_squad(uuid) to authenticated;
grant execute on function public.register_page_visit() to authenticated;
