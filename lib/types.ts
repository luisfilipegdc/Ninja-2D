export type CardKind = "senha" | "curiosidade" | "coringa";
export type Media = "texto" | "imagem" | "youtube" | "spotify" | "audio";

export interface Card {
  code: string;
  game_id: string;
  kind: CardKind;
  lock: number | null;       // sempre 1 (cadeado único)
  position: number | null;   // 1..3 (senha)
  digit: number | null;      // 0..9 (senha)
  hint: string | null;
  media: Media | null;       // curiosidade
  title: string | null;
  subtitle: string | null;   // subtítulo da curiosidade (página rica)
  body: string | null;       // texto/descrição OU link (youtube/spotify) OU url do arquivo
  image_url: string | null;  // imagem da curiosidade (página rica/imagem)
  location: string | null;   // localização física da tag (admin)
}

export interface ScoreRow {
  id: string;
  name: string;
  ms: number;
}

export type EventKind = "scan" | "complete" | "admin";

export interface EventRow {
  id: number;
  game_id: string;
  at: string;            // ISO timestamp
  kind: EventKind;
  actor: string | null;  // nome do jogador OU e-mail do admin
  code: string | null;   // tag envolvida
  detail: string | null; // descrição
}

export type Level = "facil" | "medio" | "dificil" | "impossivel";

// Estado de jogo persistido no localStorage
export interface GameState {
  name: string;
  startedAt: number;
  gameId: string;
  locks: { [lock: number]: { [pos: number]: number } };
  seen: string[];
  doneLocks: number[];
  active?: boolean;
  level?: Level;          // dificuldade escolhida na splash
  coringa?: string | null; // efeito do coringa em vigor (aplicado no "Monte o código")
  coringasUsed?: string[]; // códigos de coringa já usados (cada tag conta 1x)
}
