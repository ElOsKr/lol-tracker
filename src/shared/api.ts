// The IPC contract: the bridge the preload is checked against, and the
// channel each request travels on. It lives in shared/ so src/preload can
// import it without the bridge depending on the display layer.
//
// The shapes that travel over it used to live here too, which is how this
// file reached 1,343 lines. They now sit by area under ./api/ and are
// re-exported below, so nothing that imports from "shared/api" had to
// change. One shape left for good: ParsedParticipant never crossed the
// bridge — nothing in the main process produces one — and now lives beside
// the renderer function that builds it.
import type { ChallengeLevel } from "./challenges";
import type { MatchExtras } from "./match-detail";
import type { MatchTimeline } from "./match-timeline";
import type { SkillAxes } from "./skill-axes";
import type { GameNotice } from "./notice";
import type { WidgetPreferences, WidgetState } from "./widget";

import type {
  BackfillProgress,
  BackfillResult,
  BackupInfo,
  ImportProgress,
  RecoveryReport,
  UpdateInfo,
} from "./api/app";
import type {
  AugmentData,
  ChampionData,
  ChampionDetail,
  ItemData,
  PerkData,
  SummonerSpellData,
} from "./api/assets";
import type { ChallengesResult } from "./api/challenges";
import type { HomeSummary } from "./api/home";
import type { LcuStatus, LiveGameSnapshot } from "./api/live";
import type {
  MatchDetail,
  MatchFilterOptions,
  MatchFilters,
  MatchListItem,
  MatchSession,
  QueueLifetimeTotal,
} from "./api/matches";
import type { GameCardData, GameRecap } from "./api/recap";
import type {
  AugmentStats,
  AugmentStatsDetailedResult,
  ChampionStats,
  DashboardData,
  GlobalChampionDetail,
  GlobalStats,
  ItemStats,
  ItemUsage,
  RecordsData,
  TeammateDetail,
  TeammateStats,
  TrendsData,
} from "./api/stats";

// Reexportados desde donde viven, para que importar de "shared/api" siga
// bastando como siempre.
export type { ChallengeLevel, GameNotice, MatchExtras, MatchTimeline, SkillAxes };

export * from "./api/app";
export * from "./api/assets";
export * from "./api/challenges";
export * from "./api/home";
export * from "./api/live";
export * from "./api/matches";
export * from "./api/recap";
export * from "./api/stats";

export interface ElectronAPI {
  getWidgetState(): Promise<WidgetState>;
  openWidget(): Promise<WidgetState>;
  setWidgetPreferences(value: WidgetPreferences): Promise<WidgetState>;
  setObsEnabled(enabled: boolean): Promise<WidgetState>;
  // Windows' regional format, for every date and number the page prints.
  // Undefined when Windows reports something that isn't a locale tag, which
  // leaves formatting to the page's own default.
  locale: string | undefined;
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
  getQueueLifetimeTotals: () => Promise<QueueLifetimeTotal[]>;
  getMatchDetail: (gameId: number) => Promise<MatchDetail | null>;
  // The detail page only. Read out of the stored payload, so it is a parse per
  // call rather than a query — see src/main/db/match-extras.ts.
  getMatchExtras: (gameId: number) => Promise<MatchExtras | null>;
  // The chart and the kill map, from the timeline captured in v0.7.9.
  getMatchTimeline: (gameId: number) => Promise<MatchTimeline | null>;
  // Reads every stored payload of the queue, so it is a page that opens
  // rather than a number a list asks for — see src/main/db/skill-axes.ts.
  getSkillAxes: (queue?: number) => Promise<SkillAxes>;
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
  // The end-of-game card's own data, for the window that draws it
  getGameNotice: (gameId: number) => Promise<GameNotice | null>;
  dismissNotice: () => Promise<void>;
  // Brings the app forward on the recap of the game the notice is about
  openNoticeRecap: () => Promise<void>;
  getHomeSummary: (queue?: number) => Promise<HomeSummary>;
  getLiveGame: () => Promise<LiveGameSnapshot>;
  onLiveGame: (callback: (snapshot: LiveGameSnapshot) => void) => () => void;
  getGameRecap: (gameId?: number) => Promise<GameRecap | null>;
  getGameCard: (gameId: number) => Promise<GameCardData | null>;
  getGlobalChampionDetail: (
    championId: number,
    patch?: string,
    queue?: number,
  ) => Promise<GlobalChampionDetail>;
  getChallenges: () => Promise<ChallengesResult>;
  onChallengesChanged: (callback: (result: ChallengesResult) => void) => () => void;
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
  getChampionDetail: (championId: number) => Promise<ChampionDetail | null>;
  getAugmentData: (patch?: string) => Promise<AugmentData>;
  resolveAugmentIcon: (id: number, patch?: string) => Promise<string | null>;
  getItemData: (patch?: string) => Promise<ItemData>;
  getPerkData: (patch?: string) => Promise<PerkData>;
  getItemUsage: (queue?: number) => Promise<ItemUsage[]>;
  getSummonerSpellData: () => Promise<SummonerSpellData>;
  onStatusChanged: (callback: (status: LcuStatus) => void) => () => void;
  onGamesUpdated: (callback: () => void) => () => void;
  getSetting: (key: string) => Promise<string | null>;
  isAutoStartSupported: () => Promise<boolean>;
  // Whether a combined League shortcut can be written on this machine
  isLeagueShortcutSupported: () => Promise<boolean>;
  createLeagueShortcut: () => Promise<{ success: boolean; path?: string; error?: string }>;
  setSetting: (key: string, value: string) => Promise<void>;
  // No error alongside success: false means the save dialog was dismissed
  exportGameImage: (gameId: number) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
  // Nothing to report on success beyond that it worked: the image is on the
  // clipboard, not anywhere on disk
  copyGameImage: (gameId: number) => Promise<{ success: boolean; error?: string }>;
  exportData: () => Promise<{
    success: boolean;
    path?: string;
    games?: number;
    error?: string;
  }>;
  importData: () => Promise<{ success: boolean; imported?: number; error?: string }>;
  onImportProgress: (callback: (progress: ImportProgress) => void) => () => void;
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
  openLogsFolder: () => Promise<void>;
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
  // The main process asking the app to show a page, from the tray or a notice
  onNavigate: (callback: (path: string) => void) => () => void;
}

