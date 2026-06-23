-- Arraiá do Tesouro — Storage das curiosidades + tipos de mídia
-- Rode no Supabase: SQL Editor → Run. (idempotente)
--
-- Cria o bucket público "curiosidades" pra o admin SUBIR imagem/áudio direto
-- (fica hospedado no projeto), e ajusta os tipos de mídia (troca 'link' por
-- 'spotify' — tudo passa a tocar DENTRO do app, sem o usuário sair).

-- bucket público
insert into storage.buckets (id, name, public)
values ('curiosidades', 'curiosidades', true)
on conflict (id) do nothing;

-- leitura pública dos arquivos
drop policy if exists curio_read on storage.objects;
create policy curio_read on storage.objects
  for select using (bucket_id = 'curiosidades');

-- só o admin autenticado sobe/edita/apaga
drop policy if exists curio_insert on storage.objects;
create policy curio_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'curiosidades');

drop policy if exists curio_update on storage.objects;
create policy curio_update on storage.objects
  for update to authenticated using (bucket_id = 'curiosidades');

drop policy if exists curio_delete on storage.objects;
create policy curio_delete on storage.objects
  for delete to authenticated using (bucket_id = 'curiosidades');

-- tipos de mídia: 'link' sai, entra 'spotify' (música)
alter table public.cards drop constraint if exists cards_media_check;
alter table public.cards add constraint cards_media_check
  check (media is null or media in ('texto','imagem','youtube','spotify','audio'));
