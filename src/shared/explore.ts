/**
 * The data explorer: what can be measured, and how the games may be cut.
 *
 * Two catalogues and one rule. The catalogues are here rather than in the
 * query so the page can draw its own selectors without knowing any SQL, and so
 * a metric cannot exist for the picker but not for the query — a test pairs
 * this list against the expression map in src/main/db/explore.ts.
 *
 * The rule is the part that makes the page worth having. Any pair of choices
 * produces a table, and most of those tables are noise: 121 champions sorted
 * by win rate over six games each says nothing at all. So every row carries
 * the sample it was measured on, and `gapCarries` answers whether its distance
 * from your own overall figure survives that sample.
 */

import { MIN_POOL_GAMES } from "./champion-pool";
import { NOISE_MULTIPLE } from "./skill-axes";

export const EXPLORE_PATH = "/explore";

export type MetricKey =
  | "games"
  | "winRate"
  | "score"
  | "kda"
  | "kills"
  | "deaths"
  | "damagePerMin"
  | "takenPerMin"
  | "goldPerMin"
  | "csPerMin"
  | "vision"
  | "spree"
  | "multikills"
  | "duration";

export type GroupKey =
  | "champion"
  | "teammate"
  | "patch"
  | "month"
  | "weekday"
  | "hour"
  | "duration"
  | "queue";

/**
 * How a metric is computed, which is also how its noise is measured.
 *
 * `count` is a tally with nothing to compare it against; `rate` is a
 * proportion of games, whose spread follows from the proportion itself; `mean`
 * is an average over games, whose spread has to be measured.
 */
export type MetricKind = "count" | "rate" | "mean";

export type MetricUnit = "none" | "percent" | "perMinute" | "minutes";

/** A column the queue has to actually carry before the metric is offered. */
export type MetricNeeds = "score" | "cs" | "wards";

export interface Metric {
  key: MetricKey;
  kind: MetricKind;
  unit: MetricUnit;
  decimals: number;
  /** null where more is neither better nor worse: damage taken, game length. */
  higherIsBetter: boolean | null;
  needs?: MetricNeeds;
  /**
   * How far a row has to sit from your overall figure before it is worth
   * marking at all, on top of clearing the noise. In the metric's own units
   * where there is a natural threshold, and otherwise as a fraction of the
   * overall value, because a damage-per-minute gap of 8 means nothing without
   * knowing whether the average is 600 or 60.
   */
  floor: { points: number } | { fraction: number };
}

// Win rate and score keep the absolute floors the champion verdicts already
// use — 8 points of win rate, 0.3 of score — so the same gap counts as
// meaningful in both places. Everything else is relative to its own average.
export const METRICS: readonly Metric[] = [
  {
    key: "games",
    kind: "count",
    unit: "none",
    decimals: 0,
    higherIsBetter: null,
    floor: { points: 0 },
  },
  {
    key: "winRate",
    kind: "rate",
    unit: "percent",
    decimals: 1,
    higherIsBetter: true,
    floor: { points: 8 },
  },
  {
    key: "score",
    kind: "mean",
    unit: "none",
    decimals: 2,
    higherIsBetter: true,
    needs: "score",
    floor: { points: 0.3 },
  },
  {
    key: "kda",
    kind: "mean",
    unit: "none",
    decimals: 2,
    higherIsBetter: true,
    floor: { fraction: 0.08 },
  },
  {
    key: "kills",
    kind: "mean",
    unit: "none",
    decimals: 1,
    higherIsBetter: true,
    floor: { fraction: 0.08 },
  },
  {
    key: "deaths",
    kind: "mean",
    unit: "none",
    decimals: 1,
    higherIsBetter: false,
    floor: { fraction: 0.08 },
  },
  {
    key: "damagePerMin",
    kind: "mean",
    unit: "perMinute",
    decimals: 0,
    higherIsBetter: true,
    floor: { fraction: 0.05 },
  },
  {
    key: "takenPerMin",
    kind: "mean",
    unit: "perMinute",
    decimals: 0,
    higherIsBetter: null,
    floor: { fraction: 0.05 },
  },
  {
    key: "goldPerMin",
    kind: "mean",
    unit: "perMinute",
    decimals: 0,
    higherIsBetter: true,
    floor: { fraction: 0.05 },
  },
  {
    key: "csPerMin",
    kind: "mean",
    unit: "perMinute",
    decimals: 1,
    higherIsBetter: true,
    needs: "cs",
    floor: { fraction: 0.05 },
  },
  {
    key: "vision",
    kind: "mean",
    unit: "none",
    decimals: 1,
    higherIsBetter: true,
    needs: "wards",
    floor: { fraction: 0.08 },
  },
  {
    key: "spree",
    kind: "mean",
    unit: "none",
    decimals: 1,
    higherIsBetter: true,
    floor: { fraction: 0.08 },
  },
  {
    key: "multikills",
    kind: "mean",
    unit: "none",
    decimals: 2,
    higherIsBetter: true,
    floor: { fraction: 0.1 },
  },
  {
    key: "duration",
    kind: "mean",
    unit: "minutes",
    decimals: 1,
    higherIsBetter: null,
    floor: { fraction: 0.05 },
  },
];

export const GROUPS: readonly GroupKey[] = [
  "champion",
  "teammate",
  "patch",
  "month",
  "weekday",
  "hour",
  "duration",
  "queue",
];

export const DEFAULT_METRIC: MetricKey = "winRate";
export const DEFAULT_GROUP: GroupKey = "champion";

