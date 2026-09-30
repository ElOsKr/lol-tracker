import type {
  ItemUsage,
  ChampionStats,
  AugmentStats,
  DashboardData,
  AugmentStatsDetailedResult,
  ItemStats,
  GlobalStats,
  GlobalChampionDetail,
  TrendsData,
} from "../../shared/api";
import { DURATION_BUCKETS, durationBucket } from "../../shared/trends";
import { db } from "./connection";
import { applyQueueFilter } from "./filters";

// Poro-Snax (base and upgraded) is handed out for free, so it skews item stats
const EXCLUDED_ITEM_IDS = [2052, 220013];

const EXCLUDED_ITEMS_SQL = EXCLUDED_ITEM_IDS.join(", ");

// item0..item6 on both player_stats and match_participants; slot 6 is the trinket
const ITEM_SLOTS = [0, 1, 2, 3, 4, 5, 6];

export function getChampionStatsAll(patch?: string, queue?: number): ChampionStats[] {
  const where = ["g.is_remake = 0"];
  const params: any[] = [];
  if (patch) {
    where.push("g.game_version = ?");
    params.push(patch);
  }
  applyQueueFilter(where, params, queue);
  return db
    .prepare(`
    SELECT
      ps.champion_id,
      COUNT(*) as games,
      SUM(ps.win) as wins,
      SUM(ps.kills) as kills,
      SUM(ps.deaths) as deaths,
      SUM(ps.assists) as assists,
      ROUND(AVG(ps.kills), 1) as avg_kills,
      ROUND(AVG(ps.deaths), 1) as avg_deaths,
      ROUND(AVG(ps.assists), 1) as avg_assists,
      ROUND(AVG(ps.total_damage_dealt)) as avg_damage,
      ROUND(AVG(ps.gold_earned)) as avg_gold,
      ROUND(AVG(ps.score), 1) as avg_score,
      SUM(CASE WHEN ps.score_badge = 'MVP' THEN 1 ELSE 0 END) as mvps,
      SUM(CASE WHEN ps.score_badge = 'ACE' THEN 1 ELSE 0 END) as aces,
      SUM(ps.double_kills) as double_kills,
      SUM(ps.triple_kills) as triple_kills,
      SUM(ps.quadra_kills) as quadra_kills,
      SUM(ps.penta_kills) as penta_kills
    FROM player_stats ps
    JOIN games g ON ps.game_id = g.game_id
    WHERE ${where.join(" AND ")}
    GROUP BY ps.champion_id
    ORDER BY games DESC
  `)
    .all(...params) as ChampionStats[];
}

export function getAugmentStatsAll(
  championId?: number,
  patch?: string,
  queue?: number,
): AugmentStats[] {
  const where = ["g.is_remake = 0"];
  const params: any[] = [];
  if (championId !== undefined) {
    where.push("ps.champion_id = ?");
    params.push(championId);
  }
  if (patch) {
    where.push("g.game_version = ?");
    params.push(patch);
  }
  applyQueueFilter(where, params, queue);
  return db
    .prepare(`
    SELECT ga.augment_id, COUNT(*) as picks, SUM(ps.win) as wins
    FROM game_augments ga
    JOIN player_stats ps ON ga.game_id = ps.game_id
    JOIN games g ON ga.game_id = g.game_id
    WHERE ${where.join(" AND ")}
    GROUP BY ga.augment_id
    ORDER BY picks DESC
  `)
    .all(...params) as AugmentStats[];
}

