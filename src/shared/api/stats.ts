// Lo agregado: por campeón, por aumento, por objeto, por compañero, por
// día y los récords.
//
// Parte del contrato IPC: todo lo de aquí cruza el puente.

import type { MatchListItem } from "./matches";

export interface ChampionStats {
  champion_id: number;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  avg_damage: number;
  avg_gold: number;
  // Null when none of the champion's games have a stored score
  avg_score: number | null;
  // The running sums behind that average. Carried so the pool judgement can
  // measure how spread out the scores are: an average alone cannot say
  // whether a gap is a finding or a coincidence.
  scored: number;
  score_sum: number;
  score_sum_sq: number;
  mvps: number;
  aces: number;
  double_kills: number;
  triple_kills: number;
  quadra_kills: number;
  penta_kills: number;
}

export interface AugmentStats {
  augment_id: number;
  picks: number;
  wins: number;
}

export interface ItemStats {
  item_id: number;
  picks: number;
  wins: number;
}

export interface AugmentStatsDetailed {
  augment_id: number;
  picks: number;
  wins: number;
  champions: { champion_id: number; picks: number; wins: number }[];
}

export interface AugmentStatsDetailedResult {
  // Games matching the same filters, so pick rate has a real denominator
  totalGames: number;
  augments: AugmentStatsDetailed[];
}

export interface DashboardData {
  totalGames: number;
  // Seconds of game time across every counted game
  totalDuration: number;
  wins: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  avgScore: number | null;
  mvps: number;
  aces: number;
  // MVP is only awarded on a win and ACE only on a loss, so those are the
  // denominators for their rates — and only over games that have a score at all
  scoredWins: number;
  scoredLosses: number;
  // Tracked accounts these totals pool together, under the current filters
  accounts: number;
  // Newest first
  recentForm: { win: number; game_id: number }[];
  multikills: {
    doubles: number;
    triples: number;
    quadras: number;
    pentas: number;
  };
}

// How often the player themselves finished a game holding an item. Remakes are
// out, as everywhere else, and the free Poro-Snax are excluded the same way the
// item tables exclude them.
export interface ItemUsage {
  item_id: number;
  games: number;
  wins: number;
}

export interface TeammateStats {
  // Stable id for routing — the teammate's puuid, or their name when unknown
  key: string;
  name: string;
  puuid: string | null;
  profileIcon: number | null;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  champions: { champion_id: number; games: number }[];
  lastPlayed: number;
  // The first game ever shared, so someone who has just started turning up
  // can be told apart from someone who always has been around.
  firstPlayed: number;
  // The run of identical results the shared games end on, newest first.
  streak: { win: boolean; length: number } | null;
  // Our own record in the games this teammate was NOT in, so the two can be
  // compared. Carried per teammate rather than once, so whatever draws a row
  // has everything it needs in the row.
  withoutGames: number;
  withoutWins: number;
}

// A shared game, seen from both sides: our stats on the row itself, theirs
// under `friend`.
export interface TeammateMatch extends MatchListItem {
  friend: {
    champion_id: number;
    win: number;
    kills: number;
    deaths: number;
    assists: number;
    total_damage_dealt: number;
    total_damage_taken: number;
    total_heal: number;
    score: number | null;
    score_badge: "MVP" | "ACE" | null;
  };
}

export interface TeammateChampionStats {
  champion_id: number;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
}

// The list view only needs a teammate's most-played champions; their profile
// breaks every champion down.
export interface TeammateProfile extends Omit<TeammateStats, "champions"> {
  champions: TeammateChampionStats[];
  // In how many of the shared games their score beat ours, out of the games
  // where both were scored. Only on the profile: working it out means scoring
  // all ten players of every shared game, which is fine for one teammate and
  // far too much for the whole list at once.
  betterScore: { better: number; scored: number } | null;
}

export interface TeammateDetail {
  player: TeammateProfile;
  matches: TeammateMatch[];
}

// One row per calendar day with at least one game, local time. The Trends page
// re-buckets these into weeks/months itself, so this is the only time series
// the main process has to produce.
export interface TrendsDay {
  day: string; // YYYY-MM-DD
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  // Summed over games that have a score; scored_games is that count, so the
  // average stays honest when only some games are scored
  score_sum: number | null;
  scored_games: number;
}

export interface TrendsData {
  daily: TrendsDay[];
  // Chronological by first game played on the patch
  patches: {
    patch: string;
    games: number;
    wins: number;
    avg_score: number | null;
    first_played: number;
  }[];
  hours: { hour: number; games: number; wins: number }[];
  // 0 = Sunday, matching strftime('%w')
  weekdays: { weekday: number; games: number; wins: number }[];
  // Games grouped by how long they ran, in the buckets of DURATION_BUCKETS.
  // `from` is the bucket's lower edge in minutes.
  durations: { from: number; games: number; wins: number; avgScore: number | null }[];
}

// Just enough of a game to draw a record's context line and open its match.
export interface RecordMatchRef {
  game_id: number;
  game_creation: number;
  game_duration: number;
  queue_id: number;
  champion_id: number;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
}

// A single-game best: the mark itself plus the game it was set in.
export interface StatRecord {
  value: number;
  match: RecordMatchRef;
}

export interface StreakRecord {
  length: number;
  start: number;
  end: number;
  // The streak's final game
  match: RecordMatchRef;
}

export interface RecordsData {
  totalGames: number;
  bests: {
    kills: StatRecord | null;
    deaths: StatRecord | null;
    assists: StatRecord | null;
    kda: StatRecord | null;
    score: StatRecord | null;
    killingSpree: StatRecord | null;
    damage: StatRecord | null;
    damageTaken: StatRecord | null;
    healing: StatRecord | null;
    gold: StatRecord | null;
    fastestWin: StatRecord | null;
    longestGame: StatRecord | null;
  };
  winStreak: StreakRecord | null;
  lossStreak: StreakRecord | null;
}

// Counts every player of every stored game, not just us: `games` is how many
// games a champion appeared in, `ownGames` how many of those we played it in.
export interface GlobalStats {
  champions: { champion_id: number; games: number; wins: number; ownGames: number }[];
  // Likewise `picks` is by anyone and `ownPicks` the ones we made
  augments: { augment_id: number; picks: number; wins: number; ownPicks: number }[];
  items: { item_id: number; picks: number; wins: number; ownPicks: number }[];
  totalParticipantSlots: number;
  // Distinct stored games behind those slots, for the page header
  totalGames: number;
}

// One champion across every stored game, counting all ten players per game.
export interface GlobalChampionDetail {
  champion_id: number;
  // Games the champion appeared in, by anyone
  games: number;
  // ...of which we were the one playing it
  ownGames: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  avgDamage: number;
  avgDamageTaken: number;
  avgGold: number;
  avgHeal: number;
  // Averaged per-game ratios, 0-1
  damageShare: number;
  killParticipation: number;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  totalParticipantSlots: number;
  totalGames: number;
  items: ItemStats[];
  augments: AugmentStats[];
}

// How often a player has played one champion, as far as this app has seen.
// Null wherever we have never recorded a game with them, which is every
// stranger in a random lobby.
export interface PlayerRecord {
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  lastPlayed: number;
}
