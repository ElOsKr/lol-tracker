// A player's ranked standing, as the client reports it, plus the arithmetic
// for talking about a whole lobby's worth of them.
//
// What is stored is a snapshot: the rank each player held when the app saw the
// game, never updated afterwards. The client only ever answers "what is this
// player's rank now", so a game that was already old when the app first saw it
// gets no ranks at all rather than today's rank pinned to last spring.

import type { TranslationKey } from "./i18n";

// Bottom to top. The index is the tier's place on the ladder, which is what
// the arithmetic below is built on, so the order is load-bearing.
export const RANK_TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;
export type RankTier = (typeof RANK_TIERS)[number];

// Roman numerals, worst first, the way the ladder climbs: IV → I.
export const RANK_DIVISIONS = ["IV", "III", "II", "I"] as const;
export type RankDivision = (typeof RANK_DIVISIONS)[number];

// Master and above have no divisions: one pool, ordered by LP alone.
export const APEX_TIERS: readonly RankTier[] = ["MASTER", "GRANDMASTER", "CHALLENGER"];

export interface PlayerRank {
  tier: RankTier;
  // Null in the apex tiers, which have none
  division: RankDivision | null;
  lp: number;
  // Which ladder this came from, since a player can hold several
  queueType: string;
}

export const RANKED_SOLO = "RANKED_SOLO_5x5";
export const RANKED_FLEX = "RANKED_FLEX_SR";

// The ranked ladder a game itself belongs to. Every other queue — ARAM, normals,
// Arena — has none, and borrows the player's solo rank instead.
const QUEUE_LADDER: Record<number, string> = {
  420: RANKED_SOLO,
  440: RANKED_FLEX,
};

/**
 * Which of a player's ladders to show for a given game: the game's own when it
 * is a ranked queue, otherwise solo, otherwise flex. A blank or "NONE" tier is
 * the client's way of saying unranked and never survives this.
 */
/**
 * The division to show, which for Master and above is none.
 *
 * Those three tiers have no divisions — they are one pool ordered by LP — but
 * Riot reports them with "I" anyway, by a convention that keeps the field
 * populated. Taken at face value it puts a meaningless "I" next to every
 * Master, Grandmaster and Challenger on screen. This is where that is dropped,
 * so nothing downstream has to remember.
 */
export function effectiveDivision(rank: PlayerRank): RankDivision | null {
  return APEX_TIERS.includes(rank.tier) ? null : rank.division;
}

export function pickRank(entries: PlayerRank[], queueId: number): PlayerRank | null {
  const ladders = [QUEUE_LADDER[queueId], RANKED_SOLO, RANKED_FLEX].filter(Boolean) as string[];
  for (const ladder of ladders) {
    const hit = entries.find((e) => e.queueType === ladder);
    if (hit) return hit;
  }
  return null;
}

const TIER_SPAN = 400;
const DIVISION_SPAN = 100;

/**
 * A rank as a single number, so ranks can be compared and averaged.
 *
 * Each tier below Master is four divisions of 100 LP, which is exactly how the
 * ladder is built, so the scale is the real one rather than an invention.
 * Master, Grandmaster and Challenger share a base: they are not three ladders
 * but the top slice of one, separated by LP thresholds, so a Challenger on 900
 * LP sits 900 above a fresh Master — which is the truth.
 */
export function rankPoints(rank: PlayerRank): number {
  const tierIndex = RANK_TIERS.indexOf(rank.tier);
  if (tierIndex < 0) return 0;
  const base = Math.min(tierIndex, RANK_TIERS.indexOf("MASTER")) * TIER_SPAN;
  if (APEX_TIERS.includes(rank.tier)) return base + rank.lp;
  const division = rank.division ? RANK_DIVISIONS.indexOf(rank.division) : 0;
  return base + Math.max(0, division) * DIVISION_SPAN + rank.lp;
}

/** The inverse, for showing an average as a rank rather than as a number. */
export function pointsToRank(points: number): PlayerRank {
  const masterBase = RANK_TIERS.indexOf("MASTER") * TIER_SPAN;
  if (points >= masterBase) {
    return {
      tier: "MASTER",
      division: null,
      lp: Math.round(points - masterBase),
      queueType: "",
    };
  }
  const clamped = Math.max(0, points);
  const tierIndex = Math.floor(clamped / TIER_SPAN);
  const withinTier = clamped - tierIndex * TIER_SPAN;
  const divisionIndex = Math.min(RANK_DIVISIONS.length - 1, Math.floor(withinTier / DIVISION_SPAN));
  return {
    tier: RANK_TIERS[tierIndex],
    division: RANK_DIVISIONS[divisionIndex],
    lp: Math.round(withinTier - divisionIndex * DIVISION_SPAN),
    queueType: "",
  };
}

export interface LobbyRanks {
  /** Null unless more than half the lobby is ranked — see below. */
  average: PlayerRank | null;
  ranked: number;
  total: number;
}

/**
 * What can honestly be said about a lobby's ranks.
 *
 * The average is only offered when more than half the players have one.
 * Below that it would be the average of a handful of people presented as the
 * average of a game, which is a different and much weaker claim — and in ARAM
 * the handful is often two. Even above the line it is an approximation, which
 * is why `ranked` and `total` come with it: whatever shows the average is
 * expected to say what it was drawn from.
 */
export function summarizeLobbyRanks(ranks: (PlayerRank | null)[]): LobbyRanks {
  const present = ranks.filter((r): r is PlayerRank => r != null);
  const total = ranks.length;
  if (present.length * 2 <= total) {
    return { average: null, ranked: present.length, total };
  }
  const points = present.reduce((sum, r) => sum + rankPoints(r), 0) / present.length;
  return { average: pointsToRank(points), ranked: present.length, total };
}

const TIER_LABELS: Record<RankTier, TranslationKey> = {
  IRON: "rank.iron",
  BRONZE: "rank.bronze",
  SILVER: "rank.silver",
  GOLD: "rank.gold",
  PLATINUM: "rank.platinum",
  EMERALD: "rank.emerald",
  DIAMOND: "rank.diamond",
  MASTER: "rank.master",
  GRANDMASTER: "rank.grandmaster",
  CHALLENGER: "rank.challenger",
};

export function tierLabelKey(tier: RankTier): TranslationKey {
  return TIER_LABELS[tier];
}

/**
 * "Gold III", or "Master 245 LP" where there is no division to name. The
 * caller passes its own translator so this works on both sides of the bridge.
 */
export function formatRank(
  rank: PlayerRank,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const tier = t(tierLabelKey(rank.tier));
  const division = effectiveDivision(rank);
  if (division) return `${tier} ${division}`;
  return t("rank.tierLp", { tier, lp: Math.round(rank.lp) });
}
