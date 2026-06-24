-- Arraiá do Tesouro — colunas de página rica + as 16 tags físicas pré-cadastradas
-- Rode no Supabase: SQL Editor → Run. (idempotente)
--
-- Página de curiosidade agora tem: título, subtítulo, imagem e descrição.
--   subtitle  → subtítulo
--   image_url → imagem (URL pública; suba pelo /admin)
--   body      → descrição (texto) OU link do YouTube/Spotify OU URL de arquivo
--
-- As 16 tags abaixo já entram com o serial físico de cada chip NFC como `code`.
-- É só ir no /admin e preencher o conteúdo das curiosidades (título/imagem/vídeo).

alter table public.cards add column if not exists subtitle  text;
alter table public.cards add column if not exists image_url text;

-- Os 16 chips (serial do leitor) com o papel de cada um.
-- Senhas seedadas com o cadeado 120 (casa1=1, casa2=2, casa3=0).
-- Troque pra 476 a qualquer momento no /admin (botão de combo).
insert into public.cards (code, game_id, kind, lock, position, digit, media, title, subtitle, body, image_url, location) values
  -- 1..3 — SENHA (cadeado 120)
  ('53630ea4500001','arraia','senha', 1, 1, 1, null, null, null, null, null, 'Tag 1 · senha (casa 1)'),
  ('53d9bda3500001','arraia','senha', 1, 2, 2, null, null, null, null, null, 'Tag 2 · senha (casa 2)'),
  ('53050ba4500001','arraia','senha', 1, 3, 0, null, null, null, null, null, 'Tag 3 · senha (casa 3)'),
  -- 4..6 — CORINGA (sem conteúdo; efeito gerado no jogo)
  ('533ef9a3500001','arraia','coringa', null, null, null, null, null, null, null, null, 'Tag 4 · coringa'),
  ('536613a4500001','arraia','coringa', null, null, null, null, null, null, null, null, 'Tag 5 · coringa'),
  ('53bfb8a3500001','arraia','coringa', null, null, null, null, null, null, null, null, 'Tag 6 · coringa'),
  -- 7..9 — CURIOSIDADE rica (título + subtítulo + imagem + descrição)
  ('53dfeea3500001','arraia','curiosidade', null, null, null, 'imagem', 'Curiosidade 1', 'Subtítulo aqui', 'Descrição — edite no /admin', null, 'Tag 7 · curiosidade rica'),
  ('53eed9a3500001','arraia','curiosidade', null, null, null, 'imagem', 'Curiosidade 2', 'Subtítulo aqui', 'Descrição — edite no /admin', null, 'Tag 8 · curiosidade rica'),
  ('53a4e2a3500001','arraia','curiosidade', null, null, null, 'imagem', 'Curiosidade 3', 'Subtítulo aqui', 'Descrição — edite no /admin', null, 'Tag 9 · curiosidade rica'),
  -- 10..11 — CURIOSIDADE só imagem (título + imagem)
  ('53a8e9a3500001','arraia','curiosidade', null, null, null, 'imagem', 'Pratos típicos', null, null, null, 'Tag 10 · Pratos típicos'),
  ('532fdfa3500001','arraia','curiosidade', null, null, null, 'imagem', 'Vestimenta',    null, null, null, 'Tag 11 · Vestimenta'),
  -- 12..16 — CURIOSIDADE vídeo do YouTube (cole o link no body pelo /admin)
  ('5311f4a3500001','arraia','curiosidade', null, null, null, 'youtube', 'Vídeo 1', null, '', null, 'Tag 12 · vídeo'),
  ('5361c8a3500001','arraia','curiosidade', null, null, null, 'youtube', 'Vídeo 2', null, '', null, 'Tag 13 · vídeo'),
  ('531dc3a3500001','arraia','curiosidade', null, null, null, 'youtube', 'Vídeo 3', null, '', null, 'Tag 14 · vídeo'),
  ('53a5cda3500001','arraia','curiosidade', null, null, null, 'youtube', 'Vídeo 4', null, '', null, 'Tag 15 · vídeo'),
  ('53add4a3500001','arraia','curiosidade', null, null, null, 'youtube', 'Vídeo 5', null, '', null, 'Tag 16 · vídeo')
on conflict (code) do nothing;
