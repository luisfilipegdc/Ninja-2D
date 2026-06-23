-- Arraiá do Tesouro — logs de eventos (atividade + auditoria)
-- Rode no Supabase: SQL Editor → Run. (idempotente)
--
-- Registra:
--   - scan:     jogador leu uma tag (actor = nome, code = tag, detail = conteúdo)
--   - complete: jogador concluiu o cadeado (actor = nome)
--   - admin:    ação do organizador (actor = e-mail, detail = ação)

create table if not exists public.events (
  id        bigint generated always as identity primary key,
  game_id   text not null default 'arraia',
  at        timestamptz not null default now(),
  kind      text not null check (kind in ('scan','complete','admin')),
  actor     text,
  code      text,
  detail    text
);

create index if not exists events_game_at on public.events (game_id, at desc);

alter table public.events enable row level security;

-- jogadores (anônimos) e admin podem INSERIR eventos
drop policy if exists events_insert_public on public.events;
create policy events_insert_public on public.events for insert with check (true);

-- só o organizador AUTENTICADO LÊ os logs
drop policy if exists events_select_auth on public.events;
create policy events_select_auth on public.events for select to authenticated using (true);

grant insert on public.events to anon, authenticated;
grant select on public.events to authenticated;
