import {
  DEFAULT_METRIC,
  availableMetrics,
  metricByKey,
  metricsFor,
  type ExploreRequest,
  type ExploreRow,
  type ExploreTable,
  type GroupKey,
  type MetricKey,
  type QueueData,
} from "../../shared/explore";
import { DURATION_BUCKETS } from "../../shared/trends";
import { db } from "./connection";
import { applyQueueFilter } from "./filters";
import { getAllPuuids } from "./summoner";
import { teammateKey, teammateName } from "./teammates";

/**
 * The one query behind the data explorer: a metric, cut by a grouping.
 *
 * Fourteen metrics and eight groupings is a hundred and twelve tables, so
 * there is one query shape with two holes in it — what to measure per game,
 * and what to group by — rather than a hundred and twelve queries. The holes
 * are filled from the two maps below, and a test checks that every key in the
 * shared catalogue has an entry here, so a metric added to the picker cannot
 * reach a missing expression.
 */

// What one game contributes to the metric. NULL where the game does not carry
// it, which is how a score average over a queue that only sometimes has one
// stays honest: COUNT and SUM both skip nulls.
const METRIC_SQL: Record<MetricKey, string | null> = {
  // A tally of games needs no per-game value.
  games: null,
  // A proportion, read off wins and games rather than a per-game number.
  winRate: null,
  score: "ps.score",
  // Deaths floored at one, the same convention the KDA badge uses, so a
  // deathless game is a ratio instead of a division by zero.
  kda: "(ps.kills + ps.assists) * 1.0 / MAX(ps.deaths, 1)",
  kills: "ps.kills",
  deaths: "ps.deaths",
  damagePerMin: "ps.total_damage_dealt * 60.0 / MAX(g.game_duration, 1)",
  takenPerMin: "ps.total_damage_taken * 60.0 / MAX(g.game_duration, 1)",
  goldPerMin: "ps.gold_earned * 60.0 / MAX(g.game_duration, 1)",
  csPerMin: "ps.cs * 60.0 / MAX(g.game_duration, 1)",
  vision: "ps.vision",
  spree: "ps.largest_killing_spree",
  multikills: "ps.double_kills + ps.triple_kills + ps.quadra_kills + ps.penta_kills",
  duration: "g.game_duration / 60.0",
  // Un 0/1 por partida, escalado a puntos porcentuales: la media es la tasa.
  firstBlood: "ps.first_blood * 100.0",
  // «Participaste en ella»: la hiciste o la asististe. MAX y no suma, para que
  // un payload raro con los dos a uno no produzca un 200%.
  firstBloodPart: "MAX(ps.first_blood, ps.first_blood_assist) * 100.0",
  firstTower: "ps.first_tower * 100.0",
};

/**
 * The game-length buckets as a SQL expression, built from the shared edges.
 *
 * Built rather than written out so the explorer and the trends chart can never
 * disagree about where a bucket starts. Descending, so the first branch that
 * matches is the highest edge the game clears.
 */
function durationCase(): string {
  const branches = [...DURATION_BUCKETS]
    .sort((a, b) => b - a)
    .map((edge) => `WHEN g.game_duration >= ${edge * 60} THEN '${edge}'`);
  return `CASE ${branches.join(" ")} ELSE '${DURATION_BUCKETS[0]}' END`;
}

const localDate = "date(g.game_creation / 1000, 'unixepoch', 'localtime')";

const localTime = (format: string) =>
  `strftime('${format}', g.game_creation / 1000, 'unixepoch', 'localtime')`;

// How the games are cut. Every expression yields text, because the row key
// crosses the bridge as a string whatever it stands for.
const GROUP_SQL: Record<GroupKey, string> = {
  champion: "CAST(ps.champion_id AS TEXT)",
  // Its own query shape — see teammateTable.
  teammate: "",
  patch: "g.game_version",
  // The Monday the game belongs to, as a date, so the key reads, sorts and
  // labels itself. strftime('%W') would number the weeks instead, which turns
  // the new year into week 00 right after week 52.
  week: `date(${localDate}, '-' || ((CAST(${localTime("%w")} AS INTEGER) + 6) % 7) || ' days')`,
  month: localTime("%Y-%m"),
  // 0 = Sunday, as strftime reports it.
  weekday: `CAST(CAST(${localTime("%w")} AS INTEGER) AS TEXT)`,
  hour: `CAST(CAST(${localTime("%H")} AS INTEGER) AS TEXT)`,
  duration: durationCase(),
  queue: "CAST(g.queue_id AS TEXT)",
};

