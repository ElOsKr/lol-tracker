// Where a game's length stops being "about the same" and starts being a
// different kind of game. Chosen from the real spread rather than round
// numbers: half of the games run between 16 and 20 minutes, so the middle
// needs finer cuts than the tails, where a single bucket holds everything.
export const DURATION_BUCKETS: readonly number[] = [0, 12, 15, 18, 21, 25];

/** The lower edge of the bucket a game of this length falls in, in minutes. */
export function durationBucket(seconds: number): number {
  const minutes = seconds / 60;
  let edge = DURATION_BUCKETS[0];
  for (const candidate of DURATION_BUCKETS) {
    if (minutes >= candidate) edge = candidate;
  }
  return edge;
}
