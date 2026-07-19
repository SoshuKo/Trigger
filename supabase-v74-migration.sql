alter table if exists public.profiles add column if not exists squad_name text;
alter table if exists public.profiles add column if not exists character_color text default '#65e8ff';
alter table if exists public.profiles add column if not exists squad_emblem text;
alter table if exists public.profiles add column if not exists favorite_loadout jsonb;

create or replace function public.get_page_visit_count() returns bigint language sql security definer set search_path=public as $$ select count(*)::bigint from public.page_visits; $$;
grant execute on function public.get_page_visit_count() to anon, authenticated;
