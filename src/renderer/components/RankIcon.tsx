import { useState } from "react";
import { rankCrestUrl } from "../../shared/cdragon";
import { formatRank, tierLabelKey, type PlayerRank } from "../../shared/ranks";
import { useT } from "../lib/i18n";

// One crest per tier for the whole renderer, so a tier whose art is missing is
// asked for once and then drawn as text everywhere it appears, rather than
// flashing a broken image on every row that happens to hold it.
const deadTiers = new Set<string>();

/**
 * A player's rank as the client shows it: the little crest with the division
 * beside it. In Roman numerals, because that is what the game puts on them.
 *
 * Master and above have no division; there the number is the LP, which is the
 * only thing that separates them. The full name is always in the tooltip, and
 * it takes over entirely if the crest cannot be drawn.
 */
export default function RankIcon({ rank, size = 18 }: { rank: PlayerRank; size?: number }) {
  const t = useT();
  const [broken, setBroken] = useState(() => deadTiers.has(rank.tier));
  const full = formatRank(rank, t);
  const suffix = rank.division ?? String(Math.round(rank.lp));

  if (broken) {
    return (
      <span className="text-[10px] text-lol-text-bright" title={full}>
        {full}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" title={full}>
      <img
        src={rankCrestUrl(rank.tier)}
        alt={t(tierLabelKey(rank.tier))}
        width={size}
        height={size}
        className="shrink-0"
        onError={() => {
          deadTiers.add(rank.tier);
          setBroken(true);
        }}
      />
      <span className="text-[10px] tabular-nums text-lol-text-bright">{suffix}</span>
    </span>
  );
}
