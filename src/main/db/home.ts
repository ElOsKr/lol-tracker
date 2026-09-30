import type { HomeChampion, HomeSessionGame, HomeSummary } from "../../shared/api";
import { hasScore } from "../../shared/queues";
import { sessionDay } from "../../shared/session";
import { selectedQueue } from "./filters";
import { type CareerRow, careerRows } from "./records";

// How many results the streak card draws as a strip
const RECENT_RESULTS = 10;
// How many of the last games the page lists
const RECENT_GAMES = 3;
// The best champion is picked from the last month of play, rolling rather than
// calendar so the card doesn't start every month empty
export const CHAMPION_WINDOW_DAYS = 30;
// A champion needs this many games in the window before an average means
// anything; below it a single good game would win the card
const CHAMPION_MIN_GAMES = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

interface ChampionTally {
  championId: number;
  games: number;
  wins: number;
  scoreSum: number;
  scored: number;
}

// The score the player usually gets, over everything this queue has stored.
// Only the average is compared, never totals: a total says as much about how
// long a game ran as about how it went.
function careerAverageScore(rows: CareerRow[]): number | null {
  let sum = 0;
  let scored = 0;
  for (const r of rows) {
    if (r.score == null) continue;
    sum += r.score;
    scored++;
  }
  return scored > 0 ? sum / scored : null;
}

/**
 * How long ago the last bigger session was, in days, or null if this is the
 * biggest there has ever been.
 *
 * Only worth knowing to say "your longest night in three weeks", so a tie
 * does not count: another six-game night last week makes this one ordinary.
 */
function daysSinceLongerSession(rows: CareerRow[], day: number, games: number): number | null {
  const counts = new Map<number, number>();
  for (const r of rows) {
    const d = sessionDay(r.game_creation);
    if (d >= day) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let newest: number | null = null;
  for (const [d, count] of counts) {
    if (count > games && (newest == null || d > newest)) newest = d;
  }
  return newest == null ? null : Math.round((day - newest) / DAY_MS);
}

function averageScore(tally: { scoreSum: number; scored: number }): number | null {
  return tally.scored > 0 ? tally.scoreSum / tally.scored : null;
}

// The champion the last month went best on. Ranked on the average score where
// the queue has one, otherwise on win rate; the game count breaks ties either
// way. Only champions with enough games compete, unless nobody has enough, in
// which case the most played one stands in so the card still says something.
function bestChampion(rows: CareerRow[], scored: boolean): HomeChampion | null {
  if (rows.length === 0) return null;
  const tallies = new Map<number, ChampionTally>();
  for (const r of rows) {
    let tally = tallies.get(r.champion_id);
    if (!tally) {
      tally = { championId: r.champion_id, games: 0, wins: 0, scoreSum: 0, scored: 0 };
      tallies.set(r.champion_id, tally);
    }
    tally.games++;
    tally.wins += r.win;
    if (r.score != null) {
      tally.scoreSum += r.score;
      tally.scored++;
    }
  }

  const rankedBy: HomeChampion["rankedBy"] = scored ? "score" : "winRate";
  const rank = (t: ChampionTally) =>
    rankedBy === "score" ? (averageScore(t) ?? -1) : t.wins / t.games;
  const better = (a: ChampionTally, b: ChampionTally) => {
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff > 0 : a.games > b.games;
  };

  const all = [...tallies.values()];
  const eligible = all.filter((t) => t.games >= CHAMPION_MIN_GAMES);
  const pool =
    eligible.length > 0 ? eligible : [all.reduce((most, t) => (t.games > most.games ? t : most))];
  const winner = pool.reduce((best, t) => (better(t, best) ? t : best));
  return {
    championId: winner.championId,
    games: winner.games,
    wins: winner.wins,
    avgScore: averageScore(winner),
    rankedBy,
  };
}

/**
 * The home page's numbers, from one chronological pass over the player's own
 * games in a queue. Exported on its own, with the rows and the clock passed
 * in, so it can be checked without a database.
 */
export function summarizeHome(rows: CareerRow[], queue: number, now = Date.now()): HomeSummary {
  const last = rows[rows.length - 1];
  const summary: HomeSummary = {
    totalGames: rows.length,
    lastGameAt: last?.game_creation ?? null,
    streak: null,
    recentResults: rows.slice(-RECENT_RESULTS).map((r) => r.win),
    session: null,
    bestChampion: null,
    championWindowDays: CHAMPION_WINDOW_DAYS,
    windowGames: 0,
    recentGames: rows
      .slice(-RECENT_GAMES)
      .reverse()
      .map((r) => ({
        game_id: r.game_id,
        game_creation: r.game_creation,
        game_duration: r.game_duration,
        champion_id: r.champion_id,
        win: r.win,
        kills: r.kills,
        deaths: r.deaths,
        assists: r.assists,
        score: r.score,
        score_badge: r.score_badge,
      })),
  };
  if (!last) return summary;

  // The run the last game leaves us on, and the longest of its kind ever
  let length = 0;
  for (let i = rows.length - 1; i >= 0 && rows[i].win === last.win; i--) length++;
  let best = 0;
  let run = 0;
  for (let i = 0; i < rows.length; i++) {
    run = i > 0 && rows[i].win === rows[i - 1].win ? run + 1 : 1;
    if (rows[i].win === last.win && run > best) best = run;
  }
  summary.streak = { kind: last.win ? "win" : "loss", length, best };

  const day = sessionDay(last.game_creation);
  const played: HomeSessionGame[] = [];
  const session = {
    day,
    games: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    avgScore: null as number | null,
    duration: 0,
    played,
    startedAt: last.game_creation,
    endedAt: last.game_creation + last.game_duration * 1000,
    // A night is not summarised while it is still going on, and the day of
    // play ends at 5am rather than at midnight.
    finished: sessionDay(now) !== day,
    careerAvgScore: null as number | null,
    longerAgoDays: null as number | null,
  };
  let scoreSum = 0;
  let scored = 0;
  for (let i = rows.length - 1; i >= 0 && sessionDay(rows[i].game_creation) === day; i--) {
    const r = rows[i];
    session.games++;
    if (r.win) session.wins++;
    else session.losses++;
    session.kills += r.kills;
    session.deaths += r.deaths;
    session.assists += r.assists;
    session.duration += r.game_duration;
    if (r.score != null) {
      scoreSum += r.score;
      scored++;
    }
    // Oldest first, which is the order the night is read in
    played.unshift({
      gameId: r.game_id,
      championId: r.champion_id,
      win: r.win === 1,
      score: r.score,
      scoreBadge: r.score_badge,
      gameCreation: r.game_creation,
      gameDuration: r.game_duration,
    });
  }
  if (scored > 0) session.avgScore = scoreSum / scored;
  if (played.length > 0) {
    session.startedAt = played[0].gameCreation;
    const end = played[played.length - 1];
    session.endedAt = end.gameCreation + end.gameDuration * 1000;
  }
  session.careerAvgScore = careerAverageScore(rows);
  session.longerAgoDays = daysSinceLongerSession(rows, day, session.games);
  summary.session = session;

  const since = now - CHAMPION_WINDOW_DAYS * DAY_MS;
  const window = rows.filter((r) => r.game_creation >= since);
  summary.windowGames = window.length;
  summary.bestChampion = bestChampion(window, hasScore(queue));

  return summary;
}

export function getHomeSummary(queue?: number): HomeSummary {
  const target = queue ?? selectedQueue();
  return summarizeHome(careerRows(target), target);
}
