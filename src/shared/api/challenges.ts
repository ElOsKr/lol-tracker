// Los desafíos de Riot y su progreso.
//
// Parte del contrato IPC: todo lo de aquí cruza el puente.

import type { ChallengeLevel } from "../challenges";

export interface ChallengeReward {
  // CHALLENGE_POINTS, TITLE, SUMMONER_ICON, whatever the tier hands out
  category: string;
  name: string;
  quantity: number;
}

export interface ChallengeProgress {
  id: number;
  name: string;
  description: string;
  level: ChallengeLevel;
  value: number;
  // Where the current tier started, so a bar can span tier to tier rather than
  // always measuring from zero
  currentThreshold: number;
  // Both null once the top tier is reached
  nextLevel: ChallengeLevel | null;
  nextThreshold: number | null;
  // What reaching nextLevel pays out, empty at the top
  nextRewards: ChallengeReward[];
  // Riot's ladder position, 0-100, where lower is better. Meaningless before
  // the challenge is started.
  percentile: number;
  pointsAwarded: number;
  // Game-data path to the token for the current tier, or the IRON token while
  // the challenge is unstarted
  iconPath: string;
  // Challenges from a past season: progress is frozen, kept for the record
  retired: boolean;
  // Set only for the challenges scored per champion, where the client tells us
  // exactly which ones are done
  completedChampionIds: number[] | null;
  // Gained since the baseline snapshot, null until there is one
  delta: number | null;
}

export interface ChallengeGroup {
  // The group's own node (ARAM Warrior and friends), which levels off the
  // progress of everything under it
  summary: ChallengeProgress;
  challenges: ChallengeProgress[];
}

export interface ChallengePlayerSummary {
  level: ChallengeLevel;
  points: number;
  pointsUntilNextRank: number;
  percentile: number;
  title: string;
}

export interface ChallengesData {
  player: ChallengePlayerSummary;
  // ARAM Authority. Null only if Riot retires the capstone out from under us.
  capstone: ChallengeProgress | null;
  groups: ChallengeGroup[];
  // ARAM challenges outside the capstone tree, newest first. Today they are all
  // past seasons and carry `retired`; a live one Riot adds later lands here too.
  seasonal: ChallengeProgress[];
  // The three tokens shown on the player's profile, ARAM or not
  equipped: ChallengeProgress[];
  fetchedAt: number;
  // The day deltas are measured from, null until a second day's snapshot exists
  since: string | null;
}

export interface ChallengesResult {
  data: ChallengesData | null;
  // A live read is in flight and will arrive over onChallengesChanged. Lets a
  // first-ever load tell "still asking" from "the client isn't running".
  pending: boolean;
}
