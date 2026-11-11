export type RoomPhase = 'lobby' | 'cards' | 'discussion' | 'result';

export type OnlinePlayer = {
  id: string;
  token: string;
  name: string;
  color: number;
  ready: boolean;
  viewed: boolean;
  joinedAt: number;
};

export type OnlineRoom = {
  code: string;
  hostId: string;
  phase: RoomPhase;
  themeId: string | null;
  roundNumber: number;
  players: OnlinePlayer[];
  word: string | null;
  hint: string | null;
  impostorId: string | null;
  starterId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type PlayerCredentials = {
  code: string;
  playerId: string;
  playerToken: string;
};
