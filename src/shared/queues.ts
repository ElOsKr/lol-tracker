import { QUEUE_CATALOG } from "./queue-catalog";
export { QUEUE_CATALOG } from "./queue-catalog";
export const QUEUE_ID_MAYHEM = 2400;
export const QUEUE_ID_MAYHEM_CLASSIC = 2450;
export const QUEUE_ID_ARAM = 450;

export const MAYHEM_QUEUE_IDS = [QUEUE_ID_MAYHEM, QUEUE_ID_MAYHEM_CLASSIC];
// Version ARAM changes independently of the unchanged Mayhem v4 formula.
export const SCORE_POLICY_VERSION = "mayhem-v4-aram-experimental-v2";
export function hasScore(queue: number): boolean {
  return queue === QUEUE_ID_ARAM || MAYHEM_QUEUE_IDS.includes(queue);
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
