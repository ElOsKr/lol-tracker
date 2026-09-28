import { BrowserWindow, screen } from "electron";
import path from "path";
import * as db from "./db";
import { t } from "./i18n";
import { sendToRenderer } from "./ipc";
import { localeArguments } from "./locale";
import { setPendingNotice } from "./notice-state";
import { QUEUE_LABELS } from "../shared/queues";
import {
  GAME_NOTICE_SETTING,
  NOTICE_MAX_DELAY_MS,
  chooseHighlight,
  noticeRoute,
  type GameNotice,
} from "../shared/notice";
import type { LcuStatus } from "../shared/api";
import type { TranslationKey } from "../shared/i18n";

// The card's own size, the same width as the widget so one design serves both
// surfaces, plus the gap it keeps from the corner of the work area.
const NOTICE_WIDTH = 360;
const NOTICE_HEIGHT = 132;
const NOTICE_MARGIN = 16;

// The page closes itself when its countdown runs out. This is the backstop for
// a page that never got that far, so a failed load cannot leave a card parked
// on screen for the rest of the session. Generous, because the countdown
// pauses for as long as the pointer rests on the card.
const NOTICE_HARD_CLOSE_MS = 5 * 60_000;

let noticeWindow: BrowserWindow | null = null;
let hardClose: ReturnType<typeof setTimeout> | null = null;

function enabled(): boolean {
  // Absent means on: the notice is part of the app rather than something to go
  // and find.
  return db.getSetting(GAME_NOTICE_SETTING) !== "false";
}

/**
 * Everything the card says about a game, or null when the game is not one worth
 * announcing.
 *
 * Built from the post-game recap rather than from the match row, because the
 * line of context is exactly what the recap already works out: where the score
 * lands among every game in that queue, the run it leaves you on, and the day's
 * tally behind it.
 */
export function buildGameNotice(gameId: number): GameNotice | null {
  const recap = db.getGameRecap(gameId);
  if (!recap) return null;

  const { detail } = recap;
  const stats = detail.stats;
  // A remake is in no aggregate and carries no score: there is nothing to say
  // about it that the player does not already know.
  if (!stats || detail.game.is_remake) return null;

  const scoreRank = recap.placements.find((p) => p.key === "score")?.rank ?? null;
  const highlight = chooseHighlight({
    scoreRank,
    streak: recap.streak ? { kind: recap.streak.kind, length: recap.streak.length } : null,
    session: recap.session,
    queueLabel: QUEUE_LABELS[detail.game.queue_id] ?? String(detail.game.queue_id),
  });

  return {
    gameId,
    queueId: detail.game.queue_id,
    win: !!stats.win,
    championId: stats.champion_id,
    kills: stats.kills,
    deaths: stats.deaths,
    assists: stats.assists,
    score: stats.score ?? null,
    scoreBadge: stats.score_badge ?? null,
    highlight: highlight ? t(highlight.key as TranslationKey, highlight.params) : null,
    raisedAt: Date.now(),
  };
}

function closeNoticeWindow(): void {
  if (hardClose) {
    clearTimeout(hardClose);
    hardClose = null;
  }
  const target = noticeWindow;
  noticeWindow = null;
  if (target && !target.isDestroyed()) target.destroy();
}

function openNoticeWindow(gameId: number): void {
  // Only ever one on screen: a second game finishing while the first card is
  // still up replaces it rather than stacking.
  closeNoticeWindow();

  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: NOTICE_WIDTH,
    height: NOTICE_HEIGHT,
    // The work area already stops short of the taskbar, so the margin below is
    // measured from the taskbar's edge rather than the screen's.
    x: workArea.x + workArea.width - NOTICE_WIDTH - NOTICE_MARGIN,
    y: workArea.y + workArea.height - NOTICE_HEIGHT - NOTICE_MARGIN,
    useContentSize: true,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      additionalArguments: localeArguments(),
      // The same posture as every other window: the card runs the app's own
      // renderer and reaches the database through the same preload.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
    },
  });
  noticeWindow = win;
  win.on("closed", () => {
    if (noticeWindow === win) noticeWindow = null;
  });

  const hash = noticeRoute(gameId);
  const load = process.env.ELECTRON_RENDERER_URL
    ? win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`)
    : win.loadFile(path.join(__dirname, "../renderer/index.html"), { hash });

  void load.then(
    () => {
      // showInactive, never show: appearing must not take the keyboard away
      // from whatever the player is doing.
      if (!win.isDestroyed()) win.showInactive();
    },
    (err) => {
      console.log("Could not draw the end-of-game notice:", err);
      closeNoticeWindow();
    },
  );

  hardClose = setTimeout(closeNoticeWindow, NOTICE_HARD_CLOSE_MS);
  hardClose.unref?.();
}

/**
 * Announce a game that has just been captured, if this is a moment to announce
 * anything at all.
 *
 * The notice is raised for the widget either way; the corner window is only
 * opened when the desktop widget is not there to draw it instead. The caller
 * passes the client state and whether that widget is up, so this module needs
 * to know nothing about either of them.
 */
export function maybeShowGameNotice(
  gameId: number,
  context: { main: BrowserWindow | null | undefined; status: LcuStatus; widgetOpen: boolean },
): void {
  try {
    if (!enabled()) return;
    // Already back in a game: a window pinned above a match is the one way
    // this becomes an interruption.
    if (context.status === "ingame") return;

    const notice = buildGameNotice(gameId);
    if (!notice) return;

    // A capture that needed its retries can land minutes late, by which time
    // the player is in champion select for the next one.
    const detail = db.getMatchDetail(gameId);
    const endedAt = detail
      ? detail.game.game_creation + detail.game.game_duration * 1000
      : Date.now();
    if (Date.now() - endedAt > NOTICE_MAX_DELAY_MS) return;

    // The app itself is in front, so the game is already on screen behind this.
    const { main } = context;
    if (main && !main.isDestroyed() && main.isVisible() && main.isFocused()) return;

    setPendingNotice(notice);
    if (!context.widgetOpen) openNoticeWindow(gameId);
  } catch (err) {
    // A notice is a courtesy; nothing about a stored game depends on it.
    console.log("Could not raise the end-of-game notice:", err);
  }
}

/** Closes the corner window, whether its page asked or the app is shutting down. */
export function dismissNotice(): void {
  setPendingNotice(null);
  closeNoticeWindow();
}

/**
 * Brings the app forward on the recap of the game a notice is about.
 *
 * The recap page shows the most recent game, which is this one: a notice is
 * raised the moment its game is stored, so nothing newer can exist yet.
 */
export function showRecap(main: BrowserWindow | null | undefined): void {
  dismissNotice();
  if (!main || main.isDestroyed()) return;
  if (main.isMinimized()) main.restore();
  main.show();
  main.focus();
  sendToRenderer(main, "app:navigate", "/live");
}

export function isNoticeWindow(contents: Electron.WebContents): boolean {
  return !!noticeWindow && !noticeWindow.isDestroyed() && noticeWindow.webContents === contents;
}
