// Dados do Mapa Interativo — Festa Junina 2026 · Colégio Marista de Brasília
// Transcritos fielmente do PDF "Mapa Interativo Festa Junina 2026 (FINAL)".

export type Screen = "capa" | "inicio" | "mapa" | "ginasio" | "programacao" | "cardapio";

export type Hotspot = {
  id: string;
  label: string;
  emoji?: string;
  desc?: string;
  /** posição em % da imagem (canto superior esquerdo) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** se definido, tocar navega para outra tela ao invés de abrir o cartão */
  goto?: Screen;
  /** estilo do alvo */
  kind?: "zona" | "ponto" | "nav";
};

export type Slot = {
  hora: string;
  grupo: string;
  periodo?: string;
  turmas: string[];
};

export type ItemCardapio = { nome: string; preco: number };
export type Barraca = {
  id: string;
  nome: string;
  emoji: string;
  /** "comida" aparece no cálculo da sacola; "diversao" são brincadeiras/atrações */
  tipo: "comida" | "diversao";
  itens: ItemCardapio[];
};

// As imagens são 3:4 (mesma proporção do PDF). aspect = largura/altura.
export const ASSETS = {
  capa: { src: "/mapa/capa.webp", aspect: 1500 / 2001 },
  mapa: { src: "/mapa/mapa.webp", aspect: 1900 / 2535 },
  ginasio: { src: "/mapa/ginasio.webp", aspect: 1600 / 2135 },
} as const;

// ───────────────────────── Mapa principal ─────────────────────────
export const mapaPontos: Hotspot[] = [
  { id: "praca", label: "Praça de Alimentação", emoji: "🍢", kind: "zona",
    desc: "Barracas de comida montadas nas quadras. É aqui que rola a maior parte do cardápio — veja tudo na aba Cardápio.",
    x: 28, y: 20, w: 46, h: 23 },
  { id: "inflaveis", label: "Brinquedos Infláveis", emoji: "🎪", kind: "zona",
    desc: "Circuito de infláveis para a criançada. Passaporte de 30 min ou livre na barraca.",
    x: 19, y: 21, w: 8, h: 12 },
  { id: "dancas", label: "Oficina de Danças", emoji: "💃", kind: "zona",
    desc: "Espaço das danças típicas e quadrilha.",
    x: 19, y: 33, w: 8, h: 11 },
  { id: "bebidas", label: "Bebidas", emoji: "🥤", kind: "zona",
    desc: "Água, suco e refrigerante geladinhos.",
    x: 76, y: 25, w: 7, h: 16 },
  { id: "caixa", label: "Caixa", emoji: "💳", kind: "ponto",
    desc: "Compre suas fichas/cartão de consumo aqui antes de ir às barracas.",
    x: 50, y: 45, w: 18, h: 6 },
  { id: "ban1", label: "Banheiros", emoji: "🚻", kind: "ponto",
    desc: "Sanitários disponíveis para o público.",
    x: 13, y: 48, w: 11, h: 10 },
  { id: "ban2", label: "Banheiros", emoji: "🚻", kind: "ponto",
    desc: "Sanitários disponíveis para o público.",
    x: 63, y: 45, w: 10, h: 8 },
  { id: "patio-aberto", label: "Pátio Aberto", emoji: "⛲", kind: "zona",
    desc: "Área de convivência ao ar livre, no coração da festa.",
    x: 27, y: 51, w: 45, h: 13 },
  { id: "brincadeiras", label: "Brincadeiras e Pescaria", emoji: "🎯", kind: "zona",
    desc: "Pescaria, boca do palhaço, garra e estalinho. Diversão garantida!",
    x: 73, y: 56, w: 17, h: 9 },
  { id: "entrada-ginasio", label: "Entrada do Ginásio", emoji: "🏟️", kind: "nav", goto: "ginasio",
    desc: "Acesso ao ginásio, onde acontecem as apresentações.",
    x: 13, y: 64, w: 16, h: 9 },
  { id: "enfermaria", label: "Enfermaria", emoji: "⛑️", kind: "ponto",
    desc: "Posto de primeiros socorros. Qualquer coisa, procure a equipe aqui.",
    x: 65, y: 65, w: 15, h: 6 },
  { id: "atividade", label: "Atividade Interativa", emoji: "🎮", kind: "zona",
    desc: "Espaço de atividades interativas para todas as idades.",
    x: 65, y: 71, w: 15, h: 7 },
  { id: "patio-central", label: "Pátio Central", emoji: "🎪", kind: "zona",
    desc: "Praça central da festa, ponto de encontro entre as áreas.",
    x: 28, y: 65, w: 37, h: 24 },
  { id: "foto", label: "Ponto de Foto", emoji: "📸", kind: "ponto",
    desc: "Cenário junino para registrar a festa. Sorria! 📷",
    x: 43, y: 75, w: 10, h: 9 },
  { id: "concentracao", label: "Concentração", emoji: "📣", kind: "zona",
    desc: "Ponto de concentração das turmas antes de subir ao palco.",
    x: 16, y: 75, w: 20, h: 6 },
  { id: "catraca", label: "Entrada (Catraca)", emoji: "🎟️", kind: "ponto",
    desc: "Acesso principal à festa.",
    x: 43, y: 82, w: 11, h: 9 },
  { id: "nav-inicio", label: "Início", kind: "nav", goto: "capa",
    x: 11, y: 91, w: 22, h: 6 },
  { id: "nav-prog", label: "Programação", kind: "nav", goto: "programacao",
    x: 65, y: 91, w: 24, h: 6 },
];

