/**
 * The extra numbers behind one game, and the rule for which of them a queue
 * actually has.
 *
 * Everything here comes out of the stored payload rather than out of a table:
 * the detail page is opened one game at a time and by hand, so parsing 30 KB
 * of JSON on the way is cheaper than carrying twenty more columns on every
 * participant row for the sake of a page nobody has open.
 *
 * The section rule is the whole point of the module. The Abyss has no bans, no
 * epic monsters and no wards, and the client answers those fields with zeros
 * rather than with nothing — so a page that trusted the fields would show ten
 * players with 0 vision and call it information. Each block asks whether the
 * game it is drawn for contains the thing it measures, and stays away when it
 * does not.
 */

/**
 * Where the page lives. Named once so the router, the link out of the
 * expanded row and the link back to the history can't drift apart — the black
 * window of v0.7.8 came from exactly that kind of hand-typed path.
 */
export const MATCH_DETAIL_PATH = "/match";

/** Damage split three ways, as the client reports it. */
export interface DamageSplit {
  physical: number;
  magic: number;
  /** Named `trueDamage` because `true` is a keyword. */
  trueDamage: number;
}

export function splitTotal(split: DamageSplit): number {
  return split.physical + split.magic + split.trueDamage;
}

/** One team's objectives. Fields a queue lacks arrive as zero, not as null. */
export interface MatchTeamStats {
  teamId: number;
  win: boolean;
  towers: number;
  inhibitors: number;
  dragons: number;
  barons: number;
  heralds: number;
  firstBlood: boolean;
  firstTower: boolean;
  firstInhibitor: boolean;
  firstBaron: boolean;
  firstDragon: boolean;
  /** Champion ids, in pick order. Empty outside draft queues. */
  bans: number[];
}

/** One player's row, keyed back to the scoreboard by `participantId`. */
export interface MatchPlayerExtras {
  participantId: number;
  championId: number;
  teamId: number;
  dealt: DamageSplit;
  taken: DamageSplit;
  selfMitigated: number;
  toObjectives: number;
  toTurrets: number;
  /** Seconds of crowd control applied to enemy champions. */
  ccTime: number;
  /** Seconds of the longest stretch spent alive. */
  longestAlive: number;
  champLevel: number;
  goldEarned: number;
  goldSpent: number;
  largestCrit: number;
  killingSprees: number;
  wardsPlaced: number;
  wardsKilled: number;
  controlWards: number;
  visionScore: number;
  /** Minions plus jungle camps. */
  cs: number;
  /** Jungle camps alone — the one field that tells a laned map from ARAM. */
  neutralCs: number;
  totalHeal: number;
}

export interface MatchExtras {
  gameId: number;
  teams: MatchTeamStats[];
  players: MatchPlayerExtras[];
}

/**
 * The blocks the page may draw for this game.
 *
 * Read as questions about the match rather than about the queue id: a mode
 * added later that happens to have dragons gets the dragons block without
 * anyone adding it to a list.
 */
export interface DetailSections {
  /** Somebody banned something. */
  bans: boolean;
  /** The map has dragons, barons or heralds — not just towers. */
  epics: boolean;
  /**
   * Somebody placed or cleared a ward.
   *
   * Deliberately not "somebody has a vision score": across 996 stored ARAM
   * games, 194 report a vision score for one or two players and not one of
   * them records a single ward placed or cleared. Whatever that score is
   * counting, it isn't vision control, and a block built on it would rank a
   * lobby by a number nine of them can't have earned.
   */
  vision: boolean;
  /**
   * Farm and gold per minute mean something here.
   *
   * ARAM hands everyone the same lane and no camps, and its per-minute farm
   * lands in the same range a real laner's does, so the numbers can't tell the
   * two apart — the jungle can.
   */
  economy: boolean;
  /** Anyone did damage to a turret, dragon, baron or camp. */
  objectiveDamage: boolean;
}

/**
 * Camps the busiest player must have taken before farm is worth comparing.
 *
 * Measured, not guessed: across the stored library the hardest-working jungler
 * in a queue that has a jungle took 32 camps in the shortest such game, while
 * the most any player took in a queue without one was 7. Twenty sits in the
 * gap with room on both sides.
 */
export const MIN_JUNGLE_CAMPS = 20;

export function detailSections(extras: MatchExtras): DetailSections {
  const players = extras.players;
  return {
    bans: extras.teams.some((team) => team.bans.length > 0),
    epics: extras.teams.some((team) => team.dragons + team.barons + team.heralds > 0),
    vision: players.some((p) => p.wardsPlaced + p.wardsKilled > 0),
    economy: maxOf(players, (p) => p.neutralCs) >= MIN_JUNGLE_CAMPS,
    objectiveDamage: players.some((p) => p.toObjectives > 0),
  };
}

/** The largest value of one measure across the lobby, for scaling a bar. */
export function maxOf<T>(rows: readonly T[], pick: (row: T) => number): number {
  let max = 0;
  for (const row of rows) {
    const value = pick(row);
    if (value > max) max = value;
  }
  return max;
}

/**
 * A bar's width as a percentage of the row it shares a scale with.
 *
 * Zero max means every bar is empty rather than every bar being full: a
 * section where nobody did anything should look like nobody did anything.
 */
export function barWidth(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}

export function perMinute(total: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return (total * 60) / durationSeconds;
}
