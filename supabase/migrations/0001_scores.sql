-- Arraiá do Tesouro — ranking ao vivo
-- Rode este SQL no Supabase: Dashboard → SQL Editor → New query → Run.
-- Projeto: wlmbsqjiphzojcvnzjvd
-- (idempotente: pode rodar mais de uma vez sem erro)

create table if not exists public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null,                 -- identifica cada caçada (config)
  name        text not null check (char_length(name) between 1 and 40),
  ms          integer not null check (ms > 0 and ms < 86400000),
  total       integer not null check (total between 1 and 100),
  created_at  timestamptz not null default now()
);

create index if not exists scores_game_ms_idx on public.scores (game_id, ms);

-- RLS: jogo de festa, sem login. Leitura e inserção públicas, com validação.
alter table public.scores enable row level security;

drop policy if exists scores_select_public on public.scores;
create policy scores_select_public on public.scores
  for select using (true);

drop policy if exists scores_insert_public on public.scores;
create policy scores_insert_public on public.scores
  for insert with check (
    char_length(name) between 1 and 40
    and ms > 0 and ms < 86400000
    and total between 1 and 100
  );

-- Realtime (atualização ao vivo do ranking)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scores'
  ) then
    alter publication supabase_realtime add table public.scores;
  end if;
end $$;
