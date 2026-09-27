import { QUEUE_ID_ARAM, isTrackedQueue } from "../../shared/queues";
import { db } from "./connection";
import { getSetting } from "./settings";

// The unfiltered list is used for maintenance and catalogue discovery.
export function getStoredQueues(): number[] {
  const rows = db
    .prepare(`
      SELECT DISTINCT g.queue_id
      FROM games g
      JOIN player_stats ps ON g.game_id = ps.game_id
      ORDER BY g.queue_id
    `)
    .all() as { queue_id: number }[];
  return rows.map((r) => r.queue_id);
}

// The queue picked in the app's global selector. A missing selection resolves
// to one queue, never to an aggregate: stats from different queues never mix.
export function selectedQueue(): number {
  const saved = getSetting("selected_queue");
  const value = saved == null || saved === "" ? NaN : Number(saved);
  return isTrackedQueue(value) ? value : QUEUE_ID_ARAM;
}

// Appends the queue condition to a query's WHERE list: the explicit queue when
// the caller has one, otherwise the app's selected queue.
export function applyQueueFilter(where: string[], params: any[], queue?: number, alias = "g") {
  where.push(`${alias}.queue_id = ?`);
  params.push(isTrackedQueue(queue) ? queue : selectedQueue());
}

// Remakes are already left out of every stat; this setting takes them out of
// the match list as well. An absent key means they stay visible.
export function hideRemakes(): boolean {
  return getSetting("hide_remakes") === "true";
}
