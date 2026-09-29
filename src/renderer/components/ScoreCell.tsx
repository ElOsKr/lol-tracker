import { scoreColor } from "../lib/format";
import { useT } from "../lib/i18n";

type Badge = "MVP" | "ACE" | null;

// MVP on the winning team, ACE on the losing one. Sized to sit under a score in
// a table row; `large` is for the recap header, where it sits beside one.
/**
 * The MVP or ACE chip.
 *
 * The small variant centres itself with `mx-auto`, which is right under a
 * plain block parent and wrong inside a flex row: there an auto margin stops
 * centring and swallows every pixel of free space instead, shoving whatever
 * shares the line out of the column. A flex parent passes `inline`.
 */
export function ScoreBadge({
  badge,
  large = false,
  inline = false,
}: {
  badge: "MVP" | "ACE";
  large?: boolean;
  inline?: boolean;
}) {
  return (
    <div
      className={`${
        large
          ? "rounded px-1.5 text-[11px] leading-[18px]"
          : `rounded px-1 text-[9px] leading-[15px] w-fit ${inline ? "" : "mx-auto"}`
      } font-bold ${
        badge === "MVP" ? "bg-amber-400/20 text-amber-300" : "bg-purple-500/20 text-purple-400"
      }`}
    >
      {badge}
    </div>
  );
}

// A game's score with its badge underneath, as the match rows draw it. An
// unscored game (a remake, or one stored before scoring existed) leaves the
// column empty rather than showing a zero. Where the game placed among the ten
// is not here: the row has no width to spare, and the scoreboard underneath
// shows every player's place at once, which says far more.
export default function ScoreCell({ score, badge }: { score: number | null; badge: Badge }) {
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
