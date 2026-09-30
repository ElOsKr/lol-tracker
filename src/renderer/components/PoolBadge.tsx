import type { PoolJudgement, PoolVerdict, ScoreAgreement } from "../../shared/champion-pool";
import type { TranslationKey } from "../../shared/i18n";
import { useT } from "../lib/i18n";
import HoverCard from "./HoverCard";

type Verdict = NonNullable<PoolVerdict>;

const TONE: Record<Verdict, string> = {
  reliable: "border-lol-win/40 bg-lol-win/10 text-lol-win",
  struggles: "border-lol-loss/40 bg-lol-loss/10 text-lol-loss",
};

// Typed rather than built from the verdict name, so a new verdict without a
// label or without its explanation fails to compile instead of showing a key.
const LABEL: Record<Verdict, TranslationKey> = {
  reliable: "pool.reliable",
  struggles: "pool.struggles",
};

// What the score says about the win rate. The flat case is the interesting
// one: winning far more than usual while scoring exactly your average means
// the wins are not coming from how you played.
const WHY: Record<Verdict, Record<ScoreAgreement, TranslationKey>> = {
  reliable: {
    supports: "pool.reliableSupports",
    contradicts: "pool.reliableContradicts",
    flat: "pool.reliableFlat",
  },
  struggles: {
    supports: "pool.strugglesSupports",
    contradicts: "pool.strugglesContradicts",
    flat: "pool.strugglesFlat",
  },
};

const sign = (n: number, digits = 0) => (n > 0 ? "+" : "") + n.toFixed(digits);

/**
 * How a champion has gone for you, when there is enough to say so.
 *
 * Nothing for most champions, on purpose: a verdict on six games is a guess
 * wearing a label. The explanation carries both gaps, because the two
 * interesting verdicts are exactly the ones where they disagree.
 */
export default function PoolBadge({ judgement }: { judgement: PoolJudgement }) {
  const t = useT();
  const verdict = judgement.verdict;
  if (!verdict) return null;
  return (
    <HoverCard
      width={252}
      content={
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] font-semibold text-lol-text-bright">{t(LABEL[verdict])}</div>
          <div className="text-[11px] text-lol-text">
            {t("pool.winGap", { points: sign(judgement.winGap) })}
            {judgement.scoreGap != null && (
              <> · {t("pool.scoreGap", { points: sign(judgement.scoreGap, 2) })}</>
            )}
          </div>
          <p className="m-0 text-[11px] leading-snug text-lol-text">
            {t(WHY[verdict][judgement.agreement])}
          </p>
        </div>
      }
    >
      <span
        className={`cursor-help rounded border px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap ${TONE[verdict]}`}
      >
        {t(LABEL[verdict])}
      </span>
    </HoverCard>
  );
}
