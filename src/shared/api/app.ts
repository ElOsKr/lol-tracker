// La aplicación en sí: importación, actualizaciones y copias de seguridad.
//
// Parte del contrato IPC: todo lo de aquí cruza el puente.

export interface BackfillProgress {
  current: number;
  total: number;
  added: number;
}

// How far an import from a backup file has got: games read of the file's
// total, and how many of those were new
export interface ImportProgress {
  current: number;
  total: number;
  imported: number;
}

// Riot's match history service holds only this many matches per account, and
// reports the end of that window as an empty page — exactly what a genuine end
// of history looks like. Older IDs can sometimes still be fetched directly if already known.
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
  // Every release newer than the installed version, newest first, so someone who
  // skipped a few versions sees the notes they missed rather than only the last
  // set. Empty when already up to date.
  releases?: ReleaseNote[];
  // True when the fetched page never reached back to the installed version, so
  // there are skipped releases the dialog cannot show.
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

// ---- Home page ----
