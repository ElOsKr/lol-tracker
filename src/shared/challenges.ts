// Riot's challenge ladder, lowest tier first. NONE sits outside it: it means
// the challenge hasn't been started, not that it sits below IRON.
export const CHALLENGE_LEVELS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

export type ChallengeLevel = (typeof CHALLENGE_LEVELS)[number] | "NONE";

// The game modes that earn ARAM challenge progress. Mayhem is its own queue and
// its own mode, but the challenges count it: queue 2400 reports KIWI, 2450
// reports KIWI_JADE, and every challenge under ARAM Authority lists all three
// alongside ARAM. That is what makes these challenges worth a tab here: the
// games this app already tracks are the games feeding them.
export const ARAM_GAME_MODES = ["ARAM", "KIWI", "KIWI_JADE"];

// ARAM Authority and the three groups under it. Named rather than discovered
// because the tree's own nodes carry no gameModes, only the leaves are tagged.
export const ARAM_CAPSTONE_ID = 101000;
export const ARAM_GROUP_IDS = [101100, 101200, 101300];

// "All Random All Champions": earn an S- or better on a champion you haven't
// before. Named because a game that moves it is a game that earned a first S-
// on whatever was played, which is worth calling out in the recap.
export const ARAM_S_GRADE_CHALLENGE_ID = 101301;

// How far back a progress delta reaches. Snapshots are daily, so this is the
// number of days ago the baseline is taken from.
export const CHALLENGE_DELTA_DAYS = 7;

// Snapshots are bucketed by local day: "what did I gain this week" is a
// question about the player's calendar, not UTC's.
export function challengeDay(ts: number = Date.now()): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function daysBefore(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return challengeDay(new Date(year, month - 1, date - days).getTime());
}

/**
 * How far a challenge has come through its current tier, 0 to 1.
 *
 * Measured from the tier's own floor rather than from zero, which is what makes
 * a bar mean the same thing at IRON and at GRANDMASTER. A challenge with no
 * next tier is finished, so it reads as full.
 */
export function challengeFraction(
  value: number,
  currentThreshold: number,
  nextThreshold: number | null,
): number {
  if (nextThreshold == null) return 1;
  const span = nextThreshold - currentThreshold;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (value - currentThreshold) / span));
}
