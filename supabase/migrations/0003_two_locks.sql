-- Arraiá do Tesouro — 2 senhas de 3 dígitos (cadeados independentes)
-- Rode no Supabase: SQL Editor → Run. (idempotente)
--
-- Mudança: cada cartão de "senha" agora pertence a um CADEADO (lock 1 ou 2).
-- Cada cadeado tem 3 posições (1..3). São, portanto, 2 senhas independentes
-- de 3 dígitos. As curiosidades não mudam.

alter table public.cards add column if not exists lock smallint;

alter table public.cards drop constraint if exists cards_lock_chk;
alter table public.cards add constraint cards_lock_chk
  check (lock is null or lock between 1 and 2);

-- senha agora exige lock + position(1..3) + digit
alter table public.cards drop constraint if exists senha_fields;
alter table public.cards add constraint senha_fields check (
  kind <> 'senha' or (lock is not null and position between 1 and 3 and digit is not null)
);

-- unicidade por (evento, cadeado, posição)
drop index if exists cards_senha_pos;
create unique index if not exists cards_senha_lock_pos
  on public.cards (game_id, lock, position) where kind = 'senha';
