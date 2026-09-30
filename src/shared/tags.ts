// Short badges about the people you keep running into.
//
// Rules over your own database, like the sentences in verdict.ts, and with
// the same shape: each rule proposes a tag with a weight, and the strongest
// couple win. Two per person at most — a row of six badges is a soup, and
// nobody reads a soup.
//
// One line they do not cross: a tag describes **the shared record**, never
// the person. "Their score beats yours 6 games in 10" is a fact about your
// games together; "plays badly" would be a verdict on someone real who never
// asked to be graded by this app. Everything here is of the first kind.

import type { TranslationKey } from "./i18n";

export interface PlayerTag {
  key: TranslationKey;
  vars: Record<string, string | number>;
  weight: number;
  /** Colours the badge. Nothing here is an insult; `bad` is just a losing record. */
  tone: "good" | "bad" | "neutral";
  /**
   * What the badge means, shown on hover, with the figures it was built from.
   *
   * Every tag has one. A badge that says "+9 points" is a riddle until you
   * know it means percentage points of win rate and can see the two records
   * it came from — and the numbers are also what lets you disagree with it.
   */
  hint: {
    key: TranslationKey;
    vars: Record<string, string | number>;
    /**
     * The two records a comparison tag was built from, when there are two.
     *
     * Structured rather than folded into the sentence because the whole
     * point of a comparison is the two numbers sitting side by side; written
     * out as prose the reader has to hold one in their head to weigh it
     * against the other.
     */
    compare?: SwingCompare;
  };
}

export interface SwingCompare {
  withRate: number;
  withWins: number;
  withGames: number;
  withoutRate: number;
  withoutWins: number;
  withoutGames: number;
}

export const MAX_TAGS = 2;

// Enough shared games for a win rate to mean anything at all, and enough
// games apart to have something to compare it against. The real gate is the
// one below; these only keep the arithmetic sane.
const MIN_TOGETHER = 20;
const MIN_APART = 100;
// A gap smaller than this is not worth a badge even when it is real.
const MIN_POINT_GAP = 4;
// And it has to stand out from the noise of the sample sizes involved:
// a multiple of the standard error of the difference between the two rates.
//
// This is a noise filter, not a significance test, and the multiple is
// deliberately below the 2 that would mean 95% confidence. Checked against
// real numbers: at 2, a +7.9 point difference over 183 shared games was
// silenced, which is plainly a fact worth telling someone about their own
// history; at 1.5 that speaks and a four-point gap over thirty games — which
// is noise wearing a badge — still does not.
const NOISE_MULTIPLE = 1.5;

const MIN_STREAK = 3;
// A gap only means something for someone who used to be a regular.
const MIN_GAMES_FOR_ABSENCE = 10;
const ABSENCE_DAYS = 30;
// Someone who turned up recently and is becoming a fixture.
const NEW_WITHIN_DAYS = 21;
const NEW_MAX_GAMES = 9;
const DAY_MS = 24 * 60 * 60 * 1000;

// Score comparisons need a real run of games behind them.
const MIN_SCORED = 20;
const LOPSIDED = 0.6;

// What the win-rate comparison needs, and nothing more: the live scoreboard
// knows this much about a familiar player without knowing when you first met
// them or how the last few went.
export interface SharedRecord {
  games: number;
  wins: number;
  withoutGames: number;
  withoutWins: number;
}

export interface TaggablePlayer extends SharedRecord {
  lastPlayed: number;
  firstPlayed: number;
  streak: { win: boolean; length: number } | null;
  betterScore?: { better: number; scored: number } | null;
}

/**
 * How many percentage points your win rate moves when this person is on your
 * team, against the games they were not in.
 *
 * Null unless both sides of the comparison are big enough to bear it. This
 * is the one thing here that cannot be read off the page already, and the
 * only reason it can be computed at all is that the whole history is local.
 */
export function winRateSwing(player: SharedRecord): number | null {
  if (player.games < MIN_TOGETHER || player.withoutGames < MIN_APART) return null;
  const withThem = (player.wins / player.games) * 100;
  const without = (player.withoutWins / player.withoutGames) * 100;
  return withThem - without;
}

/**
 * How far apart the two rates have to be before the difference is worth
 * saying, for these sample sizes: two standard errors of the difference.
 */
export function swingNoiseFloor(player: SharedRecord): number {
  const p = player.wins / player.games;
  const q = player.withoutWins / player.withoutGames;
  const variance = (p * (1 - p)) / player.games + (q * (1 - q)) / player.withoutGames;
  return NOISE_MULTIPLE * Math.sqrt(variance) * 100;
}

// The two records the swing came from, spelled out. What makes the badge
// arguable rather than an oracle: you can see the games behind it.
function swingCompare(player: SharedRecord): SwingCompare {
  return {
    withRate: Math.round((player.wins / player.games) * 100),
    withWins: player.wins,
    withGames: player.games,
    withoutRate: Math.round((player.withoutWins / player.withoutGames) * 100),
    withoutWins: player.withoutWins,
    withoutGames: player.withoutGames,
  };
}

