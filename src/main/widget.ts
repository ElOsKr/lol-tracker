import { TRACKED_QUEUE_IDS, QUEUE_ID_ARAM, isTrackedQueue, hasAugments } from "../shared/queues";
import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import * as db from "./db";
import { isClientConnected } from "./lcu";
import {
  getChampionDataVersion,
  loadAugmentData,
  loadItemData,
  type AugmentInfo,
  type ItemInfo,
} from "./dragon";
import type { MatchListItem } from "../shared/api";
import type { WidgetPreferences, WidgetSnapshot, WidgetState } from "../shared/widget";
import { startWidgetServer } from "./widget-server";

let window: BrowserWindow | null = null;
let obs: Awaited<ReturnType<typeof startWidgetServer>> | null = null;
let starting: Promise<void> | null = null;
let stopping = false;
const assets = new Map<
  string,
  { augments: Record<number, AugmentInfo>; items: Record<number, ItemInfo> }
>();
const retryAfter = new Map<string, number>();
const root = () => path.join(app.getAppPath(), "public-widget");

function patchAssets(patch: string) {
  if (!assets.has(patch) && Date.now() >= (retryAfter.get(patch) ?? 0)) {
    retryAfter.set(patch, Infinity);
    // Asset loading must never hold up an offline snapshot.
    void Promise.all([loadAugmentData(patch || undefined), loadItemData(patch || undefined)]).then(
      ([augments, items]) => assets.set(patch, { augments, items }),
      () => retryAfter.set(patch, Date.now() + 60_000),
    );
  }
  return assets.get(patch);
}
function icon(asset?: { branch: string; iconPath: string }): string | null {
  return asset?.iconPath
    ? `https://raw.communitydragon.org/${asset.branch}/game/${asset.iconPath.replace("/lol-game-data/assets/", "").toLowerCase()}`
    : null;
}

function preferences(): WidgetPreferences {
  const savedHeight = Number(db.getSetting("widget_height") ?? 560);
  const savedOpacity = Number(db.getSetting("widget_opacity") ?? 100);
  const height =
    Number.isInteger(savedHeight) && savedHeight >= 280 && savedHeight <= 560 ? savedHeight : 560;
  const opacity =
    Number.isInteger(savedOpacity) && savedOpacity >= 30 && savedOpacity <= 100
      ? savedOpacity
      : 100;
  const account =
    db.getSetting("widget_account") ||
    db.getSummoner()?.puuid ||
    db.getMatchFilterOptions().accounts[0]?.puuid ||
    "";
  const value = db.getSetting("widget_queue");
  const queue = value !== null && value !== "" ? Number(value) : null;
  return {
    height,
    opacity,
    account,
    queue: isTrackedQueue(queue) ? queue : QUEUE_ID_ARAM,
  };
}

export function widgetSnapshot(): WidgetSnapshot {
  const selected = preferences();
  const filters = { account: selected.account, queue: selected.queue ?? undefined };
  const totals = selected.account ? db.getDashboardData(filters) : { wins: 0, totalGames: 0 };
  const history = selected.account
    ? db.getMatchHistory(100, 0, filters)
    : { matches: [], total: 0 };
  const rows: MatchListItem[] = history.matches;
  const valid = rows.filter((row) => !row.is_remake);
  const same = valid.findIndex((row) => row.win !== valid[0]?.win);
  const length = same < 0 ? valid.length : same;
  const account = db.getMatchFilterOptions().accounts.find((a) => a.puuid === selected.account);
  return {
    matches: rows.slice(0, 15).map((row) => {
      const data = patchAssets(row.game_version ?? "");
      const items = [row.item0, row.item1, row.item2, row.item3, row.item4, row.item5].map(
        (id) => id ?? 0,
      );
      return {
        matchId: String(row.game_id),
        gameCreation: row.game_creation,
        queueId: row.queue_id,
        win: !!row.win,
        placement: row.placement ?? null,
        remake: !!row.is_remake,
        championId: row.champion_id,
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        items,
        itemIcons: items.map((id) => icon(data?.items[id])),
        augments: (hasAugments(row.queue_id) ? (row.augment_ids ?? "") : "")
          .split(",")
          .map(Number)
          .filter((id) => id > 0)
          .map((id) => {
            const aug = data?.augments[id];
            return {
              url: icon(aug),
              nameTRA: aug?.name ?? `Aumento ${id}`,
              rarity: aug?.rarity ?? "silver",
            };
          }),
      };
    }),
    streak: length * (valid[0]?.win ? 1 : -1),
    streakLimited: same < 0 && history.total > rows.length,
    totalWinrate: totals.totalGames ? Math.round((totals.wins / totals.totalGames) * 1000) / 10 : 0,
    totalMatches: totals.totalGames,
    totalWins: totals.wins,
    totalLosses: totals.totalGames - totals.wins,
    summonerName: account?.name ?? "Invocador",
    connected: isClientConnected(),
    error: isClientConnected() ? null : "LoL desconectado · historial guardado",
    pollIntervalMs: 5000,
    assetVersion: getChampionDataVersion(),
  };
}