export function getDashboardData(filters?: {
  championId?: number;
  patch?: string;
  queue?: number;
  account?: string;
}): DashboardData {
  const where: string[] = ["g.is_remake = 0"];
  const params: any[] = [];
  if (filters?.championId != null) {
    where.push("ps.champion_id = ?");
    params.push(filters.championId);
  }
  if (filters?.account) {
    where.push("g.puuid = ?");
    params.push(filters.account);
  }
  if (filters?.patch) {
    where.push("g.game_version = ?");
    params.push(filters.patch);
  }
  applyQueueFilter(where, params, filters?.queue);
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const totals = db
    .prepare(`
    SELECT COUNT(*) as totalGames,
           SUM(g.game_duration) as totalDuration,
           SUM(ps.win) as wins,
           SUM(ps.kills) as totalKills,
           SUM(ps.deaths) as totalDeaths,
           SUM(ps.assists) as totalAssists,
           SUM(ps.double_kills) as doubles,
           SUM(ps.triple_kills) as triples,
           SUM(ps.quadra_kills) as quadras,
           SUM(ps.penta_kills) as pentas,
           AVG(ps.score) as avgScore,
           SUM(CASE WHEN ps.score_badge = 'MVP' THEN 1 ELSE 0 END) as mvps,
           SUM(CASE WHEN ps.score_badge = 'ACE' THEN 1 ELSE 0 END) as aces,
           SUM(CASE WHEN ps.score IS NOT NULL AND ps.win = 1 THEN 1 ELSE 0 END) as scoredWins,
           SUM(CASE WHEN ps.score IS NOT NULL AND ps.win = 0 THEN 1 ELSE 0 END) as scoredLosses,
           -- Every total here pools all tracked accounts; games whose owner was
           -- never resolved carry an empty puuid and aren't an account
           COUNT(DISTINCT NULLIF(g.puuid, '')) as accounts
    FROM player_stats ps
    JOIN games g ON ps.game_id = g.game_id
    ${whereSql}
  `)
    .get(...params) as any;

  const recentForm = db
    .prepare(`
    SELECT ps.win, g.game_id
    FROM games g
    JOIN player_stats ps ON g.game_id = ps.game_id
    ${whereSql}
    ORDER BY g.game_creation DESC
    LIMIT 10
  `)
    .all(...params) as DashboardData["recentForm"];

  return {
    totalGames: totals.totalGames ?? 0,
    totalDuration: totals.totalDuration ?? 0,
    wins: totals.wins ?? 0,
    totalKills: totals.totalKills ?? 0,
    totalDeaths: totals.totalDeaths ?? 0,
    totalAssists: totals.totalAssists ?? 0,
    avgScore: totals.avgScore ?? null,
    mvps: totals.mvps ?? 0,
    aces: totals.aces ?? 0,
    scoredWins: totals.scoredWins ?? 0,
    scoredLosses: totals.scoredLosses ?? 0,
    accounts: totals.accounts ?? 0,
    recentForm,
    multikills: {
      doubles: totals.doubles ?? 0,
      triples: totals.triples ?? 0,
      quadras: totals.quadras ?? 0,
      pentas: totals.pentas ?? 0,
    },
  };
}

export function getAugmentStatsWithChampions(
  patch?: string,
  queue?: number,
): AugmentStatsDetailedResult {
  const where = ["g.is_remake = 0"];
  const params: any[] = [];
  if (patch) {
    where.push("g.game_version = ?");
    params.push(patch);
  }
  applyQueueFilter(where, params, queue);
  const augments = db
    .prepare(`
    SELECT ga.augment_id, COUNT(*) as picks, SUM(ps.win) as wins
    FROM game_augments ga
    JOIN player_stats ps ON ga.game_id = ps.game_id
    JOIN games g ON ga.game_id = g.game_id
    WHERE ${where.join(" AND ")}
    GROUP BY ga.augment_id
    ORDER BY picks DESC
  `)
    .all(...params) as { augment_id: number; picks: number; wins: number }[];

  const champBreakdown = db
    .prepare(`
    SELECT ga.augment_id, ps.champion_id, COUNT(*) as picks, SUM(ps.win) as wins
    FROM game_augments ga
    JOIN player_stats ps ON ga.game_id = ps.game_id
    JOIN games g ON ga.game_id = g.game_id
    WHERE ${where.join(" AND ")}
    GROUP BY ga.augment_id, ps.champion_id
    ORDER BY picks DESC
  `)
    .all(...params) as { augment_id: number; champion_id: number; picks: number; wins: number }[];

  const champMap = new Map<number, { champion_id: number; picks: number; wins: number }[]>();
  for (const row of champBreakdown) {
    if (!champMap.has(row.augment_id)) champMap.set(row.augment_id, []);
    champMap
      .get(row.augment_id)!
      .push({ champion_id: row.champion_id, picks: row.picks, wins: row.wins });
  }

  // Counted here rather than derived from the augment rows. Picks are slots,
  // not games: a game carries up to AUGMENT_SLOTS of them and often fewer, so
  // dividing picks by the slot count lands on neither number and disagrees
  // with what the Champions tab sums for the same filters.
  const { totalGames } = db
    .prepare(`
    SELECT COUNT(*) as totalGames
    FROM player_stats ps
    JOIN games g ON ps.game_id = g.game_id
    WHERE ${where.join(" AND ")}
  `)
    .get(...params) as { totalGames: number };

  return {
    totalGames,
    augments: augments.map((a) => ({
      ...a,
      champions: champMap.get(a.augment_id) ?? [],
    })),
  };
}