// ───────────────────────── Ginásio ─────────────────────────
export const ginasioPontos: Hotspot[] = [
  { id: "saida-alunos", label: "Saída dos Alunos", emoji: "🚪", kind: "ponto",
    desc: "Saída destinada aos alunos.", x: 4, y: 17, w: 20, h: 7 },
  { id: "saida-familia", label: "Saída Família", emoji: "🚪", kind: "ponto",
    desc: "Saída destinada às famílias.", x: 76, y: 17, w: 20, h: 7 },
  { id: "setor3", label: "Setor 3", emoji: "🎫", kind: "zona",
    desc: "Arquibancada — Setor 3.", x: 19, y: 26, w: 15, h: 14 },
  { id: "setor6", label: "Setor 6", emoji: "🎫", kind: "zona",
    desc: "Arquibancada — Setor 6.", x: 66, y: 26, w: 15, h: 14 },
  { id: "quadra", label: "Quadra / Palco", emoji: "🎤", kind: "zona",
    desc: "Palco das apresentações. É aqui que cada turma se apresenta — veja os horários na Programação.",
    x: 35, y: 26, w: 30, h: 52 },
  { id: "setor2", label: "Setor 2", emoji: "🎫", kind: "zona",
    desc: "Arquibancada — Setor 2.", x: 19, y: 43, w: 15, h: 14 },
  { id: "setor5", label: "Setor 5", emoji: "🎫", kind: "zona",
    desc: "Arquibancada — Setor 5.", x: 66, y: 43, w: 15, h: 14 },
  { id: "setor1", label: "Setor 1", emoji: "🎫", kind: "zona",
    desc: "Arquibancada — Setor 1.", x: 19, y: 60, w: 15, h: 14 },
  { id: "setor4", label: "Setor 4", emoji: "🎫", kind: "zona",
    desc: "Arquibancada — Setor 4.", x: 66, y: 60, w: 15, h: 14 },
  { id: "entrada-alunos", label: "Entrada dos Alunos / Concentração", emoji: "🚪", kind: "ponto",
    desc: "Entrada dos alunos e ponto de concentração.", x: 4, y: 74, w: 21, h: 9 },
  { id: "entrada-familia", label: "Entrada Família", emoji: "🚪", kind: "ponto",
    desc: "Entrada destinada às famílias.", x: 75, y: 74, w: 21, h: 9 },
  { id: "nav-mapa", label: "Mapa Principal", kind: "nav", goto: "mapa",
    x: 9, y: 89, w: 24, h: 6 },
  { id: "nav-prog2", label: "Programação", kind: "nav", goto: "programacao",
    x: 65, y: 89, w: 26, h: 6 },
];

