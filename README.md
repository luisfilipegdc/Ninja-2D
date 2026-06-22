# 🔥 Arraiá do Tesouro — PWA de caça ao tesouro pra festa junina

Caça ao tesouro gamificada com **tags NFC** (e QR Code como reserva), feita
como **PWA** que roda no **Android (Chrome) e iOS (Safari)**. Funciona offline
e **não precisa de servidor**.

## Fluxo do jogo

1. **QR de Início** (na entrada) → abre o app já configurado, **em tela cheia**,
   e pede o nome do jogador
2. Jogador digita o nome → **inicia a caçada** (cronômetro começa)
3. **Pista na tela** → o jogador procura o local e **encosta o celular na tag NFC**
   (ou aponta a câmera no QR de reserva)
4. Tesouro desenterrado → confete + próxima pista
5. Repete até o último tesouro → **tempo final + ranking**

A ordem é obrigatória: ler um tesouro fora de sequência não conta, e o
conteúdo das tags/QR tem checksum, então não dá pra forjar.

## NFC + QR: por que os dois?

| Plataforma | NFC (Web NFC) | QR (câmera) |
|---|:---:|:---:|
| **Android (Chrome 89+)** | ✅ lê e grava tags | ✅ |
| **iPhone / iPad (iOS)** | ❌ bloqueado pela Apple | ✅ |

O **iOS não suporta Web NFC** — é um bloqueio do sistema, sem workaround por
web/PWA. Por isso o app usa **NFC quando o aparelho tem (Android)** e cai
**automaticamente para QR pela câmera** quando não tem (iPhones). Mesma tag,
mesmo conteúdo, mesma lógica — só muda como o celular lê. Dentro do jogo, o
botão **"Sem NFC? Usar a câmera (QR)"** troca o método a qualquer momento.

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

## Sobre o ranking

O ranking é salvo **por aparelho** (localStorage). Para um **ranking ao vivo
compartilhado entre todos os celulares**, é preciso um backend — dá pra plugar
o Supabase (já disponível no projeto): uma tabela `scores` + insert no fim do
jogo + leitura ordenada por tempo. É o próximo passo natural se quiser
competição em tempo real de verdade.
