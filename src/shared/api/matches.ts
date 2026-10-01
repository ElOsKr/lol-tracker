// Una partida tal y como la guarda la base: la fila del historial, sus
// diez jugadores y los filtros con que se busca.
//
// Parte del contrato IPC: todo lo de aquí cruza el puente.

import type { PlayerRank } from "../ranks";

export interface QueueLifetimeTotal {
  puuid: string;
  account: string;
  queueId: number;
  wins: number;
  losses: number;
  capturedAt: number;
}

export interface GameRecord {
  game_id: number;
  queue_id: number;
  game_mode: string;
  game_creation: number;
  game_duration: number;
  puuid?: string;
  game_version?: string | null;
  // Both come back from getMatchDetail; optional because the export format and
  // the older callers here predate them.
  is_remake?: number;
  favorite?: number;
}

export interface PlayerStatsRecord {
  game_id: number;
  champion_id: number;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  double_kills: number;
  triple_kills: number;
  quadra_kills: number;
  penta_kills: number;
  total_damage_dealt: number;
  total_damage_taken: number;
  gold_earned: number;
  total_heal: number;
  largest_killing_spree: number;
  // Null for a remake, and for a game without the other players' stats to
  // grade against
  score: number | null;
  // Unclamped, for ordering only; never shown
  score_raw: number | null;
  score_badge: "MVP" | "ACE" | null;
  // Where this game placed among everyone it scored, and out of how many.
  // Null for a remake and for queues that carry no score.
  score_rank: number | null;
  score_rank_total: number | null;
  spell1: number | null;
  spell2: number | null;
  item0: number | null;
  item1: number | null;
  item2: number | null;
  item3: number | null;
  item4: number | null;
  item5: number | null;
  item6: number | null;
}

export interface GameAugment {
  game_id: number;
  slot: number;
  augment_id: number;
}

export interface MatchListItem {
  placement?: number | null;
  game_id: number;
  queue_id: number;
  game_creation: number;
  game_duration: number;
  is_remake: number;
  favorite: number;
  champion_id: number;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  double_kills: number;
  triple_kills: number;
  quadra_kills: number;
  penta_kills: number;
  total_damage_dealt: number;
  total_damage_taken: number;
  total_heal: number;
  gold_earned: number;
  item0: number | null;
  item1: number | null;
  item2: number | null;
  item3: number | null;
  item4: number | null;
  item5: number | null;
  score: number | null;
  score_badge: "MVP" | "ACE" | null;
  /** Minions plus camps, and the vision score: the two the Rift cares about. */
  cs: number;
  vision: number;
  /** Wards placed plus cleared. What decides whether the two above are shown. */
  wards: number;
  spell1: number | null;
  spell2: number | null;
  augment_ids: string | null;
  game_version: string | null;
  game_max_dmg: number;
  game_max_taken: number;
  game_max_heal: number;
}

export type MatchSort =
  | "date"
  | "kda"
  | "kills"
  | "duration"
  | "score"
  | "damageDealt"
  | "damageTaken"
  | "healing";

export type MatchSortDir = "asc" | "desc";

export type MultikillType = "doubles" | "triples" | "quadras" | "pentas";

export interface MatchFilters {
  championId?: number;
  patch?: string;
  queue?: number;
  account?: string;
  sort?: MatchSort;
  sortDir?: MatchSortDir;
  multikills?: MultikillType[];
  favorites?: boolean;
  // Games we finished holding this item, in any slot including the trinket.
  // What the items page links to, so the count it shows has somewhere to go.
  itemId?: number;
}

// One session of play under the current match-list filters. The list is paged,
// so the rows on screen only ever describe part of a session; these totals
// cover all of it.
export interface MatchSession {
  // What the session is grouped under, as sessionKey spells it: a YYYY-MM-DD
  // date for days and weeks, a patch for patches, empty for games missing one
  key: string;
  // Every game, remakes included
  games: number;
  // Everything below counts only games that are not remakes
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  // Null when no game in the session has a stored score; scored_games is the
  // denominator, so the average stays honest when only some of them do
  score_sum: number | null;
  scored_games: number;
}

export interface TrackedAccount {
  puuid: string;
  name: string | null;
  profileIcon: number | null;
}

export interface MatchFilterOptions {
  patches: string[];
  champions: number[];
  queues: number[];
  accounts: TrackedAccount[];
  hasFavorites: boolean;
}

// One row per player, straight from match_participants.
export interface MatchParticipantRecord {
  // The rank this player held when the app first saw the game, on whichever
  // ladder suits it. Null when they were unranked, and null for every player
  // of a game the app only met after the fact — see src/main/ranks.ts.
  rank?: PlayerRank | null;
  placement?: number | null;
  cs?: number | null;
  vision?: number | null;
  position?: string | null;
  participantId: number;
  puuid: string | null;
  gameName: string | null;
  tagLine: string | null;
  championId: number;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  goldEarned: number;
  totalHeal: number;
  largestKillingSpree: number;
  spell1Id: number | null;
  spell2Id: number | null;
  items: number[];
  augments: number[];
}

export interface MatchDetail {
  game: GameRecord;
  stats: PlayerStatsRecord;
  augments: GameAugment[];
  participants: MatchParticipantRecord[];
}
