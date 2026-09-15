// The IPC contract: every shape that crosses the preload bridge, and the
// ElectronAPI interface the bridge is checked against. It lives in shared/ so
// src/preload can import it without the bridge depending on the display layer.
// src/renderer/lib/types.ts re-exports all of it, so renderer imports are
// unchanged.

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

// One row per player, straight from match_participants — the scoreboard no
// longer reconstructs these from a raw match payload.
export interface MatchParticipantRecord {
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
  topChampions: ChampionStats[];
  multikills: {
    doubles: number;
    triples: number;
    quadras: number;
    pentas: number;
  };
  topAugments: AugmentStats[];
}

export interface ChampionData {
  [id: number]: {
    name: string;
    key: string;
    class?: string;
  };
}

export interface AugmentData {
  [id: number]: {
    name: string;
    desc: string;
    iconPath: string;
    rarity: string;
    // CommunityDragon branch this entry came from. iconPath is only valid
    // against that branch, since paths move between patches.
    branch: string;
  };
}

export interface ItemData {
  [id: number]: {
    name: string;
    // Riot tooltip markup (<mainText>, <passive>, <magicDamage>…), already
    // resolved — render it with RiotText, never as HTML.
    description: string;
    iconPath: string;
    branch: string;
  };
}

export interface SummonerSpellData {
  [id: number]: {
    name: string;
    iconPath: string;
  };
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

export interface GlobalStats {
  champions: { champion_id: number; games: number; wins: number }[];
  augments: { augment_id: number; picks: number; wins: number }[];
  items: { item_id: number; picks: number; wins: number }[];
  totalParticipantSlots: number;
}

// One champion across every stored game, counting all ten players per game.
export interface GlobalChampionDetail {
  champion_id: number;
  games: number;
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
  items: ItemStats[];
  augments: AugmentStats[];
}

export interface ParsedParticipant {
  participantId: number;
  championId: number;
  teamId: number;
  puuid: string | null;
  summonerName: string;
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
  win: boolean;
  isSelf: boolean;
}

export type LcuStatus = "disconnected" | "connecting" | "connected" | "ingame";

export interface BackfillProgress {
  current: number;
  total: number;
  added: number;
}

// Riot's match history service holds only this many matches per account, and
// reports the end of that window as an empty page — exactly what a genuine end
// of history looks like. Anything older is unreachable, by any route.
export const SGP_HISTORY_CAP = 1000;

// What stopped a backfill short of an account's full history, if anything.
// The two are not the same kind of problem: "service" is Riot's window and is
// permanent, so there is nothing to retry; "paging" is our own safety bound,
// which means the run gave up early and should simply be repeated.
export type BackfillLimit = "service" | "paging" | null;

export interface BackfillResult {
  added: number;
  scanned: number;
  checked: number;
  totalGames: number;
  limit: BackfillLimit;
  cancelled: boolean;
}

export interface ReleaseNote {
  version: string;
  publishedAt: string;
  body: string;
  url: string;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  latest?: string;
  current?: string;
  url?: string;
  assetUrl?: string;
  assetSize?: number;
  // Every release newer than the installed version, newest first
  releases?: ReleaseNote[];
  // True when there are skipped releases beyond the page the check fetched
  moreVersions?: boolean;
  error?: string;
}

export interface BackupInfo {
  file: string;
  created: number;
  size: number;
  // null when the snapshot exists but couldn't be read
  games: number | null;
  reason: string;
}

export interface RecoveryReport {
  problem: "missing" | "corrupt";
  restoredFrom: string | null;
  quarantined: string | null;
  detail?: string;
}

// ---- Live game ----

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

export interface LivePlayer {
  // Stable across polls, so React keys and the record cache both hold: the
  // puuid when the client gives us one, otherwise the riot id.
  key: string;
  name: string;
  tagLine: string | null;
  puuid: string | null;
  // 0 when the champion could not be resolved to an id, which only leaves the
  // name to go on
  championId: number;
  championName: string;
  teamId: number;
  isSelf: boolean;
  isBot: boolean;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  creepScore: number;
  // Seven slots, trinket last; 0 for an empty one
  items: number[];
  isDead: boolean;
  respawnTimer: number;
  spell1Id: number | null;
  spell2Id: number | null;
  // Their history on the champion they're playing, and across every champion
  championRecord: PlayerRecord | null;
  overallRecord: PlayerRecord | null;
  // Games played on our own team, and the Friends route key for them once
  // there are enough of those to have earned a profile
  gamesWithUs: number;
  friendKey: string | null;
}

export type LiveEventTone = "kill" | "objective" | "special";

export interface LiveEvent {
  id: number;
  // Seconds into the game
  time: number;
  text: string;
  tone: LiveEventTone;
}

export interface LiveGameSnapshot {
  // A match is running and its own API is serving stats
  inGame: boolean;
  // A match exists but isn't serving stats yet: champion select is over and
  // the loading screen is up, so the roster is known and nothing else is
  starting: boolean;
  gameId: number | null;
  queueId: number | null;
  mapId: number | null;
  // "Howling Abyss", "Butcher's Bridge" or "Koeshin's Crossing"
  mapName: string | null;
  // The map skin the game reported, which is what mapName is derived from
  mapSkin: string | null;
  gameTime: number;
  players: LivePlayer[];
  // Newest last, trimmed to the recent past
  events: LiveEvent[];
}

// ---- Post-game recap ----

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
  // Best score on this champion before this game, so a new one reads as news
  previousBest: number | null;
  firstTime: boolean;
}

