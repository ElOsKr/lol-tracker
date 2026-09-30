import { useMemo } from "react";
import { buildVerdict } from "../../shared/verdict";
import type { GameRecap } from "../lib/types";
import { formatCompact } from "../lib/format";
import { useT } from "./../lib/i18n";

/**
 * The two or three plain sentences about a game.
 *
 * They live wherever a game is being looked at deliberately — the expanded
 * row and the detail page — never in the list itself: the list is scanned,
 * not read, and someone running down it looking for one game should not have
 * to read past three sentences per entry.
 */
export default function VerdictLines({ recap }: { recap: GameRecap }) {
  const t = useT();
  const lines = useMemo(() => buildVerdict(recap, formatCompact), [recap]);
  if (lines.length === 0) return null;
  return (
    <ul className="mb-2 space-y-0.5">
      {lines.map((line) => (
        <li key={line.key} className="flex gap-2 text-xs text-lol-text-bright">
          <span aria-hidden className="text-lol-gold/60">
            ·
          </span>
          <span>{t(line.key, line.vars)}</span>
        </li>
      ))}
    </ul>
  );
}
