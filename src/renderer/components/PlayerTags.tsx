import type { PlayerTag } from "../../shared/tags";
import { useT } from "../lib/i18n";
import HoverCard from "./HoverCard";

const TONE = {
  good: "border-lol-win/40 bg-lol-win/10 text-lol-win",
  bad: "border-lol-loss/40 bg-lol-loss/10 text-lol-loss",
  neutral: "border-lol-border bg-white/5 text-lol-text-bright",
} as const;

const TONE_TEXT = {
  good: "text-lol-win",
  bad: "text-lol-loss",
  neutral: "text-lol-text-bright",
} as const;

/**
 * The badges beside someone you keep running into.
 *
 * Deliberately plain as a badge: a tag is a short fact about your shared
 * games, so it reads as a label and not as a verdict on a real person. The
 * explanation is a hover away, in the app's own card rather than the
 * browser's grey box, because "+9 points" is a riddle on its own.
 */
export default function PlayerTags({
  tags,
  className = "",
}: {
  tags: PlayerTag[];
  className?: string;
}) {
  if (tags.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {tags.map((tag) => (
        <HoverCard key={tag.key} content={<TagExplanation tag={tag} />} width={268}>
          <span
            className={`cursor-help rounded border px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap ${TONE[tag.tone]}`}
          >
            <TagText tag={tag} />
          </span>
        </HoverCard>
      ))}
    </div>
  );
}

function TagText({ tag }: { tag: PlayerTag }) {
  const t = useT();
  return <>{t(tag.key, tag.vars)}</>;
}

/**
 * What the badge means.
 *
 * A tag built by comparing two records shows them as two rows rather than as
 * a sentence: the point of the comparison is that the numbers sit side by
 * side, and a paragraph makes the reader hold them in their head instead.
 */
function TagExplanation({ tag }: { tag: PlayerTag }) {
  const t = useT();
  const compare = tag.hint.compare;
  return (
    <div className="flex flex-col gap-2">
      <div className={`text-[11px] font-semibold ${TONE_TEXT[tag.tone]}`}>
        {t(tag.key, tag.vars)}
      </div>

      {compare && (
        <div className="flex flex-col gap-1">
          <CompareRow
            label={t("tag.hint.together")}
            rate={compare.withRate}
            wins={compare.withWins}
            games={compare.withGames}
            highlight
          />
          <CompareRow
            label={t("tag.hint.apart")}
            rate={compare.withoutRate}
            wins={compare.withoutWins}
            games={compare.withoutGames}
          />
        </div>
      )}

      <p className="m-0 text-[11px] leading-snug text-lol-text">{t(tag.hint.key, tag.hint.vars)}</p>
    </div>
  );
}

function CompareRow({
  label,
  rate,
  wins,
  games,
  highlight = false,
}: {
  label: string;
  rate: number;
  wins: number;
  games: number;
  highlight?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex items-baseline gap-2 rounded bg-white/[0.03] px-2 py-1">
      <span className="flex-grow text-[11px] text-lol-text">{label}</span>
      <span
        className={`text-xs font-semibold tabular-nums ${
          highlight ? "text-lol-text-bright" : "text-lol-text"
        }`}
      >
        {rate}%
      </span>
      <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-lol-text/70">
        {t("tag.hint.outOf", { wins, games })}
      </span>
    </div>
  );
}