// ───────────────────────── Programação (Apresentações) ─────────────────────────
export const programacao: Slot[] = [
  { hora: "9h", grupo: "2º Ano", periodo: "Matutino", turmas: ["2º A", "2º B", "2º C", "2º D", "2º E"] },
  { hora: "9h30", grupo: "1º Ano", periodo: "Matutino", turmas: ["1º A", "1º B", "1º C", "1º D"] },
  { hora: "10h", grupo: "Infantil 1", periodo: "Matutino e Vespertino", turmas: ["INF 1 A", "INF 1 B"] },
  { hora: "10h30", grupo: "Infantil 4", periodo: "Matutino e Vespertino", turmas: ["INF 4 A", "INF 4 B", "INF 4 C", "INF 4 D", "INF 4 E", "INF 4 F"] },
  { hora: "11h", grupo: "Infantil 2", periodo: "Matutino e Vespertino", turmas: ["INF 2 A", "INF 2 B", "INF 2 C", "INF 2 D", "INF 2 E"] },
  { hora: "11h30", grupo: "1º Ano", periodo: "Vespertino", turmas: ["1º E", "1º F", "1º G", "1º H"] },
  { hora: "12h", grupo: "4º Ano", periodo: "Matutino", turmas: ["4º A", "4º B", "4º C", "4º D", "4º E"] },
  { hora: "13h", grupo: "Infantil 5", periodo: "Matutino e Vespertino", turmas: ["INF 5 A", "INF 5 B", "INF 5 C", "INF 5 D", "INF 5 E", "INF 5 F"] },
  { hora: "13h30", grupo: "2º Ano", periodo: "Vespertino", turmas: ["2º F", "2º G", "2º H", "2º I"] },
  { hora: "14h", grupo: "3º Ano", periodo: "Vespertino", turmas: ["3º E", "3º F", "3º G"] },
  { hora: "14h30", grupo: "5º Ano", periodo: "Matutino", turmas: ["5º A", "5º B", "5º C"] },
  { hora: "15h", grupo: "Infantil 3", periodo: "Matutino e Vespertino", turmas: ["INF 3 A", "INF 3 B", "INF 3 C", "INF 3 D", "INF 3 E", "INF 3 F"] },
  { hora: "15h30", grupo: "5º Ano", periodo: "Matutino", turmas: ["5º D", "5º E", "5º F"] },
  { hora: "16h", grupo: "5º Ano", periodo: "Vespertino", turmas: ["5º G", "5º H"] },
  { hora: "16h30", grupo: "4º Ano", periodo: "Vespertino", turmas: ["4º F", "4º G", "4º H"] },
  { hora: "17h", grupo: "3º Ano", periodo: "Matutino", turmas: ["3º A", "3º B", "3º C", "3º D"] },
  { hora: "17h30", grupo: "9º Ano — Grupo 1", turmas: ["9º A", "9º B", "9º C", "9º D"] },
  { hora: "18h", grupo: "9º Ano — Grupo 2", turmas: ["9º E", "9º F", "9º G", "9º H"] },
  { hora: "18h30", grupo: "3ª Série EM", turmas: ["Todas as turmas"] },
];

