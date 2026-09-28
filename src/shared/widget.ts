import type { GameNotice } from "./notice";

export interface WidgetMatch {
  matchId: string;
  gameCreation: number;
  queueId: number;
  win: boolean;
  placement?: number | null;
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
  // A game that has just been captured, for the widget to announce over its
  // header. Null unless one is waiting and this surface is allowed to draw it:
  // the OBS page only gets one when that has been turned on.
  notice: GameNotice | null;
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
  // Brings the app forward on the recap of the game a notice is about
  openRecap(): void;
  minimize(): void;
  close(): void;
}
