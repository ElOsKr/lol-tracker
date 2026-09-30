/**
 * Six things a game can say about how someone played, plus two more where the
 * queue has them.
 *
 * Not a breakdown of the score, though that was the first idea. Measured
 * against 994 stored ARAM games, the score's correlation with toughness is
 * 0.06 and with crowd control 0.09 — Mayhem v4 is all but blind to two of
 * these. They are here because they measure what the score misses, which is
 * also why they are what a score for the Rift would be calibrated from.
 *
 * Every axis is a **percentile inside its own game**: of the other nine
 * players, how many you beat. Two reasons. Comparing against your own history
 * makes the profile flat by construction — your average is always your
 * average. And a raw per-minute figure is not comparable between a fifteen
 * minute game and a forty minute one, nor between one lobby and another.
 */

export type AxisKey =
  | "aggression"
  | "damage"
  | "toughness"
  | "survival"
  | "control"
  | "economy"
  | "vision"
  | "farm";

/** Present in every queue. */
export const CORE_AXES: readonly AxisKey[] = [
  "aggression",
  "damage",
  "toughness",
  "survival",
  "control",
  "economy",
];

/**
 * Only where the map has them. The same rule as the match detail page: 194 of
 * the stored ARAM games report a vision score without a single ward placed,
 * and farm without a jungle compares nothing.
 */
export const OPTIONAL_AXES: readonly AxisKey[] = ["vision", "farm"];

export const ALL_AXES: readonly AxisKey[] = [...CORE_AXES, ...OPTIONAL_AXES];

/** One player's raw numbers from one game. */
export interface AxisInput {
  kills: number;
  assists: number;
  /** Kills by that player's whole team, for the participation share. */
  teamKills: number;
  deaths: number;
  damageToChampions: number;
  damageTaken: number;
  selfMitigated: number;
  ccTime: number;
  gold: number;
  wardsPlaced: number;
  wardsKilled: number;
  cs: number;
  neutralCs: number;
  minutes: number;
}

/**
 * The raw value of each axis, before it is compared with anyone.
 *
 * Every axis points the same way: more is better. Deaths are the exception in
 * the data and are negated here, so a reader never has to remember that one
 * row of the table runs backwards.
 */
export function axisValues(input: AxisInput): Record<AxisKey, number> {
  const perMinute = (total: number) => (input.minutes > 0 ? total / input.minutes : 0);
  return {
    aggression: input.teamKills > 0 ? (input.kills + input.assists) / input.teamKills : 0,
    damage: perMinute(input.damageToChampions),
    toughness: perMinute(input.damageTaken + input.selfMitigated),
    survival: -perMinute(input.deaths),
    control: perMinute(input.ccTime),
    economy: perMinute(input.gold),
    vision: input.wardsPlaced + input.wardsKilled,
    farm: perMinute(input.cs),
  };
}

/**
 * Where one value sits among the others, as a percentage of the players it
 * beats. Ties do not count as beaten: matching everyone on an axis nobody
 * scored on reads as 0, not as 100.
 */
export function percentileAmong(all: readonly number[], mine: number): number {
  const others = all.length - 1;
  if (others <= 0) return 0;
  let beaten = 0;
  for (const value of all) if (value < mine) beaten++;
  return (beaten / others) * 100;
}

/** Which axes a game can speak to. Vision and farm ask the game, not the queue. */
export function axesFor(lobby: readonly AxisInput[]): AxisKey[] {
  const axes = [...CORE_AXES];
  if (lobby.some((p) => p.wardsPlaced + p.wardsKilled > 0)) axes.push("vision");
  if (lobby.some((p) => p.neutralCs >= MIN_JUNGLE_CAMPS)) axes.push("farm");
  return axes;
}

/** The same threshold the match detail page measured, kept in step with it. */
export const MIN_JUNGLE_CAMPS = 20;

/** A champion needs this many games before its row means anything. */
export const MIN_CHAMPION_GAMES = 15;

/** How many games each side of a trend comparison takes. */
export const TREND_WINDOW = 200;

/**
 * The same noise rule the rest of the app uses: a gap counts when it clears
 * 1.5 standard errors of the difference. Deliberately below the 2 that would
 * make it a 95% test — calibrated against real data, where 2 silenced things
 * worth saying.
 */
export const NOISE_MULTIPLE = 1.5;

export interface Sample {
  mean: number;
  /** Standard deviation of the sample. */
  sd: number;
  count: number;
}

export function summarize(values: readonly number[]): Sample {
  const count = values.length;
  if (count === 0) return { mean: 0, sd: 0, count: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / count;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
  return { mean, sd: Math.sqrt(variance), count };
}

/** Whether two samples differ by more than their own noise. */
export function meaningfulShift(before: Sample, after: Sample): boolean {
  if (before.count < 2 || after.count < 2) return false;
  const se = Math.sqrt(before.sd ** 2 / before.count + after.sd ** 2 / after.count);
  if (se === 0) return Math.abs(after.mean - before.mean) > 0;
  return Math.abs(after.mean - before.mean) > NOISE_MULTIPLE * se;
}

/** One axis of the profile, over whatever set of games was asked for. */
export interface AxisScore {
  axis: AxisKey;
  percentile: number;
  games: number;
}

export interface ChampionAxes {
  championId: number;
  games: number;
  /** Percentile per axis; an axis the champion's games never had is absent. */
  values: Partial<Record<AxisKey, number>>;
}

export interface AxisTrend {
  axis: AxisKey;
  before: number;
  after: number;
  /** Games on each side of the comparison. */
  window: number;
  /** False when the gap is inside the noise, and should be shown as flat. */
  meaningful: boolean;
}

export interface SkillAxes {
  games: number;
  /** Axes with data, in display order. */
  axes: AxisKey[];
  profile: AxisScore[];
  champions: ChampionAxes[];
  /** Null until there are two full windows to compare. */
  trend: AxisTrend[] | null;
}

/** Half the library on each side is the least this can say anything about. */
export function canCompareTrend(games: number): boolean {
  return games >= TREND_WINDOW * 2;
}
