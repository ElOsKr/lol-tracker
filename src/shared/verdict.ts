// Two or three sentences about a game, in plain language.
//
// Rules, not a language model: nothing leaves the machine and the same game
// always reads the same way. Each rule proposes a sentence with a weight for
// how much it is worth saying, and the strongest few win.
//
// The point is to say what a glance at the numbers would not. "You did 20.4k
// damage" is already on screen; "45% more than you usually do" is not.
//
// Comparisons are made against this player's own record **with this champion**
// once there is enough of one, and only otherwise against their whole career.
// A career average mixes every champion together, so measuring a marksman's
// healing against it says which champion was picked rather than how the game
// went — which is the sort of sentence that sounds like a judgement and is
// really a category error.
//
// Everything measured against an average is measured **per minute**.
// A total is as much a fact about how long the game ran as about how it was
// played: an eleven-minute stomp is below average on every total there is,
// and saying so would be reporting the clock while sounding like a verdict on
// the player. The sentences say "per minute" out loud, so they cannot be read
// as contradicting the plain totals shown above them.

import type { GameRecap, PlayerStatsRecord } from "./api";
import type { TranslationKey } from "./i18n";

export interface VerdictLine {
  key: TranslationKey;
  vars: Record<string, string | number>;
  /** How much this is worth saying. Only used for picking. */
  weight: number;
  /**
   * Sentences of the same family repeat themselves, so at most one of each is
   * picked: two lines both about damage read as padding.
   */
  family: "result" | "stat" | "context";
}

export const VERDICT_MAX_LINES = 3;

// Below this a difference is noise, not news: everybody's damage wanders by a
// fifth from one game to the next.
const NOTABLE_RATIO = 0.25;
// Rates this small make percentages meaningless — 40% more than 10 healing a
// minute is still nothing. Per minute, like everything else here.
const MIN_MEANINGFUL = { damage: 150, taken: 150, heal: 40, gold: 150 };
// Below this the clock itself is unreliable: a game that barely started has
// spiky rates, and a remake-adjacent two minutes would shout about everything.
const MIN_MINUTES = 5;

export type Compact = (value: number) => string;

// Fewer than this on a champion and their own average is one lucky game, so
// the career is the steadier thing to stand on.
const MIN_CHAMPION_GAMES = 5;

// What a game is being held up against, and whether that yardstick is this
// champion or the whole career — which changes the wording, since "less than
// you usually do" and "less than you usually do on this champion" are
// different claims.
interface Yardstick {
  minutes: number;
  deaths: number;
  damage: number;
  taken: number;
  heal: number;
  gold: number;
  onChampion: boolean;
}

export function pickYardstick(recap: GameRecap): Yardstick {
  const { career, champion } = recap;
  const useChampion = champion.games >= MIN_CHAMPION_GAMES && champion.avgDuration > 0;
  const src = useChampion ? champion : career;
  return {
    minutes: src.avgDuration / 60,
    deaths: src.avgDeaths,
    damage: src.avgDamage,
    taken: src.avgTaken,
    heal: src.avgHeal,
    gold: src.avgGold,
    onChampion: useChampion,
  };
}

function pct(value: number, average: number): number {
  return Math.round((Math.abs(value - average) / average) * 100);
}

/**
 * The one stat that strayed furthest from what this player usually does.
 *
 * Compared as ratios rather than absolute gaps so the figures can be measured
 * against each other at all: 5k of damage and 5k of gold are not the same
 * size of surprise.
 */
function biggestStatSwing(
  stats: PlayerStatsRecord,
  yard: Yardstick,
  minutes: number,
  compact: Compact,
): VerdictLine | null {
  const candidates: { key: TranslationKey; value: number; average: number; floor: number }[] = [
    {
      key: "verdict.damageUp",
      value: stats.total_damage_dealt,
      average: yard.damage,
      floor: MIN_MEANINGFUL.damage,
    },
    {
      key: "verdict.takenUp",
      value: stats.total_damage_taken,
      average: yard.taken,
      floor: MIN_MEANINGFUL.taken,
    },
    {
      key: "verdict.healUp",
      value: stats.total_heal,
      average: yard.heal,
      floor: MIN_MEANINGFUL.heal,
    },
    {
      key: "verdict.goldUp",
      value: stats.gold_earned,
      average: yard.gold,
      floor: MIN_MEANINGFUL.gold,
    },
  ];

  let best: VerdictLine | null = null;
  for (const c of candidates) {
    const rate = c.value / minutes;
    const averageRate = c.average / yard.minutes;
    if (averageRate < c.floor) continue;
    const ratio = Math.abs(rate - averageRate) / averageRate;
    if (ratio < NOTABLE_RATIO) continue;
    const up = rate > averageRate;
    const line: VerdictLine = {
      // The "down" key is the "up" key with the suffix swapped, so the pairs
      // cannot drift apart in the dictionaries.
      key: ((up ? c.key : c.key.replace(/Up$/, "Down")) +
        (yard.onChampion ? "OnChamp" : "")) as TranslationKey,
      vars: { value: compact(Math.round(rate)), pct: pct(rate, averageRate) },
      weight: 40 + Math.min(40, Math.round(ratio * 60)),
      family: "stat",
    };
    if (!best || line.weight > best.weight) best = line;
  }
  return best;
}

