import type { PlayerTag } from "../../shared/tags";
import { useT } from "../lib/i18n";

const TONE = {
  good: "border-lol-win/40 bg-lol-win/10 text-lol-win",
  bad: "border-lol-loss/40 bg-lol-loss/10 text-lol-loss",
  neutral: "border-lol-border bg-white/5 text-lol-text-bright",
} as const;

/**
 * The badges beside someone you keep running into.
 *
 * Deliberately plain: a tag is a short fact about your shared games, so it
 * reads as a label and not as a verdict on a real person.
 */
export default function PlayerTags({
  tags,
  className = "",
}: {
  tags: PlayerTag[];
  className?: string;
}) {
  const t = useT();
  if (tags.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {tags.map((tag) => (
        <span
          key={tag.key}
          // A badge is too short to explain itself, so the whole sentence and
          // the figures behind it are a hover away.
          title={t(tag.hint.key, tag.hint.vars)}
          className={`cursor-help rounded border px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap ${TONE[tag.tone]}`}
        >
          {t(tag.key, tag.vars)}
        </span>
      ))}
    </div>
  );
}