// ───────────────────────── Cardápio e Brincadeiras ─────────────────────────
export const cardapio: Barraca[] = [
  { id: "bebidas", nome: "Bebidas", emoji: "🥤", tipo: "comida", itens: [
    { nome: "Água sem gás", preco: 6 }, { nome: "Água com gás", preco: 7 },
    { nome: "Suco", preco: 9 }, { nome: "Refrigerante", preco: 8 } ] },
  { id: "churrasquinho", nome: "Churrasquinho", emoji: "🍢", tipo: "comida", itens: [
    { nome: "Espetinho de carne", preco: 17 }, { nome: "Espetinho de frango", preco: 17 },
    { nome: "Esp. de frango com bacon", preco: 17 }, { nome: "Espetinho de salsichão", preco: 17 } ] },
  { id: "milho", nome: "Delícias do Milho e Caldo", emoji: "🌽", tipo: "comida", itens: [
    { nome: "Milho cozido", preco: 10 }, { nome: "Pamonha", preco: 16 }, { nome: "Curau", preco: 15 },
    { nome: "Caldo", preco: 15 }, { nome: "Arroz doce", preco: 13 } ] },
  { id: "doces", nome: "Doces e Maçã do Amor", emoji: "🍎", tipo: "comida", itens: [
    { nome: "Maçã do amor", preco: 15 }, { nome: "Maçã com chocolate", preco: 12 },
    { nome: "Uva com chocolate", preco: 17 }, { nome: "Uva do amor", preco: 17 },
    { nome: "Morango com chocolate", preco: 20 }, { nome: "Marshmallow c/ chocolate", preco: 15 },
    { nome: "Fondue chocolate 300ml", preco: 30 }, { nome: "Coxinha de morango", preco: 15 } ] },
  { id: "pipoca", nome: "Pipoca e Algodão Doce", emoji: "🍿", tipo: "comida", itens: [
    { nome: "Algodão doce", preco: 7 }, { nome: "Pipoca gourmet", preco: 15 },
    { nome: "Pipoca salgada média", preco: 10 }, { nome: "Mini donut's", preco: 15 } ] },
  { id: "crepe", nome: "Crepe", emoji: "🥞", tipo: "comida", itens: [
    { nome: "Frango catupiry", preco: 27 }, { nome: "Calabresa especial", preco: 27 },
    { nome: "Napolitano", preco: 27 }, { nome: "Vegetariano", preco: 27 },
    { nome: "Banana com canela", preco: 27 }, { nome: "Morango com brigadeiro", preco: 27 } ] },
  { id: "batata-pastel", nome: "Batata Frita e Pastel", emoji: "🍟", tipo: "comida", itens: [
    { nome: "Batata frita", preco: 15 }, { nome: "Pastel", preco: 15 } ] },
  { id: "costela", nome: "Costela", emoji: "🍖", tipo: "comida", itens: [
    { nome: "Arroz com costela", preco: 35 }, { nome: "Baguete com costela", preco: 30 } ] },
  { id: "churros", nome: "Churros", emoji: "🍩", tipo: "comida", itens: [
    { nome: "Churros tradicional", preco: 15 } ] },
  { id: "paleta", nome: "Paleta Mexicana", emoji: "🍦", tipo: "comida", itens: [
    { nome: "Paleta mexicana", preco: 20 }, { nome: "Bombom de sorvete", preco: 25 } ] },
  { id: "batata-recheada", nome: "Batata Recheada", emoji: "🥔", tipo: "comida", itens: [
    { nome: "Batata recheada", preco: 22 } ] },
  { id: "baianas", nome: "Comidas Baianas", emoji: "🦐", tipo: "comida", itens: [
    { nome: "Acarajé tradicional", preco: 30 }, { nome: "Acarajé vegano", preco: 30 },
    { nome: "Cocada", preco: 13 }, { nome: "Cuscuz de tapioca", preco: 17 },
    { nome: "Camarão empanado", preco: 18 } ] },
  { id: "tipicas", nome: "Comidas Típicas", emoji: "🍛", tipo: "comida", itens: [
    { nome: "Galinhada", preco: 30 }, { nome: "Arroz carreteiro", preco: 30 },
    { nome: "Porção carne sol com mandioca", preco: 40 } ] },
  { id: "cachorro-acai", nome: "Cachorro-Quente e Açaí", emoji: "🌭", tipo: "comida", itens: [
    { nome: "Cachorro-quente", preco: 12 }, { nome: "Açaí 200ml", preco: 12 }, { nome: "Açaí 300ml", preco: 15 } ] },
  { id: "brincadeiras", nome: "Brincadeiras", emoji: "🎯", tipo: "diversao", itens: [
    { nome: "Pescaria", preco: 10 }, { nome: "Boca do palhaço", preco: 10 },
    { nome: "Garra", preco: 20 }, { nome: "Estalinho", preco: 5 } ] },
  { id: "inflaveis", nome: "Circuito dos Brinquedos Infláveis", emoji: "🎪", tipo: "diversao", itens: [
    { nome: "Passaporte — 30 minutos", preco: 40 }, { nome: "Passaporte livre", preco: 70 } ] },
  { id: "quitanda", nome: "Quitanda", emoji: "🧁", tipo: "comida", itens: [
    { nome: "Bolo no pote", preco: 15 }, { nome: "Bolo (fatia)", preco: 10 }, { nome: "Cocada assada", preco: 15 },
    { nome: "Bala baiana", preco: 5 }, { nome: "Pé de moça", preco: 5 }, { nome: "Café", preco: 5 },
    { nome: "Torta salgada", preco: 12 }, { nome: "Tortinha de limão", preco: 15 }, { nome: "Mousse", preco: 12 },
    { nome: "Banoffe", preco: 12 }, { nome: "Combo brigadeiro", preco: 15 }, { nome: "Mini pudim", preco: 15 },
    { nome: "Chocolate quente", preco: 12 } ] },
  { id: "sorvetes", nome: "Algodão Doce e Sorvetes", emoji: "🍧", tipo: "comida", itens: [
    { nome: "Algodão doce tradicional", preco: 10 }, { nome: "Algodão doce par perfeito", preco: 15 },
    { nome: "Algodão doce colorido", preco: 20 }, { nome: "Algodão doce artístico", preco: 30 },
    { nome: "Casquinha", preco: 10 }, { nome: "Shake junior", preco: 20 }, { nome: "Shake especiais", preco: 25 },
    { nome: "Sorvete junior", preco: 18 }, { nome: "Sorvete grande", preco: 25 } ] },
  { id: "canjica", nome: "Canjica", emoji: "🍚", tipo: "comida", itens: [
    { nome: "Canjica", preco: 15 } ] },
];

// Converte "9h30" / "18h" em minutos desde a meia-noite.
export function horaParaMinutos(h: string): number {
  const m = h.match(/(\d{1,2})h(\d{2})?/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}
