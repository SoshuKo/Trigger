-- TRION ARENA v67: page-view deduplication

create table if not exists public.site_visit_daily (
  user_id uuid not null,
  visit_day date not null default current_date,
  created_at timestamptz not null default now(),
  primary key(user_id,visit_day)
);

alter table public.site_visit_daily enable row level security;
drop policy if exists "site visit daily direct access disabled" on public.site_visit_daily;
revoke all on public.site_visit_daily from public,anon,authenticated;

create or replace function public.register_page_visit()
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  total bigint;
  visitor uuid := auth.uid();
  inserted_count integer := 0;
begin
  if visitor is not null then
    insert into public.site_visit_daily(user_id,visit_day) values(visitor,current_date)
    on conflict(user_id,visit_day) do nothing;
    get diagnostics inserted_count = row_count;
  else
    inserted_count := 1;
  end if;

  if inserted_count > 0 then
    insert into public.site_stats(id,access_count,updated_at) values(1,1,now())
    on conflict(id) do update set access_count=public.site_stats.access_count+1,updated_at=now()
    returning access_count into total;
  else
    select access_count into total from public.site_stats where id=1;
  end if;

  if random()<0.01 then delete from public.site_visit_daily where visit_day<current_date-30; end if;
  return coalesce(total,0);
end;
$$;

revoke all on function public.register_page_visit() from public,anon,authenticated;
grant execute on function public.register_page_visit() to authenticated;
notify pgrst, 'reload schema';