export interface RecapCareer {
  games: number;
  wins: number;
  avgScore: number | null;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgDamage: number;
  avgTaken: number;
  avgHeal: number;
  avgGold: number;
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
}

export interface ElectronAPI {
  getMatchHistory: (
    limit: number,
    offset: number,
    filters?: MatchFilters,
  ) => Promise<{ matches: MatchListItem[]; total: number }>;
  getMatchSessions: (filters?: MatchFilters) => Promise<MatchSession[]>;
  getMatchFilterOptions: (
    filters?: Pick<MatchFilters, "championId" | "patch" | "queue" | "account">,
  ) => Promise<MatchFilterOptions>;
  getStoredQueues: () => Promise<number[]>;
  getMatchDetail: (gameId: number) => Promise<MatchDetail>;
  toggleFavorite: (gameId: number) => Promise<boolean>;
  getChampionStats: (patch?: string, queue?: number) => Promise<ChampionStats[]>;
  getAugmentStats: (championId?: number, patch?: string, queue?: number) => Promise<AugmentStats[]>;
  getAugmentStatsDetailed: (patch?: string, queue?: number) => Promise<AugmentStatsDetailedResult>;
  getDashboard: (
    filters?: Pick<MatchFilters, "championId" | "patch" | "queue" | "account">,
  ) => Promise<DashboardData>;
  getChampionMatchHistory: (
    championId: number,
    limit: number,
    offset: number,
    patch?: string,
    queue?: number,
  ) => Promise<{ matches: MatchListItem[]; total: number }>;
  getChampionItemStats: (
    championId: number,
    patch?: string,
    queue?: number,
  ) => Promise<ItemStats[]>;
  getTeammateStats: () => Promise<TeammateStats[]>;
  getTeammateDetail: (key: string) => Promise<TeammateDetail | null>;
  getGlobalStats: (patch?: string, queue?: number) => Promise<GlobalStats>;
  getTrends: (queue?: number) => Promise<TrendsData>;
  getRecords: (queue?: number, account?: string) => Promise<RecordsData>;
  getLiveGame: () => Promise<LiveGameSnapshot>;
  onLiveGame: (callback: (snapshot: LiveGameSnapshot) => void) => () => void;
  getGameRecap: (gameId?: number) => Promise<GameRecap | null>;
  getGlobalChampionDetail: (
    championId: number,
    patch?: string,
    queue?: number,
  ) => Promise<GlobalChampionDetail>;
  getSummonerPuuid: () => Promise<string | null>;
  getAllSummonerPuuids: () => Promise<string[]>;
  getProfile: () => Promise<{ name: string | null; profileIcon: number | null }>;
  refreshGames: () => Promise<{ newGames: number; totalGames: number } | { error: string }>;
  backfillHistory: () => Promise<BackfillResult | { error: string }>;
  cancelBackfill: () => Promise<void>;
  isBackfillRunning: () => Promise<boolean>;
  onBackfillProgress: (callback: (progress: BackfillProgress) => void) => () => void;
  onBackfillDone: (result: (result: BackfillResult | { error: string }) => void) => () => void;
  getLcuStatus: () => Promise<LcuStatus>;
  getChampionData: () => Promise<ChampionData>;
  getAugmentData: (patch?: string) => Promise<AugmentData>;
  resolveAugmentIcon: (id: number, patch?: string) => Promise<string | null>;
  getItemData: (patch?: string) => Promise<ItemData>;
  getSummonerSpellData: () => Promise<SummonerSpellData>;
  onStatusChanged: (callback: (status: LcuStatus) => void) => () => void;
  onGamesUpdated: (callback: () => void) => () => void;
  getSetting: (key: string) => Promise<string | null>;
  isAutoStartSupported: () => Promise<boolean>;
  setSetting: (key: string, value: string) => Promise<void>;
  exportData: () => Promise<{
    success: boolean;
    path?: string;
    games?: number;
    error?: string;
  }>;
  importData: () => Promise<{ success: boolean; imported?: number; error?: string }>;
  repairPuuids: () => Promise<{
    repairedGames: number;
    discoveredAccounts: number;
    rebuiltGames: number;
  }>;
  listBackups: () => Promise<BackupInfo[]>;
  createBackup: () => Promise<{ success: boolean; backup?: BackupInfo; error?: string }>;
  restoreBackup: (file: string) => Promise<{ success: boolean; games?: number; error?: string }>;
  getRecoveryReport: () => Promise<RecoveryReport | null>;
  openBackupFolder: () => Promise<void>;
  getVersion: () => Promise<string>;
  checkForUpdate: () => Promise<UpdateInfo>;
  downloadUpdate: (assetUrl: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateProgress: (callback: (percent: number) => void) => () => void;
  openUrl: (url: string) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  onMaximizedChanged: (callback: (maximized: boolean) => void) => () => void;
}
