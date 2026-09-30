// A session is a day of play, but the day doesn't end at midnight: games before
// this hour belong to the night that started the evening before.
export const DAY_START_HOUR = 5;

// How the match list breaks its rows into sessions. The post-game recap always
// talks about a day, whichever of these is chosen.
export type SessionGrouping = "day" | "week" | "patch" | "none";

export const SESSION_GROUPING_SETTING = "session_grouping";
export const DEFAULT_SESSION_GROUPING: SessionGrouping = "day";

export function parseSessionGrouping(raw: string | null | undefined): SessionGrouping {
  return raw === "week" || raw === "patch" || raw === "none" ? raw : DEFAULT_SESSION_GROUPING;
}

// Local midnight of the session day a game belongs to. Both processes run in
// the same timezone, so the match list and the recap agree on where a session
// starts without either one having to say so.
export function sessionDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(d.getHours() - DAY_START_HOUR);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Local midnight of the Monday that starts the session week, taking the same
// view of when a day begins as sessionDay.
export function sessionWeek(ms: number): number {
  const d = new Date(sessionDay(ms));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// The same day as a calendar date, taking what sessionDay returned rather than
// a game's own timestamp: SQLite has no local-midnight epoch to hand back, so
// its session totals are keyed by date string, and this is what matches a
// session grouped in the renderer up with them.
function sessionDayKey(day: number): string {
  const d = new Date(day);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${date}`;
}

// What a game is grouped under, in the form the database groups by too. Day and
// week are dates; a patch is the stored version, with games that never got one
// pooled under the empty string.
export function sessionKey(
  game: { game_creation: number; game_version?: string | null },
  grouping: SessionGrouping,
): string {
  switch (grouping) {
    case "week":
      return sessionDayKey(sessionWeek(game.game_creation));
    case "patch":
      return game.game_version || "";
    default:
      return sessionDayKey(sessionDay(game.game_creation));
  }
}

// The session the panel on the home page has already shown. Holds that
// session's day, so a night is summarised once and the next one appears on
// its own. It must also be listed in RENDERER_SETTINGS or the renderer's
// write is refused with only a console warning — the interface looks like it
// worked and nothing persists.
export const SESSION_SEEN_SETTING = "session_seen";

// Below this a night has no shape worth a panel of its own, and everything
// it could say is already in that one game's own recap.
export const SESSION_MIN_GAMES = 2;

/**
 * Whether there is a night to summarise that has not been summarised already.
 *
 * The session must be over — the day of play ends at 5am, not at midnight —
 * have more than one game, and not be the one the panel was last closed on.
 * `seen` is the day stored under SESSION_SEEN_SETTING.
 */
export function shouldShowSession(
  session: { day: number; games: number; finished: boolean } | null,
  seen: number | null,
): boolean {
  if (!session || !session.finished) return false;
  if (session.games < SESSION_MIN_GAMES) return false;
  return seen !== session.day;
}
