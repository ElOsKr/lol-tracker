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

// The same day as a calendar date, taking what sessionDay returned rather than
// a game's own timestamp: SQLite has no local-midnight epoch to hand back, so
// its session totals are keyed by date string, and this is what matches a
// session grouped in the renderer up with them.
export function sessionDayKey(day: number): string {
  const d = new Date(day);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${date}`;
}
