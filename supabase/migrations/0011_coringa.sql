-- Arraiá do Tesouro — novo tipo de tag: CORINGA (efeito variável por nível)
-- Rode no Supabase: SQL Editor → Run. (idempotente)

alter table public.cards drop constraint if exists cards_kind_check;
alter table public.cards add constraint cards_kind_check
  check (kind in ('senha', 'curiosidade', 'coringa'));
