import path from "path";
import fs from "fs";
import { app } from "electron";

// In development, use the project's data directory
// In production, use app.getPath('userData')
function getRootDir() {
  const isDev = !app.isPackaged;
  return isDev ? path.join(__dirname, "..", "..") : app.getPath("userData");
}

// The app was called mayhem-tracker until 0.2.0, and Electron derives the
// userData folder from the package name, so every install before the rename
// keeps its games and backups under the old folder. Nothing else in that
// folder is worth carrying over (Chromium caches, session storage).
export const LEGACY_APP_NAME = "mayhem-tracker";
const MIGRATED_SUBDIRS = ["data", "backups"];

// Moves each subfolder that exists under oldRoot and not yet under newRoot.
// A rename rather than a copy: same volume, atomic per folder, and a partial
// failure leaves whichever side has the folder intact rather than two halves.
// Returns the names it moved, so the caller can log what happened.
export function migrateLegacyRoot(oldRoot: string, newRoot: string): string[] {
  if (oldRoot === newRoot || !fs.existsSync(oldRoot)) return [];
  const moved: string[] = [];
  for (const name of MIGRATED_SUBDIRS) {
    const from = path.join(oldRoot, name);
    const to = path.join(newRoot, name);
    if (!fs.existsSync(from) || fs.existsSync(to)) continue;
    fs.mkdirSync(newRoot, { recursive: true });
    fs.renameSync(from, to);
    moved.push(name);
  }
  return moved;
}

// Call once, after the app is ready and before anything opens the database.
// Chromium has usually created the new userData folder by then, which is why
// this moves the subfolders rather than the folder itself.
export function migrateLegacyUserData(): void {
  if (!app.isPackaged) return;
  const oldRoot = path.join(app.getPath("appData"), LEGACY_APP_NAME);
  try {
    const moved = migrateLegacyRoot(oldRoot, app.getPath("userData"));
    if (moved.length) console.log(`Moved ${moved.join(" and ")} from ${oldRoot}`);
  } catch (err) {
    // Leaving the old folder in place loses nothing: the next launch tries
    // again, and the old files stay readable by hand meanwhile.
    console.error("Failed to migrate the legacy data folder:", err);
  }
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getDataDir() {
  return ensureDir(path.join(getRootDir(), "data"));
}

// A sibling of the data directory, never a child of it: the failure this
// guards against includes "the data folder got wiped", and backups kept inside
// it would go the same way.
export function getBackupDir() {
  return ensureDir(path.join(getRootDir(), "backups"));
}
