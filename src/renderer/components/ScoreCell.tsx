import { scoreColor } from "../lib/format";
import { useT } from "../lib/i18n";

type Badge = "MVP" | "ACE" | null;

// MVP on the winning team, ACE on the losing one. Sized to sit under a score in
// a table row; `large` is for the recap header, where it sits beside one.
export function ScoreBadge({ badge, large = false }: { badge: "MVP" | "ACE"; large?: boolean }) {
  return (
    <div
      className={`${
        large
          ? "rounded px-1.5 text-[11px] leading-[18px]"
          : "rounded px-1 text-[9px] leading-[15px] w-fit mx-auto"
      } font-bold ${
        badge === "MVP" ? "bg-amber-400/20 text-amber-300" : "bg-purple-500/20 text-purple-400"
      }`}
    >
      {badge}
    </div>
  );
}

/**
 * A game's score with, underneath, the most telling thing about it.
 *
 * A badge when there is one, otherwise where the game placed among the ten,
 * and only failing both the word "score", which says nothing the number above
 * has not already said. An unscored game leaves the column empty rather than
 * showing a zero.
 */
export default function ScoreCell({
  score,
  badge,
  rank,
  total,
}: {
  score: number | null;
  badge: Badge;
  rank?: number | null;
  total?: number | null;
}) {
  const t = useT();
  return (
    <div className="w-10 shrink-0 text-center">
      {score != null && (
        <>
          <div className={`text-sm font-semibold tabular-nums ${scoreColor(score)}`}>
            {score.toFixed(1)}
          </div>
          {badge ? (
            <ScoreBadge badge={badge} />
          ) : rank != null ? (
            <div
              className="text-[10px] tabular-nums text-lol-text"
              title={total != null ? t("history.placeOf", { rank, total }) : undefined}
            >
              {t("history.placeShort", { rank })}
            </div>
          ) : (
            <div className="text-[10px] text-lol-text uppercase tracking-wider">
              {t("history.score")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