// A grouping that would otherwise produce a bucket for games missing the
// field. An empty patch is not a patch.
const GROUP_FILTER: Partial<Record<GroupKey, string>> = {
  patch: "g.game_version IS NOT NULL AND g.game_version != ''",
};

/** The newest naming of a teammate, for the row label and its link. */
interface TeammateName {
  key: string;
  puuid: string | null;
  game_name: string | null;
  tag_line: string | null;
  participant_id: number;
}

interface Sums {
  games: number;
  wins: number;
  sample: number;
  sum: number;
  sumSq: number;
}

// Population variance from the running sums, floored at zero: rounding can
// take the subtraction a hair below it. The same shape champion-pool uses.
function variance(sums: Sums): number {
  if (sums.sample < 2) return 0;
  return Math.max(0, sums.sumSq / sums.sample - (sums.sum / sums.sample) ** 2);
}

function rowFrom(key: string, sums: Sums, metric: MetricKey): ExploreRow {
  const kind = metricByKey(metric).kind;
  if (kind === "count") {
    return {
      key,
      games: sums.games,
      wins: sums.wins,
      sample: sums.games,
      value: sums.games,
      sd: 0,
    };
  }
  if (kind === "rate") {
    return {
      key,
      games: sums.games,
      wins: sums.wins,
      sample: sums.games,
      value: sums.games > 0 ? (sums.wins / sums.games) * 100 : null,
      sd: 0,
    };
  }
  return {
    key,
    games: sums.games,
    wins: sums.wins,
    sample: sums.sample,
    value: sums.sample > 0 ? sums.sum / sums.sample : null,
    sd: Math.sqrt(variance(sums)),
  };
}

/** The pieces every aggregate selects, whatever it groups by. */
function selectList(metric: MetricKey): string {
  const value = METRIC_SQL[metric];
  if (value == null)
    return "COUNT(*) games, COALESCE(SUM(ps.win), 0) wins, 0 sample, 0 sum, 0 sumSq";
  return `COUNT(*) games, COALESCE(SUM(ps.win), 0) wins,
          COUNT(${value}) sample,
          COALESCE(SUM(${value}), 0) sum,
          COALESCE(SUM((${value}) * (${value})), 0) sumSq`;
}

/** What the stored games admitted by this filter can answer. */
function queueData(where: string[], params: any[]): QueueData {
  const row = db
    .prepare(`
      SELECT COUNT(ps.score) scored, COALESCE(SUM(ps.cs), 0) cs, COALESCE(SUM(ps.wards), 0) wards,
             COALESCE(SUM(ps.first_blood + ps.first_blood_assist + ps.first_tower), 0) firsts
      FROM games g JOIN player_stats ps ON ps.game_id = g.game_id
      WHERE ${where.join(" AND ")}
    `)
    .get(...params) as { scored: number; cs: number; wards: number; firsts: number };
  return {
    score: row.scored > 0,
    cs: row.cs > 0,
    wards: row.wards > 0,
    firsts: row.firsts > 0,
  };
}

/**
 * Your own record over every game the filter admits.
 *
 * Always read off games and player_stats, never off the grouped query, because
 * the teammate join sees one game up to four times. It is the row every other
 * row is compared against, so counting a game twice there would quietly move
 * the baseline.
 */
function overallRow(metric: MetricKey, where: string[], params: any[]): ExploreRow {
  const sums = db
    .prepare(`
      SELECT ${selectList(metric)}
      FROM games g JOIN player_stats ps ON ps.game_id = g.game_id
      WHERE ${where.join(" AND ")}
    `)
    .get(...params) as Sums;
  return rowFrom("", sums, metric);
}