export function getChampionItemStats(
  championId: number,
  patch?: string,
  queue?: number,
): ItemStats[] {
  const extraWhere: string[] = [];
  const extraParams: any[] = [];
  if (patch) {
    extraWhere.push("g.game_version = ?");
    extraParams.push(patch);
  }
  applyQueueFilter(extraWhere, extraParams, queue);
  const extraSql = extraWhere.length > 0 ? ` AND ${extraWhere.join(" AND ")}` : "";
  const params = ITEM_SLOTS.flatMap(() => [championId, ...extraParams]);
  return db
    .prepare(`
    SELECT item_id, COUNT(*) as picks, SUM(win) as wins
    FROM (
        ${itemSlotUnion(
          (i) => `SELECT ps.item${i} as item_id, ps.win
                FROM player_stats ps JOIN games g ON ps.game_id = g.game_id
                WHERE ps.champion_id = ? AND g.is_remake = 0${extraSql}
                  AND ps.item${i} > 0 AND ps.item${i} NOT IN (${EXCLUDED_ITEMS_SQL})`,
        )}
    )
    GROUP BY item_id
    ORDER BY picks DESC
  `)
    .all(...params) as ItemStats[];
}

// The seven item slots are columns, and every item stat wants them as rows.
// `row` builds one slot's SELECT; the caller's params repeat once per slot.
function itemSlotUnion(row: (slot: number) => string): string {
  return ITEM_SLOTS.map(row).join("\n        UNION ALL\n        ");
}

// Filters for a query over match_participants. is_remake, queue_id and
// game_version are carried on the participant rows themselves, so nothing here
// has to join back to games.
function participantFilter(patch?: string, queue?: number, alias = "mp") {
  const where = [`${alias}.is_remake = 0`];
  const params: any[] = [];
  if (patch) {
    where.push(`${alias}.game_version = ?`);
    params.push(patch);
  }
  applyQueueFilter(where, params, queue, alias);
  return { where, params, sql: where.join(" AND ") };
}

// Our own games per champion under the same filters, so the global table can
// say how many of a champion's appearances were ours.
function ownGamesByChampion(patch?: string, queue?: number): Map<number, number> {
  const own = ownGamesFilter(patch, queue);
  const rows = db
    .prepare(`
      SELECT ps.champion_id, COUNT(*) as games
      FROM player_stats ps
      JOIN games g ON g.game_id = ps.game_id
      WHERE ${own.sql}
      GROUP BY ps.champion_id
    `)
    .all(...own.params) as { champion_id: number; games: number }[];
  return new Map(rows.map((r) => [r.champion_id, r.games]));
}

// The WHERE clause and params for our own games under the page's filters,
// shared by the three own-count queries below.
function ownGamesFilter(patch?: string, queue?: number): { sql: string; params: any[] } {
  const where = ["g.is_remake = 0"];
  const params: any[] = [];
  if (patch) {
    where.push("g.game_version = ?");
    params.push(patch);
  }
  applyQueueFilter(where, params, queue);
  return { sql: where.join(" AND "), params };
}

// Our own augment picks, from game_augments (only ever our picks)
function ownAugmentPicks(patch?: string, queue?: number): Map<number, number> {
  const own = ownGamesFilter(patch, queue);
  const rows = db
    .prepare(`
      SELECT ga.augment_id, COUNT(*) as picks
      FROM game_augments ga
      JOIN games g ON g.game_id = ga.game_id
      WHERE ${own.sql}
      GROUP BY ga.augment_id
    `)
    .all(...own.params) as { augment_id: number; picks: number }[];
  return new Map(rows.map((r) => [r.augment_id, r.picks]));
}

/**
 * Every item the player has finished a game holding, with how it went.
 *
 * One query for the whole catalogue rather than one per item: the items page
 * shows the count beside every row, and asking eight hundred times would be
 * eight hundred round trips for a table that is cheap to build in one pass.
 */
