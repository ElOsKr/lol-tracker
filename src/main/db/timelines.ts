// Storage for a game's timeline: a frame a minute with everyone's gold,
// experience, level, minions and position, plus every kill with who killed
// whom, where and when.
//
// Its own table rather than a column on `games` for two reasons. `games` is
// scanned by nearly every statistics query, and a blob per row makes those
// pages heavier for no gain; and a game that is repaired or re-ingested
// rewrites its `games` row, which would throw away a capture that may no
// longer be obtainable.

import zlib from "zlib";
import { db } from "./connection";

export function hasTimeline(gameId: number): boolean {
  return db.prepare("SELECT 1 FROM game_timelines WHERE game_id = ?").get(gameId) != null;
}

export function saveTimeline(gameId: number, timeline: unknown, now = Date.now()): void {
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(timeline), "utf8"));
  db.prepare(
    "INSERT OR REPLACE INTO game_timelines (game_id, timeline_gz, captured_at) VALUES (?, ?, ?)",
  ).run(gameId, gz, now);
}

export function getTimeline(gameId: number): unknown | null {
  const row = db.prepare("SELECT timeline_gz FROM game_timelines WHERE game_id = ?").get(gameId) as
    | { timeline_gz: Buffer }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(zlib.gunzipSync(row.timeline_gz).toString("utf8"));
  } catch {
    return null;
  }
}

// A game the client refused is not asked about again for this long. Long
// enough not to hammer one that has aged out for good, short enough that a
// client that was simply having a bad day gets another chance.
const RETRY_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Games with no timeline yet, newest first.
 *
 * Newest first because a game only stops being obtainable by ageing out of
 * Riot's window, so the oldest are the ones already lost if any are; working
 * forwards would spend every run retrying the same dead ones. Remakes are
 * skipped: a cancelled game has nothing to plot.
 */
export function gamesMissingTimeline(limit: number, now = Date.now()): number[] {
  const rows = db
    .prepare(`
      SELECT g.game_id
      FROM games g
      LEFT JOIN game_timelines t ON t.game_id = g.game_id
      LEFT JOIN game_timelines_missing m ON m.game_id = g.game_id
      WHERE t.game_id IS NULL
        AND g.is_remake = 0
        AND (m.game_id IS NULL OR m.checked_at < ?)
      ORDER BY g.game_creation DESC
      LIMIT ?
    `)
    .all(now - RETRY_AFTER_MS, limit) as { game_id: number }[];
  return rows.map((r) => r.game_id);
}

/** Games the client refused, so a later run does not keep asking for them. */
export function markTimelineUnavailable(gameId: number, now = Date.now()): void {
  db.prepare(
    "INSERT OR REPLACE INTO game_timelines_missing (game_id, checked_at) VALUES (?, ?)",
  ).run(gameId, now);
}

export function timelineCoverage(): { stored: number; total: number; bytes: number } {
  const total = db.prepare("SELECT COUNT(*) c FROM games WHERE is_remake = 0").get() as {
    c: number;
  };
  const stored = db
    .prepare("SELECT COUNT(*) c, COALESCE(SUM(LENGTH(timeline_gz)), 0) b FROM game_timelines")
    .get() as {
    c: number;
    b: number;
  };
  return { stored: stored.c, total: total.c, bytes: stored.b };
}
