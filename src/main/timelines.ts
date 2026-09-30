// Fetching a game's timeline from the League client and keeping it.
//
// This is where the post-game graphs and the kill map come from, and it is a
// different resource from the end-of-game block: one frame a minute with
// every player's gold, experience, level, minions and position, plus the
// kills with killer, victim, assists, coordinates and timestamp.
//
// Why it is worth doing before anything is built on it: the client answers
// for games in its history and nothing else. Measured on 2026-09-30, it
// answered for all 1056 games stored, back to August 2025, at about 8 KB
// gzipped each. A game that ages out of that window takes its timeline with
// it and there is no second chance, so the capture runs now and the pages
// that read it can come later.

import * as db from "./db";

// Handed in rather than imported, so this module does not close a cycle with
// lcu.ts, which is what calls it — and so it can be exercised without a
// League client anywhere near it.
export type LcuGet = (path: string) => Promise<any | null>;

const TIMELINE_PATH = (gameId: number) => `/lol-match-history/v1/game-timelines/${gameId}`;

// How many to fetch before pausing. The client answers these in a few
// milliseconds each, but it is the same client the user is playing on, so the
// backfill stays a background hum rather than a burst of a thousand requests.
const BATCH_SIZE = 20;
const BATCH_PAUSE_MS = 3_000;
// Games per run. A thousand-game history is covered in a few launches instead
// of holding the client busy for one long one.
const MAX_PER_RUN = 300;
// Consecutive failures that end the run: past this the client is not going to
// start answering, and the rest can wait for the next launch.
const GIVE_UP_AFTER = 8;

/** A timeline is only worth keeping if it actually has frames in it. */
function looksUsable(data: any): boolean {
  return Array.isArray(data?.frames) && data.frames.length > 0;
}

/**
 * Take one game's timeline, unless it is already stored.
 *
 * Returns true when something new was saved. Never throws: a missing
 * timeline costs a graph, and must not cost the capture of the game itself.
 */
export async function captureTimeline(gameId: number, get: LcuGet): Promise<boolean> {
  try {
    if (db.hasTimeline(gameId)) return false;
    const data = await get(TIMELINE_PATH(gameId));
    if (!looksUsable(data)) {
      db.markTimelineUnavailable(gameId);
      return false;
    }
    db.saveTimeline(gameId, data);
    return true;
  } catch (err) {
    console.log(`Could not read the timeline for game ${gameId}:`, err);
    return false;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Walk backwards through stored games taking the timelines they are missing.
 *
 * `keepGoing` is asked before every batch so the run stops the moment the
 * client goes away or a game starts: this is housekeeping, and it gives way
 * to anything the user is actually doing.
 */
export async function backfillTimelines(
  get: LcuGet,
  keepGoing: () => boolean,
  // Only the tests pass this: waiting three real seconds a batch would make
  // the suite spend most of its time asleep.
  pauseMs = BATCH_PAUSE_MS,
): Promise<{ saved: number; missing: number; remaining: number }> {
  let saved = 0;
  let missing = 0;
  let failures = 0;

  for (let done = 0; done < MAX_PER_RUN; done += BATCH_SIZE) {
    if (!keepGoing()) break;
    const batch = db.gamesMissingTimeline(BATCH_SIZE);
    if (batch.length === 0) break;

    for (const gameId of batch) {
      if (!keepGoing()) break;
      const ok = await captureTimeline(gameId, get);
      if (ok) {
        saved++;
        failures = 0;
      } else {
        missing++;
        failures++;
      }
      if (failures >= GIVE_UP_AFTER) break;
    }
    if (failures >= GIVE_UP_AFTER) break;
    await wait(pauseMs);
  }

  const coverage = db.timelineCoverage();
  const remaining = coverage.total - coverage.stored;
  if (saved > 0 || missing > 0) {
    console.log(
      `Timelines: saved ${saved}, unavailable ${missing}; ` +
        `${coverage.stored}/${coverage.total} stored, ${Math.round(coverage.bytes / 1024 / 1024)} MB, ${remaining} to go`,
    );
  }
  return { saved, missing, remaining };
}
