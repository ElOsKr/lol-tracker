import { isTrackedQueue } from "../shared/queues";
import { getDatabase } from "./db";
import type { QueueLifetimeTotal } from "../shared/api";

// These are snapshots reported by Riot, not sums of locally stored matches.
export function saveQueueLifetimeTotal(
  data: any,
  game: any,
  puuid: string,
  capturedAt = Date.now(),
): boolean {
  if (!Number.isSafeInteger(capturedAt) || capturedAt <= 0 || capturedAt > Date.now()) return false;
  const player = data?.localPlayer;
  if (!puuid || player?.puuid !== puuid || data?.gameId !== game?.gameId) return false;
  const { wins, losses } = player;
  if (![wins, losses].every((v) => Number.isSafeInteger(v) && v >= 0)) return false;
  // Empty/default EOG fields must not erase an existing observation.
  if (wins + losses === 0 || !Number.isSafeInteger(wins + losses)) return false;
  if (![game.gameId, game.gameCreation].every((v) => Number.isSafeInteger(v) && v > 0))
    return false;
  if (!isTrackedQueue(game.queueId)) return false;
  const result = getDatabase()
    .prepare(`
    INSERT INTO queue_lifetime_totals
      (puuid, queue_id, wins, losses, game_id, game_creation, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(puuid, queue_id) DO UPDATE SET
      wins=excluded.wins, losses=excluded.losses, game_id=excluded.game_id,
      game_creation=excluded.game_creation, captured_at=excluded.captured_at
    WHERE excluded.game_creation >= queue_lifetime_totals.game_creation
      AND excluded.wins >= queue_lifetime_totals.wins
      AND excluded.losses >= queue_lifetime_totals.losses
      AND (excluded.wins != queue_lifetime_totals.wins OR excluded.losses != queue_lifetime_totals.losses)
  `)
    .run(puuid, game.queueId, wins, losses, game.gameId, game.gameCreation, capturedAt);
  return result.changes > 0;
}

export function getQueueLifetimeTotals(): QueueLifetimeTotal[] {
  return getDatabase()
    .prepare(`
    SELECT t.puuid, COALESCE(NULLIF(s.game_name, ''), 'Cuenta guardada') AS account,
      t.queue_id AS queueId, t.wins, t.losses, t.captured_at AS capturedAt
    FROM queue_lifetime_totals t LEFT JOIN summoner s ON s.puuid=t.puuid
    ORDER BY account, t.queue_id
  `)
    .all() as QueueLifetimeTotal[];
}
