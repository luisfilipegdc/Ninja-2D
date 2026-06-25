# 🔥 Arraiá do Tesouro — PWA de caça ao tesouro pra festa junina

Caça ao tesouro gamificada com **tags NFC** (e QR Code como reserva), feita
como **PWA** (Next.js) que roda no **Android (Chrome) e iOS (Safari)**, com
**Supabase** guardando cartões, ranking e o período ativo.

## Como funciona

Há **vários cartões** (tags NFC, com QR de reserva) escondidos pelo arraiá. Cada
cartão tem um **código** (ex: `af6a49c5`) e é de um de dois tipos:

- **Senha:** há **2 cadeados, cada um com senha de 3 dígitos**. **Só um fica
  ativo por vez** (o organizador escolhe o período no admin — nunca os dois
  juntos). Cada cartão de senha revela **1 dígito + a casa (1–3)** do seu
  cadeado, e cada cadeado abre um baú/cadeado físico.
- **Curiosidade** (os demais): conteúdo sobre festa junina — **texto, imagem,
  vídeo do YouTube, áudio ou link**. Servem pra manter o jogo divertido.

## Fluxo do jogo

1. **QR de entrada** → abre o app **em tela cheia** e pede o nome do jogador.
2. **Iniciar caçada** (cronômetro começa) → vai pro **hub**.
3. **Hub:** os **2 cadeados** (3 casinhas cada) ficam sempre visíveis + botão
   **Escanear cartão**. Recado claro: **ache os cartões em qualquer ordem** —
   cada número já vai pra sua casinha sozinho (não é uma sequência).
4. Escaneia → o app busca o cartão pelo código e revela:
   - **senha** → preenche uma casinha do cadeado certo (momento épico, com fogos);
   - **curiosidade** → mostra o conteúdo (texto/imagem/vídeo/áudio/link).
5. Quando um cadeado completa os **3 dígitos** → o app mostra a senha pra abrir
   aquele cadeado físico e registra o tempo no **ranking ao vivo daquele cadeado**.

O design segue princípios de **design comportamental** (cadeados sempre visíveis =
meta-gradiente; cada scan é uma recompensa variável; "qualquer ordem" pra não
confundir; loop de 1 toque) pra ficar rápido e não enjoar.

## NFC no iPhone E no Android (a sacada)

As tags são gravadas com um **registro de URL** apontando pro app
(`…/?t=<tesouro>`). Com isso, **uma única tag** funciona em todo lugar:

| Plataforma | Como lê a tag |
|---|---|
| **iPhone / iPad (iOS 14+)** | **Background Tag Reading**: encosta o topo do iPhone na tag → o iOS mostra um banner e **abre a URL no Safari sozinho** (sem app aberto, sem Web NFC). O app reconhece o tesouro pela URL e avança. |
| **Android (Chrome 89+)** | **Web NFC** (`NDEFReader`) lê a tag dentro do app; e se o app não estiver na frente, o próprio Android abre a URL. |
| **Qualquer um** | O **QR Code** com a mesma URL funciona pela câmera, como reserva. |

> A **Web NFC em JavaScript** continua bloqueada no iOS — o truque é não depender
> dela: o iOS lê a tag no nível do sistema e abre a URL. Por isso a tag é um
> registro de **URL**, não de texto.

Para a caçada continuar entre um toque e outro (cada toque no iOS recarrega a
página no Safari), o app **salva a sessão** (nome, tempo e progresso) no
aparelho e retoma de onde parou.

### Importante pro iOS
- Jogue pelo **Safari** (é onde a tag abre). Instalar na Tela de Início é ótimo
  pra tela cheia, mas o toque na tag abre o Safari — então mantenha a partida lá.
- As tags precisam ser **graváveis num Android** (o iPhone não grava tags por
  web). Depois de gravadas, funcionam no iPhone normalmente.
- Sem NFC no aparelho? Aponte a **câmera nativa do celular** no **QR do cartão**
  (impresso pelo admin) — ela abre a URL e o jogo processa igual. (O leitor de
  QR dentro do app foi removido; quem lê o QR é a câmera do sistema.)

## Tela cheia ("tipo app")

- **Android:** ao iniciar a caçada o app pede tela cheia (Fullscreen API).
- **iOS:** o Safari não dá tela cheia por web; para o efeito "tipo app", a tela
  inicial mostra como **instalar** (Compartilhar → *Adicionar à Tela de Início*).
  Aberto pela Tela de Início, roda em modo standalone, sem barras do navegador.

## Stack & arquivos

App em **Next.js (App Router) + TypeScript** + **Supabase** (cartões, ranking,
período ativo). O jogo todo é client-side (PWA, NFC, câmera).

