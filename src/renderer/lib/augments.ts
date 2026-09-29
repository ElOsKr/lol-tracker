import type { AugmentData, AugmentStatsDetailed } from "./types";

// The augment tab used to list only what the player had been offered. That is
// the stats half of it; the catalogue half is everything Riot ships, so an
// augment can be looked up before it ever turns up in a game.

export interface AugmentRow extends AugmentStatsDetailed {
  // Zero for an augment the player has never picked
  picks: number;
  wins: number;
}

/**
 * Every augment, each carrying the player's record with it.
 *
 * An entry with no name of its own is Riot's internal filler, and is left out
 * unless the player has actually picked it, in which case it belongs to their
 * history whatever Riot calls it.
 */
export function buildAugmentCatalog(
  augments: AugmentData,
  stats: AugmentStatsDetailed[],
): AugmentRow[] {
  const byId = new Map(stats.map((row) => [row.augment_id, row]));
  const rows: AugmentRow[] = [];

  for (const [key, augment] of Object.entries(augments)) {
    const id = Number(key);
    const picked = byId.get(id);
    if (!augment.name && !picked) continue;
    rows.push(picked ?? { augment_id: id, picks: 0, wins: 0, champions: [] });
    byId.delete(id);
  }

  // Anything the player has picked that the catalogue no longer lists: an
  // augment retired between patches is still part of their history.
  for (const row of byId.values()) rows.push(row);

  return rows;
}
