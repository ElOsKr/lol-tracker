import { QUEUE_CATALOG } from "./queue-catalog";
export { QUEUE_CATALOG } from "./queue-catalog";
export const QUEUE_ID_MAYHEM = 2400;
export const QUEUE_ID_MAYHEM_CLASSIC = 2450;
export const QUEUE_ID_ARAM = 450;

export const MAYHEM_QUEUE_IDS = [QUEUE_ID_MAYHEM, QUEUE_ID_MAYHEM_CLASSIC];

/**
 * The queues the score covers: ARAM Caos and nothing else.
 *
 * Mayhem v4 was calibrated on ARAM Caos lobbies — augments included — so it
 * is the only mode whose numbers it was ever fitted to. It used to be given
 * to plain ARAM as well, which looked harmless because both are the Abyss,
 * but a mode with augments and one without do not share a damage curve, and
 * a number nobody calibrated is a number nobody should trust.
 *
 * Taken from the catalog rather than listed by hand, so a Caos queue Riot
 * adds next season is covered the day it appears. Riot spells the mode KIWI,
 * and its Classic variant KIWI_JADE.
 */
const SCORED_MODES = ["KIWI", "KIWI_JADE"];
const SCORED_QUEUE_IDS = new Set(
  QUEUE_CATALOG.filter((queue) => SCORED_MODES.includes(queue.mode)).map((queue) => queue.id),
);

// Bumped when the set of scored queues changes, not just the formula: it is
// what makes startup clear the scores of a queue that no longer qualifies.
export const SCORE_POLICY_VERSION = "mayhem-v4-aram-caos-only";

export function hasScore(queue: number): boolean {
  return SCORED_QUEUE_IDS.has(queue);
}
export const TRACKED_QUEUE_IDS: number[] = QUEUE_CATALOG.map((q) => q.id);
export const CAPTURE_POLICY_VERSION = "lol-v1";

export function isTrackedQueue(queue: unknown): queue is number {
  return typeof queue === "number" && TRACKED_QUEUE_IDS.includes(queue);
}

export const QUEUE_LABELS: Record<number, string> = {
  ...Object.fromEntries(QUEUE_CATALOG.map((q) => [q.id, q.label])),
  [QUEUE_ID_ARAM]: "ARAM normal",
  [QUEUE_ID_MAYHEM]: "ARAM Mayhem",
  [QUEUE_ID_MAYHEM_CLASSIC]: "Mayhem Classic",
};

// Four picked at level breakpoints, plus up to two bonus slots for special augments
export const AUGMENT_SLOTS = 6;

export function isArenaQueue(queue: number): boolean {
  return (
    [1700, 1710].includes(queue) || QUEUE_CATALOG.some((q) => q.id === queue && q.mode === "CHERRY")
  );
}
export function hasAugments(queue: number): boolean {
  return MAYHEM_QUEUE_IDS.includes(queue);
}
