import { useEffect, useMemo, useState } from "react";
import { useAugmentData } from "../hooks/useChampions";
import { CDRAGON_ASSET_URL } from "../lib/constants";

interface AugmentIconProps {
  augmentId: number;
  size?: number;
  showName?: boolean;
  patch?: string | null;
}

const rarityBorder: Record<string, string> = {
  kSilver: "ring-1 ring-gray-400/60",
  kGold: "ring-1 ring-yellow-500/70",
  kPrismatic: "ring-1 ring-fuchsia-400/80",
};

const rarityTextColor: Record<string, string> = {
  kSilver: "text-gray-300",
  kGold: "text-yellow-400",
  kPrismatic: "text-fuchsia-400",
};

// One lookup per augment for the whole renderer: a retired augment shows up on
// every row of the stats pages, and they'd otherwise each ask the main process.
const fallbackLookups = new Map<number, Promise<string | null>>();

function lookupFallbackIcon(augmentId: number, patch?: string | null): Promise<string | null> {
  let promise = fallbackLookups.get(augmentId);
  if (!promise) {
    promise = window.api.resolveAugmentIcon(augmentId, patch ?? undefined);
    fallbackLookups.set(augmentId, promise);
    promise.catch(() => fallbackLookups.delete(augmentId));
  }
  return promise;
}

export function getAugmentRarityLabel(rarity: string): string {
  if (rarity === "kSilver") return "Silver";
  if (rarity === "kGold") return "Gold";
  if (rarity === "kPrismatic") return "Prismatic";
  return "";
}

export default function AugmentIcon({
  augmentId,
  size = 28,
  showName = false,
  patch,
}: AugmentIconProps) {
  const augmentData = useAugmentData();
  const aug = augmentData[augmentId];
  const [attempt, setAttempt] = useState(0);
  const [fallback, setFallback] = useState<string | null>(null);
  const [lookedUp, setLookedUp] = useState(false);

  const sources = useMemo(() => {
    if (!aug?.iconPath) return [];
    // CommunityDragon icon paths need to be converted; the data names the small
    // art, and the large variant sits beside it under the same name.
    const large = CDRAGON_ASSET_URL("latest", aug.iconPath.replace("small", "large"));
    const small = CDRAGON_ASSET_URL("latest", aug.iconPath);
    return large === small ? [small] : [large, small];
  }, [aug?.iconPath]);

  useEffect(() => {
    setAttempt(0);
    setFallback(null);
    setLookedUp(false);
  }, [sources]);

  // Augments Riot has cut keep their name and rarity on "latest" but lose their
  // art, so once the live paths 404 ask the main process to dig the icon out of
  // an archived patch branch.
  const exhausted = sources.length === 0 || attempt >= sources.length;
  useEffect(() => {
    if (!exhausted || lookedUp) return;
    let active = true;
    lookupFallbackIcon(augmentId, patch).then((url) => {
      if (!active) return;
      setFallback(url);
      setLookedUp(true);
    });
    return () => {
      active = false;
    };
  }, [exhausted, lookedUp, augmentId, patch]);

  const name = aug?.name || `Augment ${augmentId}`;
  const borderClass = rarityBorder[aug?.rarity ?? ""] || "";
  const nameColor = rarityTextColor[aug?.rarity ?? ""] || "text-lol-text-bright";
  const src = sources[attempt] ?? fallback;

  return (
    <div className="flex items-center gap-1.5 min-w-0" title={name}>
      {src ? (
        <img
          key={src}
          src={src}
          alt={name}
          width={size}
          height={size}
          className={`rounded shrink-0 ${borderClass}`}
          onError={() => {
            // Step down the live paths first; a failed fallback has nothing
            // left to try, so drop to the placeholder.
            if (attempt < sources.length) setAttempt((a) => a + 1);
            else setFallback(null);
          }}
        />
      ) : (
        // Keeps the rarity ring and the hover tooltip so an augment with no art
        // anywhere still reads as an augment rather than a gap in the row.
        <div
          className={`rounded shrink-0 bg-white/5 border border-white/10 ${borderClass}`}
          style={{ width: size, height: size }}
        />
      )}
      {showName && <span className={`text-xs truncate ${nameColor}`}>{name}</span>}
    </div>
  );
}
