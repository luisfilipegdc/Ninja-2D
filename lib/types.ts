export type CardKind = "senha" | "curiosidade";
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
  body: string | null;
  location: string | null;   // localização física da tag (admin)
}

export interface ScoreRow {
  id: string;
  name: string;
  ms: number;
}

// Estado de jogo persistido no localStorage
export interface GameState {
  name: string;
  startedAt: number;
  gameId: string;
  locks: { [lock: number]: { [pos: number]: number } };
  seen: string[];
  doneLocks: number[];
  active?: boolean;
}
