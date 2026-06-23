# 🔥 Arraiá do Tesouro — PWA de caça ao tesouro pra festa junina

Caça ao tesouro gamificada com **tags NFC** (e QR Code como reserva), feita
como **PWA** que roda no **Android (Chrome) e iOS (Safari)**. Funciona offline
e **não precisa de servidor**.

## Como funciona

Há **vários cartões** (tags NFC, com QR de reserva) escondidos pelo arraiá. Cada
cartão tem um **código** (ex: `af6a49c5`) e é de um de dois tipos:

- **Senha:** são **2 cadeados independentes, cada um com senha de 3 dígitos**
  (6 cartões no total). Cada cartão revela **1 dígito + a casa (1–3)** do seu
  cadeado. Cada cadeado abre um **baú/cadeado físico** — dá pra usar em momentos
  diferentes da festa.
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
- Botão **"Sem NFC? Usar a câmera (QR)"** sempre disponível como alternativa.

## Tela cheia ("tipo app")

- **Android:** ao iniciar a caçada o app pede tela cheia (Fullscreen API).
- **iOS:** o Safari não dá tela cheia por web; para o efeito "tipo app", a tela
  inicial mostra como **instalar** (Compartilhar → *Adicionar à Tela de Início*).
  Aberto pela Tela de Início, roda em modo standalone, sem barras do navegador.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | App inteiro (telas, scanner NFC/QR, admin, confete) |
| `manifest.json` | Metadados do PWA |
| `sw.js` | Service worker (cache offline) |
| `icons/` | Ícones (fogueira) |
| `make_icons.py` | Script que gera os ícones |

## Como publicar (HTTPS é obrigatório pra PWA, NFC e câmera)

O app vive na **raiz do repositório**:

- **Vercel**: já conectado — cada push faz deploy automático.
- **Netlify / Cloudflare Pages**: arraste a pasta e está no ar.
- **GitHub Pages**: ative Pages apontando pra branch.

## Como montar a caçada (organizador)

1. Abra o app → **⚙️ Organizador**.
2. Defina a quantidade de tesouros (2 a 20), escreva a pista e escolha o emoji
   de cada um.
3. **Gerar QR de início + tags**:
   - **QR de Início** → imprima e cole na entrada. Ele carrega a caçada inteira
     na URL, então qualquer celular que escaneia abre o jogo já configurado.
   - **Cada tesouro** → no Android, toque em **📡 Gravar tag NFC** e encoste numa
     tag NTAG para gravá-la; para iPhones, **imprima o QR de reserva** do tesouro.
4. Esconda cada tag/QR no local descrito pela sua pista.

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
2. Rode `supabase/migrations/0002_cards.sql` e `0003_two_locks.sql` — cartões da
   caçada (tabela `cards` + RLS + 2 cadeados de 3 dígitos).
3. Crie o **usuário admin**: Authentication → Add user → e-mail + senha (marque
   "Auto Confirm"). É com ele que o painel do organizador entra pra gerenciar os cartões.
