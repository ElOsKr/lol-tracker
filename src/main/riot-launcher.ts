import { app, shell } from "electron";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { APP_USER_MODEL_ID } from "./shortcut";
import { t } from "./i18n";
import { LAUNCH_LEAGUE_FLAG } from "../shared/startup";

// Where the Riot Client records every copy of itself, whatever drive League
// ended up on. rc_live is what the launcher uses today; rc_default is what
// older installs wrote, and is still there on most machines.
const INSTALLS_FILE = path.join(
  process.env.ProgramData ?? "C:\\ProgramData",
  "Riot Games",
  "RiotClientInstalls.json",
);
const DEFAULT_CLIENT = "C:\\Riot Games\\Riot Client\\RiotClientServices.exe";

// What the Riot Client itself passes when League is started from a shortcut.
const LEAGUE_ARGS = ["--launch-product=league_of_legends", "--launch-patchline=live"];

/** The Riot Client's executable, or null when no copy of it can be found. */
export function findRiotClient(): string | null {
  const candidates: string[] = [];
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(INSTALLS_FILE, "utf8"));
    const record = raw as Record<string, unknown>;
    for (const key of ["rc_live", "rc_default"]) {
      const value = record?.[key];
      if (typeof value === "string" && value) candidates.push(value);
    }
  } catch {
    // No record, or one we can't read: the default path is the only guess left
  }
  candidates.push(DEFAULT_CLIENT);

  for (const candidate of candidates) {
    // The file records its paths with forward slashes
    const exe = path.normalize(candidate);
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

/** Starts League through the Riot Client. False when there is none to start. */
export function launchLeague(): boolean {
  const exe = findRiotClient();
  if (!exe) {
    console.log("No Riot Client found, so League was not launched");
    return false;
  }
  try {
    // Detached: the client outlives us, and must not be taken down with us
    spawn(exe, LEAGUE_ARGS, {
      detached: true,
      stdio: "ignore",
      cwd: path.dirname(exe),
    }).unref();
    console.log(`Launched League through ${exe}`);
    return true;
  } catch (err) {
    console.error("Failed to launch League:", err);
    return false;
  }
}

// The shortcut points at the app the user keeps, which only a packaged build
// has; and it is pointless without a client for it to open.
export function isLeagueShortcutSupported(): boolean {
  return (
    process.platform === "win32" &&
    !!process.env.PORTABLE_EXECUTABLE_FILE &&
    findRiotClient() !== null
  );
}

/**
 * Writes a desktop shortcut that opens League and this app together.
 *
 * It targets the app rather than a script: a shortcut can only point at one
 * thing, and having the app open League is one file to trust instead of a
 * batch file that flashes a console window and makes antivirus software
 * suspicious.
 */
export function createLeagueShortcut(): { success: boolean; path?: string; error?: string } {
  const exe = process.env.PORTABLE_EXECUTABLE_FILE;
  if (process.platform !== "win32" || !exe) {
    return { success: false, error: t("startup.shortcutNotPackaged") };
  }
  if (!findRiotClient()) {
    return { success: false, error: t("startup.shortcutNoClient") };
  }

  const link = path.join(app.getPath("desktop"), `${t("startup.shortcutName")}.lnk`);
  try {
    shell.writeShortcutLink(link, "create", {
      target: exe,
      args: LAUNCH_LEAGUE_FLAG,
      cwd: path.dirname(exe),
      description: t("startup.shortcutDescription"),
      appUserModelId: APP_USER_MODEL_ID,
    });
    return { success: true, path: link };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
