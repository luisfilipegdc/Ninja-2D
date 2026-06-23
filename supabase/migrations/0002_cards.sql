-- Arraiá do Tesouro — cartões da caçada (NFC/QR)
-- Rode no Supabase: Dashboard → SQL Editor → New query → Run.
-- Projeto: wlmbsqjiphzojcvnzjvd  (idempotente)
--
-- Cada cartão físico tem um CÓDIGO (ex: af6a49c5) gravado na tag como URL
-- (…/?c=af6a49c5). Há dois tipos:
--   - senha:       revela 1 dígito da senha e sua POSIÇÃO (1..6) p/ abrir o baú
--   - curiosidade: conteúdo sobre festa junina (texto, imagem, youtube, áudio, link)

create table if not exists public.cards (
  code        text primary key,                                  -- ID do cartão
  game_id     text not null default 'arraia',                    -- agrupa por evento
  kind        text not null check (kind in ('senha','curiosidade')),

  -- senha
  position    int      check (position between 1 and 6),
  digit       smallint check (digit between 0 and 9),
  hint        text,                                              -- dica opcional

  -- curiosidade
  media       text check (media in ('texto','imagem','youtube','audio','link')),
  title       text,
  body        text,                                              -- texto OU url do conteúdo

  created_at  timestamptz not null default now(),

  -- coerência por tipo
  constraint senha_fields check (
    kind <> 'senha' or (position is not null and digit is not null)
  ),
  constraint curio_fields check (
    kind <> 'curiosidade' or (media is not null and body is not null)
  )
);

-- só um cartão por posição da senha, dentro do mesmo evento
create unique index if not exists cards_senha_pos
  on public.cards (game_id, position) where kind = 'senha';

alter table public.cards enable row level security;

-- jogadores leem o conteúdo do cartão ao escanear (público)
drop policy if exists cards_select_public on public.cards;
create policy cards_select_public on public.cards for select using (true);

-- só o admin AUTENTICADO cria/edita/apaga cartões
drop policy if exists cards_write_auth on public.cards;
create policy cards_write_auth on public.cards
  for all to authenticated using (true) with check (true);
