export interface WidgetMatch {
  matchId: string;
  gameCreation: number;
  queueId: number;
  win: boolean;
  remake: boolean;
  championId: number;
  kills: number;
  deaths: number;
  assists: number;
  items: number[];
  itemIcons: (string | null)[];
  augments: { url: string | null; nameTRA: string; rarity: string | number }[];
}

export interface WidgetSnapshot {
  matches: WidgetMatch[];
  streak: number;
  streakLimited: boolean;
  totalWinrate: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  summonerName: string;
  connected: boolean;
  error: string | null;
  pollIntervalMs: number;
  assetVersion: string;
}

export interface WidgetPreferences {
  height: number;
  opacity: number;
  account: string;
  queue: number | null;
}
export interface WidgetState {
  preferences: WidgetPreferences;
  obsUrl: string | null;
  desktopOpen: boolean;
}
export interface WidgetControls {
  snapshot(): Promise<WidgetSnapshot>;
  minimize(): void;
  close(): void;
}
