-- Arraiá do Tesouro — permite curiosidade do tipo "vídeo (arquivo)"
-- Rode no Supabase: SQL Editor → Run. (idempotente)
--
-- O admin agora sobe o arquivo .mp4 (ex: Reels do Instagram baixado) direto pro
-- bucket "curiosidades" e o jogo toca embutido. Pra isso, 'video' precisa entrar
-- na lista de tipos de mídia permitidos.

alter table public.cards drop constraint if exists cards_media_check;
alter table public.cards add constraint cards_media_check
  check (media is null or media in ('texto','imagem','youtube','spotify','audio','video'));