export function openWidget() {
  if (window && !window.isDestroyed()) {
    window.restore();
    window.show();
    window.focus();
    return;
  }
  let position: { x?: number; y?: number } = {};
  try {
    const saved = JSON.parse(db.getSetting("widget_position") ?? "null");
    if (
      saved &&
      Number.isInteger(saved.x) &&
      Number.isInteger(saved.y) &&
      screen
        .getAllDisplays()
        .some(
          ({ workArea: a }) =>
            saved.x >= a.x &&
            saved.y >= a.y &&
            saved.x + 360 <= a.x + a.width &&
            saved.y + 100 <= a.y + a.height,
        )
    )
      position = { x: saved.x, y: saved.y };
  } catch {
    /* Use the default position if an old display is unavailable. */
  }
  const win = new BrowserWindow({
    ...position,
    width: 360,
    height: preferences().height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/widget.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    },
  });
  window = win;
  win.setOpacity(preferences().opacity / 100);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.on("move", () => {
    if (!stopping) {
      const { x, y } = win.getBounds();
      db.setSetting("widget_position", JSON.stringify({ x, y }));
    }
  });
  win.on("closed", () => {
    window = null;
  });
  // Reuse the transparent window to avoid the native Electron crash reproduced
  // when destroying it during Windows UI testing.
  win.on("close", (event) => {
    if (!stopping) {
      event.preventDefault();
      win.hide();
    }
  });
  void win
    .loadFile(path.join(root(), "widget.html"))
    .then(() => {
      if (!win.isDestroyed()) win.show();
    })
    .catch((error) => {
      console.error("Widget load failed", error);
      win.destroy();
    });
}

function state(): WidgetState {
  return {
    preferences: preferences(),
    obsUrl: obs?.url ?? null,
    desktopOpen: window?.isVisible() ?? false,
  };
}

export function registerWidgetHandlers(main: () => BrowserWindow | null) {
  const allow = (event: Electron.IpcMainInvokeEvent, desktop = false) => {
    if (
      event.senderFrame !== event.sender.mainFrame ||
      (event.sender !== main()?.webContents && !(desktop && event.sender === window?.webContents))
    )
      throw new Error("Invalid widget sender");
  };
  ipcMain.handle("widget:snapshot", (event) => {
    allow(event, true);
    return widgetSnapshot();
  });
  ipcMain.handle("widget:state", (event) => {
    allow(event);
    return state();
  });
  ipcMain.handle("widget:open", (event) => {
    allow(event);
    openWidget();
    return state();
  });
  ipcMain.handle("widget:preferences", (event, value: WidgetPreferences) => {
    allow(event);
    if (
      !value ||
      !Number.isInteger(value.height) ||
      value.height < 280 ||
      value.height > 560 ||
      !Number.isInteger(value.opacity) ||
      value.opacity < 30 ||
      value.opacity > 100 ||
      typeof value.account !== "string" ||
      (value.account !== "" &&
        !db.getMatchFilterOptions().accounts.some((a) => a.puuid === value.account)) ||
      !Number.isInteger(value.queue) ||
      !TRACKED_QUEUE_IDS.includes(value.queue as number)
    )
      throw new Error("Invalid widget selection");
    db.setSetting("widget_account", value.account);
    db.setSetting("widget_height", String(value.height));
    db.setSetting("widget_opacity", String(value.opacity));
    if (window && !window.isDestroyed()) {
      window.setSize(360, value.height);
      window.setOpacity(value.opacity / 100);
    }
    db.setSetting("widget_queue", value.queue === null ? "" : String(value.queue));
    return state();
  });
  ipcMain.handle("widget:obs", async (event, enabled: boolean) => {
    allow(event);
    if (typeof enabled !== "boolean") throw new Error("Invalid OBS state");
    if (starting) await starting;
    if (enabled && !obs && !stopping) {
      starting = startWidgetServer(root(), widgetSnapshot).then((server) => {
        if (stopping) server.close();
        else obs = server;
      });
      try {
        await starting;
      } finally {
        starting = null;
      }
    } else if (!enabled) {
      obs?.close();
      obs = null;
    }
    return state();
  });
  ipcMain.on("widget:minimize", (event) => {
    if (event.sender === window?.webContents && event.senderFrame === event.sender.mainFrame)
      window.minimize();
  });
  ipcMain.on("widget:close", (event) => {
    const target = window;
    if (
      target &&
      event.sender === target.webContents &&
      event.senderFrame === event.sender.mainFrame
    )
      // Destroy the sender only after Electron has finished dispatching its IPC message.
      setImmediate(() => {
        if (!target.isDestroyed()) target.close();
      });
  });
}

export function stopWidget() {
  stopping = true;
  obs?.close();
  obs = null;
  window?.destroy();
}
