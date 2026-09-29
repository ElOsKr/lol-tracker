import type { TrendsData } from "./types";
import { formatPatch } from "./format";

// How the trends charts cut time into buckets, and where a patch begins among
// them. Kept out of the page because these are rules, not drawing.

export type Granularity = "month" | "week";

export interface Bucket {
  // The period this bucket stands for, in the form bucketKeyFor builds
  key: string;
  label: string;
  games: number;
  wins: number;
  scoreSum: number;
  scoredGames: number;
}

// A patch boundary: the bucket it opens, and the number to print.
export interface ChartMark {
  index: number;
  label: string;
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

/**
 * Which bucket a moment belongs to.
 *
 * One rule, used both to lay the buckets out and to place the patch marks, so
 * the two can never disagree about where a week starts.
 */
export function bucketKeyFor(date: Date, granularity: Granularity): string {
  if (granularity === "month") return dayKey(date).slice(0, 7);
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dayKey(monday);
}

/**
 * Where each patch begins, as a mark on the chart.
 *
 * Only patches the player actually played: the list comes from their games and
 * not from Riot's calendar, so a patch they sat out has no mark. Several
 * patches inside one bucket leave one mark carrying the last of them, because
 * two lines a pixel apart say nothing one line cannot.
 */
export function patchMarks(
  buckets: Bucket[],
  patches: TrendsData["patches"],
  granularity: Granularity,
): ChartMark[] {
  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));
  const byIndex = new Map<number, string>();
  for (const patch of patches) {
    const index = indexByKey.get(bucketKeyFor(new Date(patch.first_played), granularity));
    // A patch that opens the chart needs no mark: the chart already starts
    // there and the line would sit on the axis.
    if (index == null || index === 0) continue;
    byIndex.set(index, formatPatch(patch.patch));
  }
  return [...byIndex.entries()]
    .map(([index, label]) => ({ index, label }))
    .sort((a, b) => a.index - b.index);
}

// How much room a patch number needs before the next one may be printed. The
// line is always drawn; only the label gives way.
export const MARK_LABEL_GAP = 42;

export interface PlacedMark extends ChartMark {
  x: number;
  labelled: boolean;
}

/**
 * The marks at their pixel positions, each saying whether its number fits.
 *
 * A mark sits on the left edge of its bucket, not in the middle: what it means
 * is "from here on, another patch". Where two fall too close together the
 * second keeps its line and loses its number, which is the part that would
 * have overlapped.
 */
export function placeMarks(
  marks: ChartMark[],
  left: number,
  step: number,
  minGap: number = MARK_LABEL_GAP,
): PlacedMark[] {
  const placed: PlacedMark[] = [];
  let lastLabelX = -Infinity;
  for (const mark of marks) {
    const x = left + step * mark.index;
    const labelled = x - lastLabelX >= minGap;
    if (labelled) lastLabelX = x;
    placed.push({ ...mark, x, labelled });
  }
  return placed;
}
