// El resumen de una partida recién terminada, y la tarjeta que se exporta.
//
// Parte del contrato IPC: todo lo de aquí cruza el puente.

import type { ChallengeLevel } from "../challenges";
import type { MatchDetail } from "./matches";

export type RecapFormat = "int" | "score" | "compact" | "duration" | "kda";

// Where one of the game's stats lands among every game we've stored.
export interface RecapPlacement {
  key: string;
  label: string;
  value: number;
  // 1 is the best there has ever been
  rank: number;
  total: number;
  // False for the placements nobody brags about, so the UI can stop short of
  // congratulating someone on dying more than ever before
  good: boolean;
  format: RecapFormat;
}

export interface RecapMilestone {
  key: string;
  label: string;
  detail: string;
}

export interface RecapSessionGame {
  game_id: number;
  game_creation: number;
  game_duration: number;
  champion_id: number;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number | null;
}

// The day's play around this game, under the same "day starts at 5am" rule the
// match list uses for a day. Always a day, however the match list is grouped:
// what a game sat among is a question about that night's play.
export interface RecapSession {
  day: number;
  // Where this game sits in games, 0-based
  index: number;
  games: RecapSessionGame[];
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  avgScore: number | null;
  // Seconds of game time
  duration: number;
}

export interface RecapStreak {
  kind: "win" | "loss";
  length: number;
  // Longest streak of the same kind on record
  best: number;
  isRecord: boolean;
}

export interface RecapChampion {
  championId: number;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  avgScore: number | null;
  // The same averages the career block carries, over this champion alone.
  // Seconds for the duration, per-game totals for the rest.
  avgDuration: number;
  avgDeaths: number;
  avgDamage: number;
  avgTaken: number;
  avgHeal: number;
  avgGold: number;
  // Best score on this champion before this game, so a new one reads as news
  previousBest: number | null;
  firstTime: boolean;
}

export interface RecapCareer {
  games: number;
  wins: number;
  avgScore: number | null;
  // Seconds. Every other average here is a per-game total, and a total says
  // as much about how long the game ran as about how it was played, so
  // anything comparing them needs this to turn them into rates.
  avgDuration: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgDamage: number;
  avgTaken: number;
  avgHeal: number;
  avgGold: number;
}

// One challenge a game moved, as the client reported it at the final screen.
// The label travels with the row: the client is the only place challenge names
// live, and a recap has to render months later with it closed.
export interface RecapChallenge {
  id: number;
  name: string;
  description: string;
  previousValue: number;
  currentValue: number;
  previousLevel: ChallengeLevel;
  currentLevel: ChallengeLevel;
  // Both null once the top tier is reached
  nextLevel: ChallengeLevel | null;
  nextThreshold: number | null;
  iconPath: string;
}

export interface GameRecap {
  detail: MatchDetail;
  // Only known for games the app watched live, since nothing in the stored
  // match says which of the three ARAM maps it was played on
  mapName: string | null;
  score: number | null;
  scoreBadge: "MVP" | "ACE" | null;
  // Empty for a remake, which sets no records and crosses no milestones
  placements: RecapPlacement[];
  milestones: RecapMilestone[];
  session: RecapSession;
  streak: RecapStreak | null;
  champion: RecapChampion;
  career: RecapCareer;
  // Only known for games the app was running for: the client answers for the
  // most recent game alone, so a game it wasn't there to ask about has none
  challenges: RecapChallenge[];
}

// What the exported image is drawn from: the scoreboard and the line above it.
// Deliberately not the recap — a card is about the game, not about where it
// lands in a career.
export interface GameCardData {
  detail: MatchDetail;
  // Only known for games the app watched live, since nothing in the stored
  // match says which of the three ARAM maps it was played on
  mapName: string | null;
  // The icon of the account that played it, as it was at the time
  profileIcon: number | null;
}

// ---- Challenges ----