/** The swing, but only when it is both big enough to matter and to believe. */
function meaningfulSwing(player: SharedRecord): number | null {
  const swing = winRateSwing(player);
  if (swing == null) return null;
  const size = Math.abs(swing);
  if (size < MIN_POINT_GAP || size < swingNoiseFloor(player)) return null;
  return swing;
}

/**
 * The two things most worth saying about a teammate.
 *
 * `isMostPlayed` is decided by whatever holds the whole list, since it is the
 * only tag that depends on everyone else.
 */
export function teammateTags(
  player: TaggablePlayer,
  now: number,
  isMostPlayed = false,
): PlayerTag[] {
  const candidates: PlayerTag[] = [];

  const swing = meaningfulSwing(player);
  if (swing != null) {
    candidates.push({
      key: swing > 0 ? "tag.winMore" : "tag.winLess",
      vars: { points: Math.abs(Math.round(swing)) },
      weight: 90 + Math.min(9, Math.round(Math.abs(swing))),
      tone: swing > 0 ? "good" : "bad",
      hint: { key: "tag.hint.swing", vars: {}, compare: swingCompare(player) },
    });
  }

  if (isMostPlayed) {
    candidates.push({
      key: "tag.regular",
      vars: {},
      weight: 70,
      tone: "neutral",
      hint: { key: "tag.hint.regular", vars: { games: player.games } },
    });
  }

  if (player.streak && player.streak.length >= MIN_STREAK) {
    candidates.push({
      key: player.streak.win ? "tag.winStreak" : "tag.lossStreak",
      vars: { length: player.streak.length },
      weight: 75 + Math.min(15, player.streak.length * 3),
      tone: player.streak.win ? "good" : "bad",
      hint: {
        key: player.streak.win ? "tag.hint.winStreak" : "tag.hint.lossStreak",
        vars: { length: player.streak.length },
      },
    });
  }

  const away = Math.floor((now - player.lastPlayed) / DAY_MS);
  if (player.games >= MIN_GAMES_FOR_ABSENCE && away >= ABSENCE_DAYS) {
    // "221 days" is a number nobody pictures; past a couple of months the
    // useful fact is just how many months.
    const months = Math.round(away / 30);
    const hint = {
      key: "tag.hint.away" as TranslationKey,
      vars: { days: away, games: player.games },
    };
    candidates.push(
      months >= 2
        ? { key: "tag.awayMonths", vars: { months }, weight: 65, tone: "neutral", hint }
        : { key: "tag.away", vars: { days: away }, weight: 65, tone: "neutral", hint },
    );
  }

  const known = Math.floor((now - player.firstPlayed) / DAY_MS);
  if (known <= NEW_WITHIN_DAYS && player.games <= NEW_MAX_GAMES) {
    candidates.push({
      key: "tag.new",
      vars: {},
      weight: 80,
      tone: "neutral",
      hint: { key: "tag.hint.new", vars: { days: known, games: player.games } },
    });
  }

  const score = player.betterScore;
  if (score && score.scored >= MIN_SCORED) {
    const share = score.better / score.scored;
    if (share >= LOPSIDED || share <= 1 - LOPSIDED) {
      const theirs = share >= LOPSIDED;
      candidates.push({
        key: theirs ? "tag.outscoresYou" : "tag.youOutscore",
        vars: { out: Math.round((theirs ? share : 1 - share) * 10) },
        weight: 60,
        tone: "neutral",
        hint: {
          key: "tag.hint.outscore",
          vars: { better: score.better, scored: score.scored },
        },
      });
    }
  }

  return candidates.sort((a, b) => b.weight - a.weight).slice(0, MAX_TAGS);
}

/**
 * The one line worth putting beside a known player in a live lobby.
 *
 * Only one, and only for someone actually familiar: the scoreboard is already
 * ten rows of numbers during a game, and a badge on a stranger would be noise
 * on nine rows out of ten.
 */
export const MIN_GAMES_FOR_LIVE_TAG = 10;

export function livePlayerTag(player: SharedRecord): PlayerTag | null {
  if (player.games < MIN_GAMES_FOR_LIVE_TAG) return null;
  const swing = meaningfulSwing(player);
  if (swing != null) {
    return {
      key: swing > 0 ? "tag.liveWinMore" : "tag.liveWinLess",
      vars: { games: player.games, points: Math.abs(Math.round(swing)) },
      weight: 90,
      tone: swing > 0 ? "good" : "bad",
      hint: { key: "tag.hint.swing", vars: {}, compare: swingCompare(player) },
    };
  }
  return {
    key: "tag.liveTogether",
    vars: {
      games: player.games,
      rate: Math.round((player.wins / player.games) * 100),
    },
    weight: 50,
    tone: "neutral",
    hint: { key: "tag.hint.liveTogether", vars: { games: player.games, wins: player.wins } },
  };
}
