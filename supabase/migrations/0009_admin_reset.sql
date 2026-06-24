-- Arraiá do Tesouro — permite o organizador AUTENTICADO zerar o ranking/competição
-- Rode no Supabase: SQL Editor → Run. (idempotente)

-- apagar tempos do ranking
drop policy if exists scores_delete_auth on public.scores;
create policy scores_delete_auth on public.scores
  for delete to authenticated using (true);

-- apagar eventos (pra zerar a prova social "abriu o baú" e limpar logs)
drop policy if exists events_delete_auth on public.events;
create policy events_delete_auth on public.events
  for delete to authenticated using (true);