/** The minimum-games filter, the blunt half of keeping noise out of the table. */
export const MIN_GAMES_CHOICES: readonly number[] = [1, 5, 10, 20, 40];
export const DEFAULT_MIN_GAMES = 10;

export function metricByKey(key: MetricKey): Metric {
  return METRICS.find((metric) => metric.key === key) ?? METRICS[0];
}

/** What the stored games of a queue can actually answer. */
export interface QueueData {
  score: boolean;
  cs: boolean;
  wards: boolean;
}

/**
 * The metrics this queue can answer.
 *
 * Asked of the data and not of a list of queue ids, the same way the history
 * decides its columns: a mode added later lands in the right shape on its own.
 *
 * Vision hangs on wards placed or cleared rather than on the vision score,
 * because the client hands out a stray vision point in about one ARAM in sixty
 * — 46 points across 799 games — and a metric built on that would offer the
 * Abyss a column of noise. Minions are deliberately not held to the same test:
 * ARAM records about 36 a game, and how fast a champion clears the bridge is a
 * real difference between your own games, which is what this page compares.
 */
export function availableMetrics(data: QueueData): MetricKey[] {
  return METRICS.filter((metric) => metric.needs == null || data[metric.needs]).map(
    (metric) => metric.key,
  );
}

/**
 * The metrics worth offering for one grouping.
 *
 * Only one pair collides: cutting the games by length and then measuring their
 * length draws a table that says the buckets are in order, which they are by
 * construction. Everything else is a fair question.
 */
export function metricsFor(group: GroupKey, available: readonly MetricKey[]): MetricKey[] {
  if (group !== "duration") return [...available];
  return available.filter((key) => key !== "duration");
}

/** One group of games: the bucket, and enough of the sample to judge it. */
export interface ExploreRow {
  /** The bucket as the query grouped it: a champion id, a patch, an hour. */
  key: string;
  /** Filled only where the key does not read on its own: a teammate's name. */
  label?: string;
  games: number;
  wins: number;
  /** Games that carried the metric, which is fewer than `games` for the score. */
  sample: number;
  /** null when no game in the group carried the metric. */
  value: number | null;
  /** Standard deviation of the sample, for the noise rule. Zero for rates. */
  sd: number;
}

export interface ExploreTable {
  metric: MetricKey;
  group: GroupKey;
  rows: ExploreRow[];
  /** Every game the filter admits, as the row each other row is read against. */
  overall: ExploreRow;
  available: MetricKey[];
  /** Groups left out by the minimum, so the page can say how many. */
  hidden: number;
}

export interface ExploreRequest {
  metric: MetricKey;
  group: GroupKey;
  /** Ignored when grouping by queue, the one view that spans them. */
  queue?: number;
  minGames: number;
}

function floorFor(metric: Metric, overall: number): number {
  return "points" in metric.floor ? metric.floor.points : Math.abs(overall) * metric.floor.fraction;
}

/** Standard error of the difference between two proportions, in points. */
function rateError(row: ExploreRow, overall: ExploreRow): number {
  const p = row.wins / row.games;
  const q = overall.wins / overall.games;
  return Math.sqrt((p * (1 - p)) / row.games + (q * (1 - q)) / overall.games) * 100;
}

/** The same for two means, whose spread is measured rather than derived. */
function meanError(row: ExploreRow, overall: ExploreRow): number {
  return Math.sqrt(row.sd ** 2 / row.sample + overall.sd ** 2 / overall.sample);
}

/** How far this group sits from your overall figure, in the metric's units. */
export function gap(row: ExploreRow, overall: ExploreRow): number | null {
  if (row.value == null || overall.value == null) return null;
  return row.value - overall.value;
}

/**
 * Whether a row really differs from your overall figure.
 *
 * Two hurdles, both needed: the gap has to be big enough to care about, and
 * big enough that this many games could not plausibly have produced it by
 * chance. The multiple is the app's usual 1.5 standard errors — deliberately
 * short of a 95% test, which at these sample sizes would leave the page
 * silent.
 *
 * The comparison is against the whole filtered set, which includes the row
 * itself. That makes it conservative rather than wrong: a group big enough to
 * move the overall figure drags the baseline toward itself, so what survives
 * is understated, never invented.
 */
export function gapCarries(row: ExploreRow, overall: ExploreRow, metric: Metric): boolean {
  if (metric.kind === "count") return false;
  const difference = gap(row, overall);
  if (difference == null || overall.value == null) return false;
  if (Math.abs(difference) < floorFor(metric, overall.value)) return false;
  if (metric.kind === "rate") {
    // A group that never won, or never lost, has no measurable spread at all:
    // the standard error of its proportion comes out exactly zero and every
    // gap would clear it. Four losses out of four is not evidence — it happens
    // one time in sixteen at even odds — so the floor on the sample is what
    // keeps that row quiet, and it is the same floor the champion verdicts use.
    if (row.games < MIN_POOL_GAMES || overall.games < MIN_POOL_GAMES) return false;
    const error = rateError(row, overall);
    return error === 0 ? difference !== 0 : Math.abs(difference) >= NOISE_MULTIPLE * error;
  }
  if (row.sample < MIN_POOL_GAMES || overall.sample < MIN_POOL_GAMES) return false;
  const error = meanError(row, overall);
  return error === 0 ? difference !== 0 : Math.abs(difference) >= NOISE_MULTIPLE * error;
}
