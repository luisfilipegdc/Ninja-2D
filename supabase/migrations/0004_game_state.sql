-- Arraiá do Tesouro — período ativo (qual cadeado vale agora)
-- Rode no Supabase: SQL Editor → Run. (idempotente)
--
-- Só UM cadeado fica ativo por vez (1 ou 2). O admin troca conforme o
-- momento da festa; os jogadores recebem a mudança ao vivo (Realtime).

create table if not exists public.game_state (
  game_id     text primary key,
  active_lock smallint not null default 1 check (active_lock between 1 and 2),
  updated_at  timestamptz not null default now()
);

alter table public.game_state enable row level security;

drop policy if exists game_state_select_public on public.game_state;
create policy game_state_select_public on public.game_state for select using (true);

drop policy if exists game_state_write_auth on public.game_state;
create policy game_state_write_auth on public.game_state
  for all to authenticated using (true) with check (true);

insert into public.game_state (game_id, active_lock)
  values ('arraia', 1) on conflict (game_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='game_state'
  ) then
    alter publication supabase_realtime add table public.game_state;
  end if;
end $$;