function groupedRows(
  group: GroupKey,
  metric: MetricKey,
  where: string[],
  params: any[],
): (Sums & { key: string; name?: TeammateName })[] {
  return db
    .prepare(`
      SELECT ${GROUP_SQL[group]} AS key, ${selectList(metric)}
      FROM games g JOIN player_stats ps ON ps.game_id = g.game_id
      WHERE ${where.join(" AND ")}
      GROUP BY key
    `)
    .all(...params) as (Sums & { key: string })[];
}

/**
 * The teammate grouping, which needs a different shape.
 *
 * One row per game per player who shared a team with one of our accounts, so
 * the metric stays *our* number in that game and the grouping answers "how do
 * my games go when this player is on my side". The CTE resolving which (game,
 * team) pairs are ours is lifted from the Friends query, for the reason given
 * there: as an EXISTS it builds a throwaway index on every call.
 */
function teammateRows(
  metric: MetricKey,
  where: string[],
  params: any[],
): (Sums & { key: string; name?: TeammateName })[] {
  const puuids = getAllPuuids();
  if (puuids.length === 0) return [];
  const ours = puuids.map(() => "?").join(", ");
  const key = `COALESCE(NULLIF(o.puuid, ''), o.game_name, 'p' || o.participant_id)`;
  const from = `
      FROM our_teams t
      JOIN match_participants o ON o.game_id = t.game_id AND o.team_id = t.team_id
      JOIN games g ON g.game_id = o.game_id
      JOIN player_stats ps ON ps.game_id = o.game_id
      WHERE ${where.join(" AND ")} AND (o.puuid IS NULL OR o.puuid NOT IN (${ours}))`;
  const cte = `
      WITH our_teams AS (
        SELECT DISTINCT game_id, team_id FROM match_participants WHERE puuid IN (${ours})
      )`;

  const rows = db
    .prepare(`${cte} SELECT ${key} AS key, ${selectList(metric)} ${from} GROUP BY key`)
    .all(...puuids, ...params, ...puuids) as (Sums & { key: string })[];

  // The name in its own pass, newest game first, because a player who renamed
  // should appear under the name they have now. MAX() over the group would
  // hand back the alphabetically largest one instead, which is how an earlier
  // version of this listed a teammate under the name they dropped in September.
  const named = db
    .prepare(`
      ${cte}
      SELECT ${key} AS key, o.puuid, o.game_name, o.tag_line, o.participant_id
      ${from}
      ORDER BY g.game_creation DESC
    `)
    .all(...puuids, ...params, ...puuids) as TeammateName[];
  const latest = new Map<string, (typeof named)[number]>();
  for (const row of named) if (!latest.has(row.key)) latest.set(row.key, row);

  return rows.map((row) => ({ ...row, name: latest.get(row.key) }));
}

export function getExploreTable(request: ExploreRequest): ExploreTable {
  const group = request.group;
  const where = ["g.is_remake = 0"];
  const params: any[] = [];
  // Grouping by queue is the one view that spans them, so it is also the one
  // place the app's queue selector does not apply.
  if (group !== "queue") applyQueueFilter(where, params, request.queue);

  const available = availableMetrics(queueData(where, params));
  // A queue that cannot answer the metric the page asked for gets the default
  // one back, and the page follows the answer rather than its own selector:
  // switching from ARAM Caos to ARAM leaves "score" selected with nothing
  // behind it.
  const offered = metricsFor(group, available);
  const metric = offered.includes(request.metric) ? request.metric : DEFAULT_METRIC;

  const filter = GROUP_FILTER[group];
  if (filter) where.push(filter);

  const overall = overallRow(metric, where, params);

  const raw =
    group === "teammate"
      ? teammateRows(metric, where, params)
      : groupedRows(group, metric, where, params);

  const minGames = Math.max(1, request.minGames);
  const rows: ExploreRow[] = [];
  let hidden = 0;
  for (const entry of raw) {
    if (entry.games < minGames) {
      hidden++;
      continue;
    }
    const row = rowFrom(entry.key, entry, metric);
    const named = entry.name;
    if (named) {
      const name = teammateName(named.game_name, named.tag_line, named.participant_id);
      row.key = teammateKey(named.puuid, name);
      row.label = name;
    }
    rows.push(row);
  }

  return { metric, group, rows, overall, available: offered, hidden };
}
