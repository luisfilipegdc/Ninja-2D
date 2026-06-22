# 🔥 Arraiá do Tesouro — PWA de caça ao tesouro pra festa junina

Caça ao tesouro gamificada com QR Codes, feita como **PWA** que roda no
**iOS (Safari) e Android (Chrome)**. Funciona offline e **não precisa de
servidor**: cada QR Code carrega a sua própria pista criptografada.

## Fluxo do jogo

1. **QR de Largada** (na entrada) → abre a caçada e mostra a 1ª pista
2. **Pista na tela** → o jogador procura o local e acha o QR escondido
3. **Escanear (desenterrar)** → confete + revela a próxima pista
4. Repete até o último tesouro → **tempo final + ranking**

A ordem é obrigatória: escanear um tesouro fora de sequência não conta, e os
QR Codes têm checksum, então não dá pra forjar um QR qualquer.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | App inteiro (6 telas, scanner, admin, confete) |
| `manifest.json` | Metadados do PWA |
| `sw.js` | Service worker (cache offline) |
| `icons/` | Ícones (fogueira) |
| `make_icons.py` | Script que gera os ícones |

## Como publicar (HTTPS é obrigatório pra PWA + câmera)

O app vive na **raiz do repositório**, então é só apontar um host estático
com HTTPS grátis para ele:

- **Vercel**: já conectado — cada push faz deploy automático.
- **Netlify / Cloudflare Pages**: arraste a pasta e está no ar.
- **GitHub Pages**: ative Pages apontando pra branch.

## Como usar na festa

1. Abra o app → **⚙️ Organizador**.
2. Defina a quantidade de tesouros (2 a 20), escreva a pista e escolha o emoji
   de cada um.
3. **Gerar QR Codes** → **Imprimir**. Recorte e esconda:
   - O **QR de Largada** vai na entrada.
   - Cada **QR de Tesouro N** vai no local descrito pela pista N.
4. Os convidados abrem o link (ou instalam: no iOS, Safari → Compartilhar →
   *Adicionar à Tela de Início*), digitam o nome e escaneiam a largada.

## Sobre o ranking

O ranking é salvo **por aparelho** (localStorage). Cada celular vê os tempos
de quem jogou nele. Para um **ranking ao vivo compartilhado entre todos os
celulares**, é preciso um backend — dá pra plugar o Supabase (já disponível
no projeto): uma tabela `scores` + insert no fim do jogo + leitura ordenada
por tempo. É o próximo passo natural se quiser competição em tempo real de
verdade.

## Sobre NFC (contexto da conversa)

A ideia inicial usava cartões NFC, mas **o iOS bloqueia a Web NFC API** — não
há como ler NFC por PWA/web no iPhone. Por isso o jogo usa **QR Code via
câmera**, que funciona 100% em iOS e Android. Mesma dinâmica de "cartões
escondidos", sem a limitação da Apple.