export function getItemUsage(queue?: number): ItemUsage[] {
  const own = ownGamesFilter(undefined, queue);
  return db
    .prepare(`
      SELECT item_id, COUNT(*) as games, SUM(win) as wins
      FROM (
        ${itemSlotUnion(
          (i) => `SELECT ps.item${i} as item_id, ps.win
                FROM player_stats ps JOIN games g ON ps.game_id = g.game_id
                WHERE ${own.sql}
                  AND ps.item${i} > 0 AND ps.item${i} NOT IN (${EXCLUDED_ITEMS_SQL})`,
        )}
      )
      GROUP BY item_id
      ORDER BY games DESC
    `)
    .all(...ITEM_SLOTS.flatMap(() => own.params)) as ItemUsage[];
}

// Our own item picks, from player_stats (only ever our row), same slot rules as
// the global item table
function ownItemPicks(patch?: string, queue?: number): Map<number, number> {
  const own = ownGamesFilter(patch, queue);
  const rows = db
    .prepare(`
      SELECT item_id, COUNT(*) as picks
      FROM (
        ${itemSlotUnion(
          (i) => `SELECT ps.item${i} as item_id
                FROM player_stats ps JOIN games g ON ps.game_id = g.game_id
                WHERE ${own.sql}
                  AND ps.item${i} > 0 AND ps.item${i} NOT IN (${EXCLUDED_ITEMS_SQL})`,
        )}
      )
      GROUP BY item_id
    `)
    .all(...ITEM_SLOTS.flatMap(() => own.params)) as { item_id: number; picks: number }[];
  return new Map(rows.map((r) => [r.item_id, r.picks]));
}

