import type { MatchListItem } from "./types";
import { sessionDay, sessionKey, sessionWeek, type SessionGrouping } from "../../shared/session";
import { formatPatch, LOCALE } from "./format";
import type { Translate } from "./i18n";

/**
 * Grouping the history into the headings it shows above each run of games.
 *
 * Lives here rather than in the page because it is the one part of that
 * screen that is pure: rows in, headings and totals out. The page was 1,361
 * lines when this came out of it, which is the size at which nobody reads a
 * file before changing it.
 */
export interface Session {
  // Doubles as the React key and as what the database's totals are looked up by
  key: string;
  label: string;
  matches: MatchListItem[];
  // Games in the whole session, which is more than `matches` holds until the
  // list has been scrolled to the end of the session
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  avgScore: number | null;
}

// Expects a date-ordered list (either direction); remakes count toward the
// session's size but stay out of its record and averages.
//
// Rows are pooled by key rather than by runs of neighbours, so the games from a
// patch that no longer sit together — an older game missing its version can
// land between two that have it — still read as the one session the totals
// below the header describe.
export function groupIntoSessions(
  matches: MatchListItem[],
  grouping: SessionGrouping,
  t: Translate,
): Session[] {
  const sessions = new Map<string, Session>();
  const scores = new Map<string, { sum: number; games: number }>();

  for (const m of matches) {
    const key = sessionKey(m, grouping);
    let session = sessions.get(key);
    if (!session) {
      session = {
        key,
        label: sessionLabel(m, grouping, t),
        matches: [],
        games: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        avgScore: null,
      };
      sessions.set(key, session);
      scores.set(key, { sum: 0, games: 0 });
    }
    session.matches.push(m);
    session.games++;
    if (m.is_remake) continue;
    if (m.win) session.wins++;
    else session.losses++;
    session.kills += m.kills;
    session.deaths += m.deaths;
    session.assists += m.assists;
    if (m.score != null) {
      const score = scores.get(key)!;
      score.sum += m.score;
      score.games++;
    }
  }

  for (const session of sessions.values()) {
    const score = scores.get(session.key)!;
    if (score.games > 0) session.avgScore = score.sum / score.games;
  }
  return [...sessions.values()];
}

export function sessionLabel(
  match: MatchListItem,
  grouping: SessionGrouping,
  t: Translate,
): string {
  if (grouping === "patch") {
    return match.game_version
      ? t("history.patchLabel", { patch: formatPatch(match.game_version) })
      : t("history.unknownPatch");
  }
  if (grouping === "week") return weekLabel(sessionWeek(match.game_creation), t);
  return dayLabel(sessionDay(match.game_creation), t);
}

function dayLabel(day: number, t: Translate): string {
  const d = new Date(day);
  const today = new Date(sessionDay(Date.now()));
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t("history.today");
  if (d.toDateString() === yesterday.toDateString()) return t("history.yesterday");
  return d.toLocaleDateString(LOCALE, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
}

// Weeks run Monday to Sunday, and are named by the Monday that opens them.
function weekLabel(week: number, t: Translate): string {
  const d = new Date(week);
  const thisWeek = new Date(sessionWeek(Date.now()));
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(thisWeek.getDate() - 7);
  if (d.toDateString() === thisWeek.toDateString()) return t("history.thisWeek");
  if (d.toDateString() === lastWeek.toDateString()) return t("history.lastWeek");
  const start = d.toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== thisWeek.getFullYear() && { year: "numeric" }),
  });
  return t("history.weekOf", { start });
}
