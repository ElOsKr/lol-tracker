import { screen, type BrowserWindow, type Rectangle } from "electron";
import { getSetting, setSetting } from "./db";

const SETTING_KEY = "window_bounds";
// Matches the BrowserWindow minimums in index.ts, so a saved size can never
// undercut what the window itself enforces.
// Down to phone proportions: below 700 px wide the layout switches to its
// mobile form (see renderer/hooks/useViewport.ts), which fits this.
export const MIN_WIDTH = 480;
export const MIN_HEIGHT = 500;
const SAVE_DELAY_MS = 500;

export interface WindowState extends Rectangle {
  maximized: boolean;
}

function isWindowState(value: unknown): value is WindowState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    ["x", "y", "width", "height"].every((k) => Number.isFinite(v[k])) &&
    typeof v.maximized === "boolean"
  );
}

/**
 * Picks the bounds to open with: the saved ones when they still land on a
 * connected display, otherwise nothing so Electron centres the default size.
 * A window restored onto a monitor that was unplugged since would come up
 * off-screen with no way to grab it.
 */
export function pickBounds(saved: unknown, displays: Rectangle[]): WindowState | null {
  if (!isWindowState(saved)) return null;
  const width = Math.max(MIN_WIDTH, Math.round(saved.width));
  const height = Math.max(MIN_HEIGHT, Math.round(saved.height));
  const x = Math.round(saved.x);
  const y = Math.round(saved.y);
  // Enough of the title bar must be visible to drag the window back
  const visible = displays.some(
    (d) =>
      x + width - 100 > d.x && x + 100 < d.x + d.width && y >= d.y - 8 && y + 40 < d.y + d.height,
  );
  if (!visible) return null;
  return { x, y, width, height, maximized: saved.maximized };
}

export function readWindowState(): WindowState | null {
  const raw = getSetting(SETTING_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return pickBounds(
    parsed,
    screen.getAllDisplays().map((d) => d.workArea),
  );
}

/**
 * Keeps the setting in step with the window. Only the normal (unmaximized)
 * bounds are stored, so restoring a maximized window and un-maximizing it
 * later gives back the size it had before, not the full screen.
 */
export function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null;
  const save = () => {
    if (win.isDestroyed() || win.isMinimized()) return;
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    const state: WindowState = { ...bounds, maximized: win.isMaximized() };
    setSetting(SETTING_KEY, JSON.stringify(state));
  };
  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };
  win.on("resize", scheduleSave);
  win.on("move", scheduleSave);
  win.on("maximize", scheduleSave);
  win.on("unmaximize", scheduleSave);
  // Hiding to the tray goes through close too, so this covers both exits
  win.on("close", () => {
    if (timer) clearTimeout(timer);
    save();
  });
}