// How many stored games the participant rows under a filter come from. Not
// slots / 10: Arena games seat sixteen.
function distinctGames(mp: { sql: string; params: any[] }): number {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT mp.game_id) as count FROM match_participants mp WHERE ${mp.sql}`,
    )
    .get(...mp.params) as { count: number };
  return row.count;
}

export function getGlobalStats(patch?: string, queue?: number): GlobalStats {
  const mp = participantFilter(patch, queue);
  const mpa = participantFilter(patch, queue, "mpa");
  const own = ownGamesByChampion(patch, queue);

  const champions = db
    .prepare(`
      SELECT mp.champion_id, COUNT(*) as games, SUM(mp.win) as wins
      FROM match_participants mp
      WHERE ${mp.sql} AND mp.champion_id > 0
      GROUP BY mp.champion_id
      ORDER BY games DESC
    `)
    .all(...mp.params) as { champion_id: number; games: number; wins: number }[];
  const championsWithOwn = champions.map((c) => ({
    ...c,
    ownGames: own.get(c.champion_id) ?? 0,
  }));

  const augments = db
    .prepare(`
      SELECT mpa.augment_id, COUNT(*) as picks, SUM(mpa.win) as wins
      FROM match_participant_augments mpa
      WHERE ${mpa.sql}
      GROUP BY mpa.augment_id
      ORDER BY picks DESC
    `)
    .all(...mpa.params) as { augment_id: number; picks: number; wins: number }[];

  const items = db
    .prepare(`
      SELECT item_id, COUNT(*) as picks, SUM(win) as wins
      FROM (
        ${itemSlotUnion(
          (i) => `SELECT mp.item${i} as item_id, mp.win as win
                FROM match_participants mp
                WHERE ${mp.sql}
                  AND mp.item${i} > 0 AND mp.item${i} NOT IN (${EXCLUDED_ITEMS_SQL})`,
        )}
      )
      GROUP BY item_id
      ORDER BY picks DESC
    `)
    .all(...ITEM_SLOTS.flatMap(() => mp.params)) as {
    item_id: number;
    picks: number;
    wins: number;
  }[];

  const slots = db
    .prepare(`
      SELECT COUNT(*) as count
      FROM match_participants mp
      WHERE ${mp.sql} AND mp.champion_id > 0
    `)
    .get(...mp.params) as { count: number };

  const ownAugments = ownAugmentPicks(patch, queue);
  const ownItems = ownItemPicks(patch, queue);
  return {
    champions: championsWithOwn,
    augments: augments.map((a) => ({ ...a, ownPicks: ownAugments.get(a.augment_id) ?? 0 })),
    items: items.map((it) => ({ ...it, ownPicks: ownItems.get(it.item_id) ?? 0 })),
    totalParticipantSlots: slots.count,
    totalGames: distinctGames(mp),
  };
}

// Everything we know about one champion across every stored game, counting all
// ten players in each game (not just our own). Items and augments come from the
// participant tables for the same reason — the player_stats/game_augments
// tables only hold our own picks.
export function getGlobalChampionDetail(
  championId: number,
  patch?: string,
  queue?: number,
): GlobalChampionDetail {
  const mp = participantFilter(patch, queue);
  const mpa = participantFilter(patch, queue, "mpa");

  // Shares are per-game ratios averaged over the games they're defined in, so
  // a game with no team damage/kills recorded can't drag the average to zero —
  // which is what AVG over a NULLable expression does.
  const totals = db
    .prepare(`
      WITH teams AS (
        SELECT mp.game_id, mp.team_id,
               SUM(mp.total_damage_dealt) as team_damage,
               SUM(mp.kills) as team_kills
        FROM match_participants mp
        WHERE ${mp.sql}
        GROUP BY mp.game_id, mp.team_id
      )
      SELECT COUNT(*) as games,
             SUM(mp.win) as wins,
             SUM(mp.kills) as kills,
             SUM(mp.deaths) as deaths,
             SUM(mp.assists) as assists,
             SUM(mp.total_damage_dealt) as damage,
             SUM(mp.total_damage_taken) as damageTaken,
             SUM(mp.gold_earned) as gold,
             SUM(mp.total_heal) as heal,
             SUM(mp.double_kills) as doubleKills,
             SUM(mp.triple_kills) as tripleKills,
             SUM(mp.quadra_kills) as quadraKills,
             SUM(mp.penta_kills) as pentaKills,
             AVG(CASE WHEN t.team_damage > 0
                      THEN mp.total_damage_dealt * 1.0 / t.team_damage END) as damageShare,
             AVG(CASE WHEN t.team_kills > 0
                      THEN (mp.kills + mp.assists) * 1.0 / t.team_kills END) as killParticipation
      FROM match_participants mp
      JOIN teams t ON t.game_id = mp.game_id AND t.team_id = mp.team_id
      WHERE ${mp.sql} AND mp.champion_id = ?
    `)
    .get(...mp.params, ...mp.params, championId) as any;

  const slots = db
    .prepare(`
      SELECT COUNT(*) as count
      FROM match_participants mp
      WHERE ${mp.sql} AND mp.champion_id > 0
    `)
    .get(...mp.params) as { count: number };

  const items = db
    .prepare(`
      SELECT item_id, COUNT(*) as picks, SUM(win) as wins
      FROM (
        ${itemSlotUnion(
          (i) => `SELECT mp.item${i} as item_id, mp.win as win
                FROM match_participants mp
                WHERE ${mp.sql} AND mp.champion_id = ?
                  AND mp.item${i} > 0 AND mp.item${i} NOT IN (${EXCLUDED_ITEMS_SQL})`,
        )}
      )
      GROUP BY item_id
      ORDER BY picks DESC
    `)
    .all(...ITEM_SLOTS.flatMap(() => [...mp.params, championId])) as {
    item_id: number;
    picks: number;
    wins: number;
  }[];

  const augments = db
    .prepare(`
      SELECT mpa.augment_id, COUNT(*) as picks, SUM(mpa.win) as wins
      FROM match_participant_augments mpa
      WHERE ${mpa.sql} AND mpa.champion_id = ?
      GROUP BY mpa.augment_id
      ORDER BY picks DESC
    `)
    .all(...mpa.params, championId) as {
    augment_id: number;
    picks: number;
    wins: number;
  }[];

  const games = totals?.games ?? 0;
  const avg = (total: number | null) => (games > 0 ? Math.round((total ?? 0) / games) : 0);

  return {
    champion_id: championId,
    games,
    ownGames: ownGamesByChampion(patch, queue).get(championId) ?? 0,
    wins: totals?.wins ?? 0,
    kills: totals?.kills ?? 0,
    deaths: totals?.deaths ?? 0,
    assists: totals?.assists ?? 0,
    avgDamage: avg(totals?.damage),
    avgDamageTaken: avg(totals?.damageTaken),
    avgGold: avg(totals?.gold),
    avgHeal: avg(totals?.heal),
    damageShare: totals?.damageShare ?? 0,
    killParticipation: totals?.killParticipation ?? 0,
    doubleKills: totals?.doubleKills ?? 0,
    tripleKills: totals?.tripleKills ?? 0,
    quadraKills: totals?.quadraKills ?? 0,
    pentaKills: totals?.pentaKills ?? 0,
    totalParticipantSlots: slots.count,
    totalGames: distinctGames(mp),
    items,
    augments,
  };
}

// Everything the Trends page draws, in one round trip. Days are the finest
// grain the page uses, so the renderer re-buckets them into weeks or months
// itself instead of asking again; patches and clock buckets can't be derived
// from days and come as their own aggregates. All local time — "games per day"
// means the player's day, not UTC's.
export function getTrendsData(queue?: number): TrendsData {
  const where = ["g.is_remake = 0"];
  const params: any[] = [];
  applyQueueFilter(where, params, queue);
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const fromSql = `FROM games g JOIN player_stats ps ON g.game_id = ps.game_id`;

  // SUM/COUNT over ps.score skip NULLs, so score averages stay honest for
  // days where only some games have a stored score.
  const daily = db
    .prepare(`
      SELECT date(g.game_creation / 1000, 'unixepoch', 'localtime') as day,
             COUNT(*) as games,
             SUM(ps.win) as wins,
             SUM(ps.kills) as kills,
             SUM(ps.deaths) as deaths,
             SUM(ps.assists) as assists,
             SUM(ps.score) as score_sum,
             COUNT(ps.score) as scored_games
      ${fromSql}
      ${whereSql}
      GROUP BY day
      ORDER BY day
    `)
    .all(...params) as TrendsData["daily"];

  // Ordered by when the patch was first played rather than by parsing version
  // strings — chronological is what a trend axis wants anyway.
  const patches = db
    .prepare(`
      SELECT g.game_version as patch,
             COUNT(*) as games,
             SUM(ps.win) as wins,
             AVG(ps.score) as avg_score,
             MIN(g.game_creation) as first_played
      ${fromSql}
      ${whereSql} AND g.game_version IS NOT NULL AND g.game_version != ''
      GROUP BY g.game_version
      ORDER BY first_played
    `)
    .all(...params) as TrendsData["patches"];

  const hours = db
    .prepare(`
      SELECT CAST(strftime('%H', g.game_creation / 1000, 'unixepoch', 'localtime') AS INTEGER) as hour,
             COUNT(*) as games,
             SUM(ps.win) as wins
      ${fromSql}
      ${whereSql}
      GROUP BY hour
      ORDER BY hour
    `)
    .all(...params) as TrendsData["hours"];

  // strftime('%w'): 0 = Sunday
  const weekdays = db
    .prepare(`
      SELECT CAST(strftime('%w', g.game_creation / 1000, 'unixepoch', 'localtime') AS INTEGER) as weekday,
             COUNT(*) as games,
             SUM(ps.win) as wins
      ${fromSql}
      ${whereSql}
      GROUP BY weekday
      ORDER BY weekday
    `)
    .all(...params) as TrendsData["weekdays"];

  // Bucketed here rather than in SQL: the edges live in shared/trends.ts so
  // the query and the chart cannot drift apart, and a CASE expression built
  // from them would be harder to read than the loop.
  const durationRows = db
    .prepare(`
      SELECT g.game_duration as duration, ps.win as win, ps.score as score
      ${fromSql}
      ${whereSql}
    `)
    .all(...params) as { duration: number; win: number; score: number | null }[];

  const buckets = new Map<number, { games: number; wins: number; sum: number; scored: number }>();
  for (const edge of DURATION_BUCKETS) {
    buckets.set(edge, { games: 0, wins: 0, sum: 0, scored: 0 });
  }
  for (const row of durationRows) {
    const bucket = buckets.get(durationBucket(row.duration))!;
    bucket.games++;
    bucket.wins += row.win;
    if (row.score != null) {
      bucket.sum += row.score;
      bucket.scored++;
    }
  }
  const durations = [...buckets.entries()]
    .filter(([, b]) => b.games > 0)
    .map(([from, b]) => ({
      from,
      games: b.games,
      wins: b.wins,
      avgScore: b.scored > 0 ? b.sum / b.scored : null,
    }));

  return { daily, patches, hours, weekdays, durations };
}
