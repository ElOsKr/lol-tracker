// Which champions actually go well for you, and which only look like they do.
//
// The roadmap called this a "champion pool", which assumes you pick. In ARAM
// you do not: the champion is dealt to you. So the question is not "what is
// your repertoire" but "how does it go when this one comes up" — which is the
// cleaner question anyway, because you cannot dodge the ones you are bad at.
//
// The interesting part is not the win rate. It is where the win rate and the
// score disagree: winning on a champion you play badly is luck or a good
// team, and losing on one you play well is neither your fault nor a reason to
// avoid it.

export interface ChampionRecord {
  games: number;
  wins: number;
  /** Games with a stored score, and the sums needed to measure the spread. */
  scored: number;
  scoreSum: number;
  scoreSumSq: number;
}

export interface Baseline {
  games: number;
  wins: number;
  scored: number;
  scoreSum: number;
  scoreSumSq: number;
}

// Below this a champion has no record, only anecdotes. Twelve is already
// generous for a win rate; the noise test below is what does the real work.
export const MIN_POOL_GAMES = 8;

// The same standard of evidence the player tags use: a gap has to clear a
// multiple of the standard error of the difference. Below 2 on purpose — at
// these sample sizes a strict 95% would silence nearly everything and the
// page would say nothing at all.
const NOISE_MULTIPLE = 1.5;
// And a floor, so a difference that is technically distinguishable but tiny
// does not earn a label.
const MIN_WIN_GAP = 8;
const MIN_SCORE_GAP = 0.3;

export type PoolVerdict =
  | "reliable" // you win more than usual on it
  | "struggles" // you win less than usual on it
  | null;

/**
 * What the score says about a win-rate gap.
 *
 * The first version asked for the score gap to be significant too, in the
 * opposite direction, and then called that a "trap champion". Measured
 * against a real 792-game history, that combination never once occurred: at
 * ten to twenty games a score gap needs about 0.6 points to clear the noise
 * and a win gap about twenty, and both at once in opposite directions is
 * vanishingly rare. The feature would have shipped never showing the very
 * thing it was for.
 *
 * The signal was the other way round. What makes a win rate worth a second
 * look is the score NOT moving with it. Said carefully, though: failing to
 * detect a difference is not the same as showing there is none, so "flat"
 * means the record does not show the wins came from playing better — never
 * that it shows they did not.
 */
export type ScoreAgreement =
  | "supports" // the score moved the same way
  | "contradicts" // the score moved the other way
  | "flat"; // no clear difference either way, which is the interesting one

export interface PoolJudgement {
  verdict: PoolVerdict;
  /** Percentage points of win rate against the overall record. */
  winGap: number;
  /** Points of score against the overall average, null without scores. */
  scoreGap: number | null;
  /** Only meaningful alongside a verdict. */
  agreement: ScoreAgreement;
}

function mean(sum: number, n: number): number {
  return n > 0 ? sum / n : 0;
}

// Population variance from the running sums, floored at zero: rounding can
// take the subtraction a hair below it.
function variance(sum: number, sumSq: number, n: number): number {
  if (n < 2) return 0;
  return Math.max(0, sumSq / n - (sum / n) ** 2);
}

/** Whether a win-rate gap is bigger than the noise of these two samples. */
function winGapCarries(record: ChampionRecord, base: Baseline, gap: number): boolean {
  const p = record.wins / record.games;
  const q = base.wins / base.games;
  const se = Math.sqrt((p * (1 - p)) / record.games + (q * (1 - q)) / base.games) * 100;
  return Math.abs(gap) >= MIN_WIN_GAP && Math.abs(gap) >= NOISE_MULTIPLE * se;
}

/** The same for the score, whose spread has to be measured rather than derived. */
function scoreGapCarries(record: ChampionRecord, base: Baseline, gap: number): boolean {
  if (record.scored < 2 || base.scored < 2) return false;
  const se = Math.sqrt(
    variance(record.scoreSum, record.scoreSumSq, record.scored) / record.scored +
      variance(base.scoreSum, base.scoreSumSq, base.scored) / base.scored,
  );
  return Math.abs(gap) >= MIN_SCORE_GAP && Math.abs(gap) >= NOISE_MULTIPLE * se;
}

/**
 * How a champion has gone, against how you go in general.
 *
 * Null whenever there is not enough to say — which is most champions, and is
 * the point: a verdict on six games is a guess wearing a label.
 */
export function judgeChampion(record: ChampionRecord, base: Baseline): PoolJudgement {
  const winGap =
    record.games > 0 && base.games > 0
      ? (record.wins / record.games) * 100 - (base.wins / base.games) * 100
      : 0;
  const scoreGap =
    record.scored > 0 && base.scored > 0
      ? mean(record.scoreSum, record.scored) - mean(base.scoreSum, base.scored)
      : null;

  // How the score behaved, whether or not there is a verdict to attach it to
  const moved = scoreGap != null && scoreGapCarries(record, base, scoreGap);
  const agreement: ScoreAgreement = !moved ? "flat" : scoreGap! > 0 ? "supports" : "contradicts";

  if (record.games < MIN_POOL_GAMES) return { verdict: null, winGap, scoreGap, agreement };
  if (!winGapCarries(record, base, winGap)) {
    return { verdict: null, winGap, scoreGap, agreement };
  }

  // The badge states only what the win rate supports. Whether the score backs
  // it up is the nuance, and it belongs in the explanation rather than in a
  // label of its own — see ScoreAgreement.
  return {
    verdict: winGap > 0 ? "reliable" : "struggles",
    winGap,
    scoreGap,
    agreement: winGap > 0 ? agreement : flip(agreement),
  };
}

// For a losing champion the roles swap: a score that also fell supports the
// verdict, while one that rose contradicts it.
function flip(agreement: ScoreAgreement): ScoreAgreement {
  if (agreement === "supports") return "contradicts";
  if (agreement === "contradicts") return "supports";
  return "flat";
}
