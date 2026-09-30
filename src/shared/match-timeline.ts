/**
 * A game minute by minute, and every kill on the map.
 *
 * Built from the timelines captured in v0.7.9 — one frame a minute with each
 * player's gold, plus a kill event with coordinates. Two blocks read it: the
 * chart of how the game went, and the map of where people died.
 */

export interface TimelineFrame {
  /** Minutes since the game started; the first frame is 0. */
  minute: number;
  /** Total gold so far, by participant id. */
  gold: Record<number, number>;
  /** Champion kills that happened during this minute. */
  kills: number;
}

export interface TimelineKill {
  /** Seconds since the game started. */
  second: number;
  x: number;
  y: number;
  killerId: number;
  victimId: number;
  assists: number[];
}

export interface MatchTimeline {
  gameId: number;
  mapId: number | null;
  /**
   * The minimap to draw the kills on, or null for a map with no picture.
   * Built in the main process, which is the side that knows which Data Dragon
   * version the rest of the art comes from.
   */
  minimapUrl: string | null;
  /** How far the map's coordinates reach, for placing a kill on the picture. */
  span: number;
  frames: TimelineFrame[];
  kills: TimelineKill[];
}

/**
 * How far each map's coordinates run.
 *
 * Measured from the stored games rather than taken from a wiki: across the
 * library no position on the Abyss exceeds 12,246 and none on the Rift
 * exceeds 14,673, which matches the bounds Riot uses for each. A map nobody
 * has played yet falls back to the Rift's, which is the larger of the two and
 * so pulls dots inwards rather than off the edge.
 */
export const MAP_SPANS: Record<number, number> = {
  11: 14870, // Grieta del Invocador
  12: 12850, // Abismo de los Lamentos
};

export const DEFAULT_MAP_SPAN = 14870;

export function mapSpan(mapId: number | null | undefined): number {
  return (mapId != null && MAP_SPANS[mapId]) || DEFAULT_MAP_SPAN;
}

/** Where a kill goes on the picture, in percentages from the top left. */
export function dotPosition(kill: { x: number; y: number }, span: number) {
  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  return {
    // The game's y grows north and the screen's grows down, so it flips.
    left: clamp((kill.x / span) * 100),
    top: clamp(100 - (kill.y / span) * 100),
  };
}

/**
 * The gold lead, minute by minute, **from your side**.
 *
 * Positive means your team is ahead. Riot reports the teams in a fixed order
 * and the blue side is not always yours, so a chart drawn from the payload's
 * order would read backwards in half the games.
 */
export function goldSwing(
  frames: readonly TimelineFrame[],
  teamOf: (participantId: number) => number | undefined,
  ownTeam: number,
): number[] {
  return frames.map((frame) => {
    let mine = 0;
    let theirs = 0;
    for (const [id, gold] of Object.entries(frame.gold)) {
      if (teamOf(Number(id)) === ownTeam) mine += gold;
      else theirs += gold;
    }
    return mine - theirs;
  });
}

/** Your own gold against what the ten averaged, minute by minute. */
export function ownVersusAverage(
  frames: readonly TimelineFrame[],
  ownId: number | null,
): { own: number[]; average: number[] } {
  const own: number[] = [];
  const average: number[] = [];
  for (const frame of frames) {
    const all = Object.values(frame.gold);
    const total = all.reduce((sum, gold) => sum + gold, 0);
    average.push(all.length > 0 ? Math.round(total / all.length) : 0);
    own.push(ownId != null ? (frame.gold[ownId] ?? 0) : 0);
  }
  return { own, average };
}

/**
 * The scale a set of bars shares.
 *
 * Never zero: a game where nothing happened would otherwise divide by it and
 * draw every bar full instead of empty.
 */
export function peakOf(values: readonly number[]): number {
  let peak = 0;
  for (const value of values) {
    const size = Math.abs(value);
    if (size > peak) peak = size;
  }
  return peak || 1;
}

/** The minute where the gap was widest, and how wide. Null while it is flat. */
export function worstMoment(swing: readonly number[]): { minute: number; gap: number } | null {
  let minute = -1;
  let gap = 0;
  swing.forEach((value, index) => {
    if (value < gap) {
      gap = value;
      minute = index;
    }
  });
  return minute < 0 ? null : { minute, gap };
}

/** Only worth drawing when there is more than the opening frame. */
export const MIN_TIMELINE_FRAMES = 2;

export function hasChart(timeline: MatchTimeline | null | undefined): boolean {
  return timeline != null && timeline.frames.length >= MIN_TIMELINE_FRAMES;
}

export function hasMap(timeline: MatchTimeline | null | undefined): boolean {
  return timeline != null && timeline.minimapUrl != null && timeline.kills.length > 0;
}
