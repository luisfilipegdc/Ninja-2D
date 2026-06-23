-- Arraiá do Tesouro — cadeado único + localização física das tags
-- Rode no Supabase: SQL Editor → Run. (idempotente)
--
-- Mudança: agora existe UM único cadeado (lock = 1). As 3 tags de senha
-- ficam fixas no lugar e o admin randomiza qual tag revela qual dígito.
-- Cada tag ganha um campo de LOCALIZAÇÃO física (onde está escondida).

alter table public.cards add column if not exists location text;

-- (lock continua existindo; passamos a usar sempre lock = 1)
