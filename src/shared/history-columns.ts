/**
 * Which numbers the history row shows, given the queue being looked at.
 *
 * The list is always filtered to one queue, so this is decided once per page
 * rather than per row — but from the rows themselves, not from a list of
 * queue ids, so a mode added later lands in the right shape on its own.
 */

/** Just enough of a row to answer the question. */
export interface ColumnSample {
  wards: number;
}

/**
 * Whether minions and vision are worth a column.
 *
 * The test is **wards**, not the vision score, and that is the whole trick.
 * Across the stored library the Abyss never records a single ward placed or
 * cleared, while every Rift queue records them in nearly every game — but the
 * client still hands out a stray vision point in about one ARAM in sixty, so
 * a column hung on the score would appear in ARAM showing zeroes.
 *
 * Minions ride along with vision rather than getting their own test: a map
 * where you ward is a map with lanes and a jungle, and ARAM's minion count,
 * while not zero, compares nothing — everybody walks the same bridge.
 */
export function showsLaneStats(rows: readonly ColumnSample[]): boolean {
  return rows.some((row) => row.wards > 0);
}