// ---- Channels ----

// The ElectronAPI methods that ask the main process for something, as opposed
// to the on* ones that subscribe to what it pushes and the values the preload
// hands over as they are.
export type InvokeMethod = {
  [K in keyof ElectronAPI]: ElectronAPI[K] extends (...args: never[]) => Promise<unknown>
    ? K
    : never;
}[keyof ElectronAPI];

// The channel each request travels on. The preload builds its methods from this
// and ipc-handlers registers each handler by method name, so the two sides can't
// pair a method with different channels, and each handler's arguments and
// result are checked against the signature of the method it answers.
export const INVOKE_CHANNELS = {
  getMatchHistory: "db:match-history",
  getMatchSessions: "db:match-sessions",
  getMatchFilterOptions: "db:match-filters",
  getStoredQueues: "db:stored-queues",
  getMatchDetail: "db:match-detail",
  getMatchExtras: "db:match-extras",
  getMatchTimeline: "db:match-timeline",
  getSkillAxes: "db:skill-axes",
  toggleFavorite: "db:toggle-favorite",
  getChampionStats: "db:champion-stats",
  getAugmentStats: "db:augment-stats",
  getAugmentStatsDetailed: "db:augment-stats-detailed",
  getDashboard: "db:dashboard",
  getChampionMatchHistory: "db:champion-match-history",
  getChampionItemStats: "db:champion-item-stats",
  getTeammateStats: "db:teammate-stats",
  getTeammateDetail: "db:teammate-detail",
  getGlobalStats: "db:global-stats",
  getTrends: "db:trends",
  getRecords: "db:records",
  getGameNotice: "notice:get",
  dismissNotice: "notice:dismiss",
  openNoticeRecap: "notice:open-recap",
  getHomeSummary: "db:home-summary",
  getLiveGame: "live:snapshot",
  getGameRecap: "db:game-recap",
  getGameCard: "db:game-card",
  getGlobalChampionDetail: "db:global-champion-detail",
  getChallenges: "challenges:get",
  getAllSummonerPuuids: "db:all-summoner-puuids",
  getProfile: "db:profile",
  refreshGames: "lcu:refresh",
  backfillHistory: "lcu:backfill",
  cancelBackfill: "lcu:cancel-backfill",
  isBackfillRunning: "lcu:backfill-running",
  getLcuStatus: "lcu:status",
  getChampionData: "dragon:champions",
  getChampionDetail: "dragon:champion-detail",
  getAugmentData: "dragon:augments",
  resolveAugmentIcon: "dragon:augment-icon",
  getItemData: "dragon:items",
  getPerkData: "dragon:perks",
  getItemUsage: "db:item-usage",
  getSummonerSpellData: "dragon:summoner-spells",
  getSetting: "settings:get",
  isAutoStartSupported: "autostart:supported",
  isLeagueShortcutSupported: "autostart:league-shortcut-supported",
  createLeagueShortcut: "autostart:create-league-shortcut",
  setSetting: "settings:set",
  exportGameImage: "export:game-image",
  copyGameImage: "export:copy-game-image",
  exportData: "data:export",
  importData: "data:import",
  repairPuuids: "data:repair-puuids",
  listBackups: "backup:list",
  createBackup: "backup:create",
  restoreBackup: "backup:restore",
  getRecoveryReport: "backup:recovery-report",
  openBackupFolder: "backup:open-folder",
  openLogsFolder: "app:open-logs-folder",
  getVersion: "app:version",
  checkForUpdate: "app:check-update",
  downloadUpdate: "app:download-update",
  openUrl: "app:open-url",
  minimizeWindow: "window:minimize",
  toggleMaximizeWindow: "window:toggle-maximize",
  closeWindow: "window:close",
  isWindowMaximized: "window:is-maximized",
  // LoLeanding additions: the per-queue lifetime counters and the desktop/OBS widget
  getQueueLifetimeTotals: "db:queue-lifetime-totals",
  getWidgetState: "widget:state",
  openWidget: "widget:open",
  setWidgetPreferences: "widget:preferences",
  setObsEnabled: "widget:obs",
} as const satisfies Record<InvokeMethod, string>;

// What the main process pushes to the window, and the payload each one carries
export interface RendererEvents {
  "lcu:status-changed": LcuStatus;
  "lcu:games-updated": void;
  "lcu:backfill-progress": BackfillProgress;
  "lcu:backfill-done": BackfillResult | { error: string };
  "live:changed": LiveGameSnapshot;
  "challenges:changed": ChallengesResult;
  "update:progress": number;
  "window:maximized-changed": boolean;
  "data:import-progress": ImportProgress;
  "app:navigate": string;
}

// The command-line switch every window is created with to carry
// ElectronAPI.locale to the preload
export const LOCALE_SWITCH = "--mayhem-locale";
