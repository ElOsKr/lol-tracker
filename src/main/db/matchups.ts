import type { YourMatchup } from "../../shared/api";
import { winRateGapCarries } from "../../shared/champion-pool";
import { db } from "./connection";
import { applyQueueFilter } from "./filters";
import { getAllPuuids } from "./summoner";

/**
 * How your own games have gone around a champion: with it, beside it, against it.
 *
 * The live scoreboard already shows what this app knows about the *players* in
 * the lobby, which in a random queue is a dash on nine rows out of ten. This
 * is the other half, and it is never empty: whoever is holding it, you have
 * faced that champion before, and across the stored ARAM games the median
 * champion has been on the other side twenty-one times.
 */

export interface MatchupSide {
  games: number;
  wins: number;
}

export interface ChampionSides {
  /** Games you played it yourself. */
  self: MatchupSide;
  /** Games someone else on your team had it. */
  ally: MatchupSide;
  /** Games it stood on the other side. */
  enemy: MatchupSide;
}

export interface ChampionMatchups {
  /** Your record over the same games, as the baseline each side is read against. */
  overall: MatchupSide;
  byChampion: Record<number, ChampionSides>;
}

function empty(): ChampionSides {
  return { self: { games: 0, wins: 0 }, ally: { games: 0, wins: 0 }, enemy: { games: 0, wins: 0 } };
}

/**
 * Your record around each of the given champions, in one query.
 *
 * `mine` is one row per stored game: the row belonging to one of our accounts,
 * and the lowest participant id among them on the vanishing chance that two of
 * our accounts played the same game — without that the game would be counted
 * twice on every side.
 */
export function getChampionMatchups(championIds: number[], queue?: number): ChampionMatchups {
  const result: ChampionMatchups = { overall: { games: 0, wins: 0 }, byChampion: {} };
  const wanted = [...new Set(championIds.filter((id) => id > 0))];
  const puuids = getAllPuuids();
  if (wanted.length === 0 || puuids.length === 0) return result;

  const ours = puuids.map(() => "?").join(", ");
  const where = ["g.is_remake = 0"];
  const params: any[] = [];
  applyQueueFilter(where, params, queue, "g");

  const mine = `
    WITH mine AS (
      SELECT mp.game_id, mp.participant_id, mp.team_id, mp.win
      FROM match_participants mp
      JOIN games g ON g.game_id = mp.game_id
      WHERE mp.puuid IN (${ours})
        AND ${where.join(" AND ")}
        AND mp.participant_id = (
          SELECT MIN(m2.participant_id) FROM match_participants m2
          WHERE m2.game_id = mp.game_id AND m2.puuid IN (${ours})
        )
    )`;

  const overall = db
    .prepare(`${mine} SELECT COUNT(*) games, COALESCE(SUM(win), 0) wins FROM mine`)
    .get(...puuids, ...params, ...puuids) as MatchupSide;
  result.overall = overall;
  if (overall.games === 0) return result;

  const slots = wanted.map(() => "?").join(", ");
  const rows = db
    .prepare(`
      ${mine}
      SELECT o.champion_id AS champion,
             CASE
               WHEN o.participant_id = mine.participant_id THEN 'self'
               WHEN o.team_id = mine.team_id THEN 'ally'
               ELSE 'enemy'
             END AS side,
             COUNT(*) games,
             COALESCE(SUM(mine.win), 0) wins
      FROM mine
      JOIN match_participants o ON o.game_id = mine.game_id
      WHERE o.champion_id IN (${slots})
      GROUP BY champion, side
    `)
    .all(...puuids, ...params, ...puuids, ...wanted) as {
    champion: number;
    side: keyof ChampionSides;
    games: number;
    wins: number;
  }[];

  for (const id of wanted) result.byChampion[id] = empty();
  for (const row of rows) {
    const sides = result.byChampion[row.champion];
    if (sides) sides[row.side] = { games: row.games, wins: row.wins };
  }
  return result;
}

/**
 * One row of the live scoreboard, from the three sides and your baseline.
 *
 * Null where there is nothing to say: a champion you have never had in a
 * stored game of this queue, which after a thousand games is a short list.
 * The rule that decides whether the number gets a colour is the shared one,
 * so this column, the champion verdicts and the data explorer all agree about
 * what counts as a difference.
 */
export function yourMatchup(
  sides: ChampionSides | undefined,
  overall: MatchupSide,
  side: YourMatchup["side"],
): YourMatchup | null {
  if (!sides || overall.games === 0) return null;
  const record = sides[side];
  if (record.games === 0) return null;
  const rate = (record.wins / record.games) * 100;
  const base = (overall.wins / overall.games) * 100;
  return {
    side,
    games: record.games,
    wins: record.wins,
    gap: rate - base,
    carries: winRateGapCarries(record, overall),
  };
}