| Caminho | Função |
|---|---|
| `app/` | layout, página e `globals.css` (o visual bespoke) |
| `components/Game.tsx` | o app inteiro (telas, scanner NFC/QR, cofres, admin) |
| `lib/supabase.ts` | cliente Supabase (lê `NEXT_PUBLIC_SUPABASE_*`) |
| `public/` | `manifest.json`, `sw.js`, `icons/` |
| `supabase/migrations/` | SQL (scores, cards, 2 cadeados, período ativo) |

## Rodar localmente

```bash
npm install
# crie .env.local com as credenciais do Supabase:
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm run dev      # http://localhost:3000
npm run build    # build de produção
```

## Publicar (Vercel)

O Vercel detecta o Next.js automaticamente — cada push faz deploy. As
credenciais vêm das **env vars** (`NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY`), idealmente via a **integração Supabase ↔
Vercel** (sincronize ao menos em *Production*). HTTPS é obrigatório pra PWA,
NFC e câmera.

## Como montar a caçada (organizador)

1. Abra o app → **⚙️ Organizador** → entre com o usuário admin do Supabase.
2. **Período ativo:** escolha qual cadeado vale agora (**1 ou 2** — só um por vez).
3. **+ Novo cartão**:
   - **senha** → cadeado (1/2) + casa (1–3) + dígito (+ dica);
   - **curiosidade** → texto, imagem, YouTube, áudio ou link.
4. Em cada cartão: **📡 Gravar tag NFC** (Android) e/ou imprima o **QR**.
5. Esconda os cartões pelo arraiá. Troque o período ativo conforme a festa.

> Quer testar rápido? Abra a URL do app **sem QR**: ele entra em **modo
> demonstração** com 3 tesouros de exemplo.

## Ranking ao vivo (Supabase)

O ranking é **compartilhado entre todos os celulares e atualiza ao vivo** via
Supabase. Cada caçada tem seu próprio placar (chave `game_id` derivada da
configuração), então hunts diferentes não se misturam. Se o aparelho estiver
offline (ou o Supabase indisponível), o jogo cai pro ranking local por aparelho.

Como funciona:
- No fim do jogo o app insere `{game_id, name, ms, total}` na tabela `scores`.
- As telas de resultado e de ranking leem o top por tempo e **assinam** as novas
  pontuações (Realtime), atualizando sozinhas quando outra pessoa termina.
- A **URL** do projeto e a **chave publishable** ficam no front-end (é seguro —
  protegido por Row Level Security). A senha do banco **nunca** entra no código.

Setup do Supabase (uma vez), no **SQL Editor**:
1. Rode `supabase/migrations/0001_scores.sql` — ranking (tabela `scores` + RLS + Realtime).
2. Rode `0002_cards.sql`, `0003_two_locks.sql` e `0004_game_state.sql` — cartões
   da caçada (2 cadeados de 3 dígitos) e o período ativo (qual cadeado vale agora).
3. Crie o **usuário admin**: Authentication → Add user → e-mail + senha (marque
   "Auto Confirm"). É com ele que o painel do organizador entra pra gerenciar os cartões.

## Mapa interativo da festa (`/mapa`)

Versão **realmente interativa** do "Mapa Interativo Festa Junina 2026" — que antes
era só um PDF com botões desenhados. Abra em `…/mapa` (ex.:
`https://festajuninamarista.vercel.app/mapa`):

- **Navegação por abas** (Mapa · Ginásio · Palco · Cardápio), **deep-link por hash**
  (`/mapa#cardapio`) e suporte ao botão voltar do navegador.
- **Mapa e Ginásio** com **pontos clicáveis** e **zoom/pan**: cada local abre um
  cartão com descrição e atalhos contextuais (ex.: a Praça de Alimentação leva ao
  cardápio; a Entrada do Ginásio troca de planta).
- **Programação ao vivo**: destaca a apresentação que está **acontecendo agora** e
  a **próxima** (com contagem regressiva), tem **busca por turma** (ex.: `5º C`,
  `INF 3`) e botão de compartilhar.
- **Cardápio interativo**: busca por item, filtro por barraca e **"minha sacola"**
  com **total em R$** (salvo no aparelho via `localStorage`) e compartilhamento.

Todo o conteúdo (locais, setores, programação e preços) foi transcrito do PDF para
`app/mapa/data.ts` — é só editar lá para atualizar textos, horários ou preços. As
artes ficam em `public/mapa/*.webp` (exportadas do PDF e otimizadas, ~320 KB no
total). A experiência é client-side e funciona como PWA, igual ao resto do app.
