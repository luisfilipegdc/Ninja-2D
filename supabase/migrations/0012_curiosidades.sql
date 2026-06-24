-- Arraiá do Tesouro — 5 curiosidades juninas pré-cadastradas (escola)
-- Cada uma de um estado/região diferente, em linguagem pra criança.
-- Rode no Supabase: SQL Editor → Run. (idempotente — não duplica)
--
-- Depois é só ir no /admin, gravar cada código numa tag NFC e/ou imprimir o QR.
-- Os códigos são: curio-pb, curio-pe, curio-ma, curio-mg, curio-ba

insert into public.cards (code, game_id, kind, media, title, body) values
  ('curio-pb', 'arraia', 'curiosidade', 'texto',
   'Paraíba: o Maior São João do Mundo 🎪',
   'Na cidade de Campina Grande, na Paraíba, acontece "O Maior São João do Mundo"! É um arraial gigante com fogueira, quadrilha e forró por mais de 30 dias. Imagina a festa! 🔥🪗'),

  ('curio-pe', 'arraia', 'curiosidade', 'texto',
   'Pernambuco: a terra do forró 🪗',
   'Foi de Pernambuco que veio Luiz Gonzaga, o "Rei do Baião", que espalhou o forró e a sanfona pelo Brasil todo. E em Caruaru (PE) tem um dos maiores São João do país! 🎶'),

  ('curio-ma', 'arraia', 'curiosidade', 'texto',
   'Maranhão: o Bumba meu boi 🐂',
   'No Maranhão, o São João é comemorado com o Bumba meu boi: uma brincadeira com dança, música e um boi encantado. É tão especial que virou Patrimônio Cultural do Brasil! ✨'),

  ('curio-mg', 'arraia', 'curiosidade', 'texto',
   'Minas Gerais: as comidas de milho 🌽',
   'Sabe por que o arraiá tem tanta comida de milho? Porque junho é época da colheita! Em Minas é uma delícia: canjica, pamonha, curau e bolo de fubá. Hummm! 😋'),

  ('curio-ba', 'arraia', 'curiosidade', 'texto',
   'Bahia: São João tamanho Carnaval 🎉',
   'Na Bahia o São João é quase do tamanho do Carnaval! Tem forró pé de serra, fogueira, quadrilha e bandeirinhas coloridas pra todo mundo dançar a noite inteira. 💃🕺')
on conflict (code) do nothing;
