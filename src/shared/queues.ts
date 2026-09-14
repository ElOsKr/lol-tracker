export const QUEUE_ID_MAYHEM = 2400;
export const QUEUE_ID_MAYHEM_CLASSIC = 2450;
export const QUEUE_ID_ARAM = 450;

export const MAYHEM_QUEUE_IDS = [QUEUE_ID_MAYHEM, QUEUE_ID_MAYHEM_CLASSIC];
export const TRACKED_QUEUE_IDS = [QUEUE_ID_ARAM, ...MAYHEM_QUEUE_IDS];
export const CAPTURE_POLICY_VERSION = "aram-v1";

export function isTrackedQueue(queue: unknown): queue is number {
  return typeof queue === "number" && TRACKED_QUEUE_IDS.includes(queue);
}

export const QUEUE_LABELS: Record<number, string> = {
  [QUEUE_ID_ARAM]: "ARAM normal",
  [QUEUE_ID_MAYHEM]: "ARAM Mayhem",
  [QUEUE_ID_MAYHEM_CLASSIC]: "Mayhem Classic",
};

// Four picked at level breakpoints, plus up to two bonus slots for special augments
export const AUGMENT_SLOTS = 6;
