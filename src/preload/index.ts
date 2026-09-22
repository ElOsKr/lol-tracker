import { contextBridge, ipcRenderer } from "electron";
import type {
  BackfillProgress,
  BackfillResult,
  ChallengesResult,
  ElectronAPI,
  LcuStatus,
  LiveGameSnapshot,
  MatchFilters,
} from "../shared/api";

// Annotated rather than inferred, so the compiler checks this object against
// the contract the renderer calls through. Written freehand the two could
// disagree silently, and the disagreement surfaces as a call failing at
// runtime instead of as a build error.
//
// The annotation is also what gives call sites their return types: every
// method here returns ipcRenderer.invoke(...), which is Promise<any>.
const api: ElectronAPI = {
  getWidgetState: () => ipcRenderer.invoke("widget:state"),
  openWidget: () => ipcRenderer.invoke("widget:open"),
  setWidgetPreferences: (value) => ipcRenderer.invoke("widget:preferences", value),
  setObsEnabled: (enabled) => ipcRenderer.invoke("widget:obs", enabled),
  getMatchHistory: (limit: number, offset: number, filters?: MatchFilters) =>
    ipcRenderer.invoke("db:match-history", limit, offset, filters),

  getMatchSessions: (filters?: MatchFilters) => ipcRenderer.invoke("db:match-sessions", filters),

  getMatchFilterOptions: (
    filters?: Pick<MatchFilters, "championId" | "patch" | "queue" | "account">,
  ) => ipcRenderer.invoke("db:match-filters", filters),

  getQueueLifetimeTotals: () => ipcRenderer.invoke("db:queue-lifetime-totals"),
  getStoredQueues: () => ipcRenderer.invoke("db:stored-queues"),

  getMatchDetail: (gameId: number) => ipcRenderer.invoke("db:match-detail", gameId),

  toggleFavorite: (gameId: number) => ipcRenderer.invoke("db:toggle-favorite", gameId),

  getChampionStats: (patch?: string, queue?: number) =>
    ipcRenderer.invoke("db:champion-stats", patch, queue),

  getAugmentStats: (championId?: number, patch?: string, queue?: number) =>
    ipcRenderer.invoke("db:augment-stats", championId, patch, queue),

  getAugmentStatsDetailed: (patch?: string, queue?: number) =>
    ipcRenderer.invoke("db:augment-stats-detailed", patch, queue),

  getDashboard: (filters?: Pick<MatchFilters, "championId" | "patch" | "queue" | "account">) =>
    ipcRenderer.invoke("db:dashboard", filters),

  getChampionMatchHistory: (
    championId: number,
    limit: number,
    offset: number,
    patch?: string,
    queue?: number,
  ) => ipcRenderer.invoke("db:champion-match-history", championId, limit, offset, patch, queue),

  refreshGames: () => ipcRenderer.invoke("lcu:refresh"),

  backfillHistory: () => ipcRenderer.invoke("lcu:backfill"),

  cancelBackfill: () => ipcRenderer.invoke("lcu:cancel-backfill"),

  isBackfillRunning: () => ipcRenderer.invoke("lcu:backfill-running"),

  onBackfillDone: (callback: (result: BackfillResult | { error: string }) => void) => {
    const handler = (_event: unknown, result: BackfillResult | { error: string }) =>
      callback(result);
    ipcRenderer.on("lcu:backfill-done", handler);
    return () => ipcRenderer.removeListener("lcu:backfill-done", handler);
  },

  onBackfillProgress: (callback: (progress: BackfillProgress) => void) => {
    const handler = (_event: unknown, progress: BackfillProgress) => callback(progress);
    ipcRenderer.on("lcu:backfill-progress", handler);
    return () => ipcRenderer.removeListener("lcu:backfill-progress", handler);
  },

  getLcuStatus: () => ipcRenderer.invoke("lcu:status"),

  getChampionData: () => ipcRenderer.invoke("dragon:champions"),

  getAugmentData: (patch?: string) => ipcRenderer.invoke("dragon:augments", patch),

  resolveAugmentIcon: (id: number, patch?: string) =>
    ipcRenderer.invoke("dragon:augment-icon", id, patch),
  getItemData: (patch?: string) => ipcRenderer.invoke("dragon:items", patch),

  getSummonerSpellData: () => ipcRenderer.invoke("dragon:summoner-spells"),

  getChampionItemStats: (championId: number, patch?: string, queue?: number) =>
    ipcRenderer.invoke("db:champion-item-stats", championId, patch, queue),

  getTeammateStats: () => ipcRenderer.invoke("db:teammate-stats"),

  getTeammateDetail: (key: string) => ipcRenderer.invoke("db:teammate-detail", key),

  getGlobalStats: (patch?: string, queue?: number) =>
    ipcRenderer.invoke("db:global-stats", patch, queue),

  getTrends: (queue?: number) => ipcRenderer.invoke("db:trends", queue),

  getRecords: (queue?: number, account?: string) =>
    ipcRenderer.invoke("db:records", queue, account),

  getLiveGame: () => ipcRenderer.invoke("live:snapshot"),

  onLiveGame: (callback: (snapshot: LiveGameSnapshot) => void) => {
    const handler = (_event: unknown, snapshot: LiveGameSnapshot) => callback(snapshot);
    ipcRenderer.on("live:changed", handler);
    return () => ipcRenderer.removeListener("live:changed", handler);
  },

  getGameRecap: (gameId?: number) => ipcRenderer.invoke("db:game-recap", gameId),

  getGameCard: (gameId: number) => ipcRenderer.invoke("db:game-card", gameId),

  getGlobalChampionDetail: (championId: number, patch?: string, queue?: number) =>
    ipcRenderer.invoke("db:global-champion-detail", championId, patch, queue),

  getChallenges: () => ipcRenderer.invoke("challenges:get"),

  onChallengesChanged: (callback: (result: ChallengesResult) => void) => {
    const handler = (_event: unknown, result: ChallengesResult) => callback(result);
    ipcRenderer.on("challenges:changed", handler);
    return () => ipcRenderer.removeListener("challenges:changed", handler);
  },

  getAllSummonerPuuids: () => ipcRenderer.invoke("db:all-summoner-puuids"),

  getProfile: () => ipcRenderer.invoke("db:profile"),

  onStatusChanged: (callback: (status: LcuStatus) => void) => {
    const handler = (_event: unknown, status: LcuStatus) => callback(status);
    ipcRenderer.on("lcu:status-changed", handler);
    return () => ipcRenderer.removeListener("lcu:status-changed", handler);
  },

  onGamesUpdated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("lcu:games-updated", handler);
    return () => ipcRenderer.removeListener("lcu:games-updated", handler);
  },

  getSetting: (key: string) => ipcRenderer.invoke("settings:get", key),

  isAutoStartSupported: () => ipcRenderer.invoke("autostart:supported"),

  setSetting: (key: string, value: string) => ipcRenderer.invoke("settings:set", key, value),

  exportGameImage: (gameId: number) => ipcRenderer.invoke("export:game-image", gameId),

  copyGameImage: (gameId: number) => ipcRenderer.invoke("export:copy-game-image", gameId),

  exportData: () => ipcRenderer.invoke("data:export"),

  importData: () => ipcRenderer.invoke("data:import"),

  repairPuuids: () => ipcRenderer.invoke("data:repair-puuids"),

  listBackups: () => ipcRenderer.invoke("backup:list"),

  createBackup: () => ipcRenderer.invoke("backup:create"),

  restoreBackup: (file: string) => ipcRenderer.invoke("backup:restore", file),

  getRecoveryReport: () => ipcRenderer.invoke("backup:recovery-report"),

  openBackupFolder: () => ipcRenderer.invoke("backup:open-folder"),

  getVersion: () => ipcRenderer.invoke("app:version"),

  checkForUpdate: () => ipcRenderer.invoke("app:check-update"),

  downloadUpdate: (assetUrl: string) => ipcRenderer.invoke("app:download-update", assetUrl),

  onUpdateProgress: (callback: (percent: number) => void) => {
    const handler = (_event: unknown, percent: number) => callback(percent);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },

  openUrl: (url: string) => ipcRenderer.invoke("app:open-url", url),

  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),

  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),

  closeWindow: () => ipcRenderer.invoke("window:close"),

  isWindowMaximized: () => ipcRenderer.invoke("window:is-maximized"),

  onMaximizedChanged: (callback: (maximized: boolean) => void) => {
    const handler = (_event: unknown, maximized: boolean) => callback(maximized);
    ipcRenderer.on("window:maximized-changed", handler);
    return () => ipcRenderer.removeListener("window:maximized-changed", handler);
  },
};

contextBridge.exposeInMainWorld("api", api);
