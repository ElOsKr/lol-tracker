import { usePerkData } from "../hooks/useChampions";
import { CDRAGON_PERK_URL } from "../lib/constants";
import HoverCard from "./HoverCard";
import RiotText from "./RiotText";

/**
 * One rune, or one of the two trees it came from.
 *
 * A keystone is drawn larger than the minor runes beside it, the way the
 * client draws them, so a row of six reads as "this one, then those".
 */
export default function PerkIcon({
  perkId,
  size = 24,
  patch,
}: {
  perkId: number;
  size?: number;
  patch?: string | null;
}) {
  const perks = usePerkData(patch);
  const perk = perks[perkId];

  if (!perkId || !perk?.iconPath) {
    return (
      <div
        className="rounded-full border border-white/10 bg-white/5"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <HoverCard
      content={
        <>
          <div className="mb-1 font-semibold text-lol-gold-light">{perk.name}</div>
          <RiotText markup={perk.shortDesc} />
        </>
      }
    >
      <img
        src={CDRAGON_PERK_URL(perk.branch, perk.iconPath)}
        alt=""
        width={size}
        height={size}
        className="rounded-full"
      />
    </HoverCard>
  );
}
