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

import { MIN_POOL_GAMES, winRateGapCarries } from "./champion-pool";
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
  | "duration"
  | "firstBlood"
  | "firstBloodPart"
  | "firstTower";

export type GroupKey =
  | "champion"
  | "teammate"
  | "patch"
  | "week"
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
export type MetricNeeds = "score" | "cs" | "wards" | "firsts";

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
  /**
   * Para métricas que son un sí/no por partida enseñado como porcentaje.
   *
   * Cambia cómo se mide el ruido, y no es un detalle: la desviación de un
   * grupo que nunca lo consiguió es **exactamente cero**, así que la fórmula
   * de medias le atribuye una precisión que no tiene y marca como hallazgo un
   * 0% que ocurre una vez de cada siete. Con esto, el error se calcula desde
   * tu tasa general —la hipótesis de que ese grupo es como tú— en vez de desde
   * la del propio grupo.
   */
  proportion?: true;
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
  // Tasas, no cuentas: la media de un 0/1 por partida es el porcentaje de
  // partidas en que pasó, y su desviación sale medida como la de cualquier
  // otra media. El suelo es absoluto —cinco puntos— porque uno relativo sobre
  // un 12% serían 1,2 puntos, que no es una diferencia que nadie note.
  {
    key: "firstBlood",
    kind: "mean",
    unit: "percent",
    decimals: 1,
    higherIsBetter: true,
    needs: "firsts",
    floor: { points: 5 },
    proportion: true,
  },
  {
    key: "firstBloodPart",
    kind: "mean",
    unit: "percent",
    decimals: 1,
    higherIsBetter: true,
    needs: "firsts",
    floor: { points: 5 },
    proportion: true,
  },
  {
    key: "firstTower",
    kind: "mean",
    unit: "percent",
    decimals: 1,
    higherIsBetter: true,
    needs: "firsts",
    floor: { points: 5 },
    proportion: true,
  },
];

export const GROUPS: readonly GroupKey[] = [
  "champion",
  "teammate",
  "patch",
  "week",
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
  /** Whether any game of the queue ever recorded a first blood or first tower. */
  firsts: boolean;
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

/**
 * El error de la diferencia entre dos proporciones, en puntos.
 *
 * Agrupado: bajo la hipótesis de que el grupo se comporta como tú en general,
 * la varianza de los dos lados es la de **tu tasa general**, no la que el
 * grupo enseñe. Es lo que impide que un grupo con cero aciertos, cuya
 * desviación es cero, parezca medido con una precisión infinita.
 */
function proportionError(row: ExploreRow, overall: ExploreRow): number {
  const q = (overall.value ?? 0) / 100;
  return Math.sqrt(q * (1 - q) * (1 / row.sample + 1 / overall.sample)) * 100;
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
  // Win rates go through the shared rule, which also carries the minimum
  // sample: a group that never won, or never lost, has a standard error of
  // exactly zero, and four losses out of four would otherwise clear any gap.
  if (metric.kind === "rate") {
    return winRateGapCarries(row, overall, floorFor(metric, overall.value));
  }
  if (row.sample < MIN_POOL_GAMES || overall.sample < MIN_POOL_GAMES) return false;
  const error = metric.proportion ? proportionError(row, overall) : meanError(row, overall);
  return error === 0 ? difference !== 0 : Math.abs(difference) >= NOISE_MULTIPLE * error;
}
