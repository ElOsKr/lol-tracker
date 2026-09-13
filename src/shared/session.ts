// A session is a day of play, but the day doesn't end at midnight: games before
// this hour belong to the night that started the evening before.
export const DAY_START_HOUR = 5;

// Local midnight of the session day a game belongs to. Both processes run in
// the same timezone, so the match list and the recap agree on where a session
// starts without either one having to say so.
export function sessionDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(d.getHours() - DAY_START_HOUR);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