// Deaths are the one figure people count rather than rate, so this one says
// the comparison out loud instead of switching to per-minute: how many a game
// of this length usually costs them.
function deathsLine(
  stats: PlayerStatsRecord,
  yard: Yardstick,
  minutes: number,
): VerdictLine | null {
  const expected = yard.deaths * (minutes / yard.minutes);
  const diff = stats.deaths - expected;
  // Whole deaths, because half a death is not a thing anyone pictures
  const rounded = Math.round(Math.abs(diff));
  if (rounded < 3) return null;
  return {
    key: diff > 0 ? "verdict.deathsUp" : "verdict.deathsDown",
    vars: { deaths: stats.deaths, expected: Math.round(expected) },
    weight: 45 + Math.min(30, rounded * 5),
    family: "stat",
  };
}

function resultLines(recap: GameRecap, stats: PlayerStatsRecord): VerdictLine[] {
  const lines: VerdictLine[] = [];
  const { career, champion, score } = recap;

  if (champion.firstTime) {
    lines.push({
      key: recap.detail.stats?.win ? "verdict.firstTimeWin" : "verdict.firstTime",
      vars: {},
      weight: 88,
      family: "result",
    });
  }

  if (score == null) return lines;

  // A personal best with this champion beats anything else worth saying
  if (champion.previousBest != null && score > champion.previousBest && champion.games > 1) {
    lines.push({
      key: "verdict.championBest",
      vars: { score: score.toFixed(1), previous: champion.previousBest.toFixed(1) },
      weight: 100,
      family: "result",
    });
  }

  const rank = stats.score_rank;
  const total = stats.score_rank_total;
  if (rank != null && total != null) {
    if (rank === 1) {
      lines.push({ key: "verdict.bestOfAll", vars: { total }, weight: 92, family: "result" });
    } else if (rank >= total - 1) {
      lines.push({
        key: "verdict.worstOfAll",
        vars: { rank, total },
        weight: 66,
        family: "result",
      });
    }
  }

  if (career.avgScore != null && career.games > 5) {
    const diff = score - career.avgScore;
    if (Math.abs(diff) >= 1.5) {
      lines.push({
        key: diff > 0 ? "verdict.scoreAbove" : "verdict.scoreBelow",
        vars: { score: score.toFixed(1), average: career.avgScore.toFixed(1) },
        weight: 70 + Math.min(15, Math.round(Math.abs(diff) * 5)),
        family: "result",
      });
    }
  }
  return lines;
}

function contextLines(recap: GameRecap): VerdictLine[] {
  const lines: VerdictLine[] = [];
  const { streak, session, champion } = recap;

  if (streak && streak.length >= 3) {
    lines.push({
      key: streak.isRecord
        ? streak.kind === "win"
          ? "verdict.winStreakRecord"
          : "verdict.lossStreakRecord"
        : streak.kind === "win"
          ? "verdict.winStreak"
          : "verdict.lossStreak",
      vars: { length: streak.length },
      weight: 60 + Math.min(25, streak.length * 4),
      family: "context",
    });
  }

  // Only once the day has enough games for a record to mean anything
  if (session.wins + session.losses >= 3) {
    lines.push({
      key: "verdict.sessionRecord",
      vars: { wins: session.wins, losses: session.losses },
      weight: 50,
      family: "context",
    });
  }

  if (!champion.firstTime && champion.games <= 3) {
    lines.push({
      key: "verdict.newChampion",
      vars: { games: champion.games },
      weight: 55,
      family: "context",
    });
  }
  return lines;
}

/**
 * The two or three things most worth saying about a game.
 *
 * A remake gets one sentence and nothing else: there is nothing to compare a
 * cancelled game against, and every rule below would be measuring noise.
 */
export function buildVerdict(recap: GameRecap, compact: Compact): VerdictLine[] {
  const stats = recap.detail.stats;
  if (!stats) return [];
  if (recap.detail.game.is_remake) {
    return [{ key: "verdict.remake", vars: {}, weight: 100, family: "result" }];
  }

  const minutes = recap.detail.game.game_duration / 60;
  const yard = pickYardstick(recap);
  // Without a usable clock on either side there is no honest rate to compare,
  // so the stat sentences simply stand down and the rest carry the paragraph.
  const rated = minutes >= MIN_MINUTES && yard.minutes >= MIN_MINUTES;

  const candidates = [
    ...resultLines(recap, stats),
    ...(rated
      ? [biggestStatSwing(stats, yard, minutes, compact), deathsLine(stats, yard, minutes)]
      : []),
    ...contextLines(recap),
  ].filter((line): line is VerdictLine => line != null);

  const picked: VerdictLine[] = [];
  const used = new Set<VerdictLine["family"]>();
  for (const line of [...candidates].sort((a, b) => b.weight - a.weight)) {
    if (used.has(line.family)) continue;
    used.add(line.family);
    picked.push(line);
    if (picked.length === VERDICT_MAX_LINES) break;
  }
  // Read in a fixed order rather than by weight: what happened, then how you
  // played, then where it leaves you. A paragraph, not a ranking.
  const order: VerdictLine["family"][] = ["result", "stat", "context"];
  return picked.sort((a, b) => order.indexOf(a.family) - order.indexOf(b.family));
}
