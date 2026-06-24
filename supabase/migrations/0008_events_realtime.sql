-- Arraiá do Tesouro — habilita Realtime na tabela de eventos
-- (prova social ao vivo: avisar todos os celulares quando alguém abre o baú).
-- Rode no Supabase: SQL Editor → Run. (idempotente)

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
