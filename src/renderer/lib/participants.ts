import type { MatchParticipantRecord } from "./types";
import type { PlayerRank } from "../../shared/ranks";

/**
 * A participant as the renderer uses one: the stored row plus whether it is
 * us.
 *
 * It lived in the IPC contract until v0.8.5, and it was the only shape there
 * that never crossed the bridge — nothing in the main process produces one.
 * It belongs beside the function that builds it.
 */
export interface ParsedParticipant {
  // Carried over from MatchParticipantRecord, which the live scoreboard has
  // no equivalent of: a live game has no stored snapshot to show.
  rank?: PlayerRank | null;
  placement?: number | null;
  cs?: number | null;
  vision?: number | null;
  position?: string | null;
  participantId: number;
  championId: number;
  teamId: number;
  puuid: string | null;
  summonerName: string;
  kills: number;
  deaths: number;
  assists: number;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  goldEarned: number;
  totalHeal: number;
  largestKillingSpree: number;
  spell1Id: number | null;
  spell2Id: number | null;
  items: number[];
  augments: number[];
  win: boolean;
  isSelf: boolean;
}

// The main process sends participants already unpicked from the match payload,
// so all that's left is marking which rows are ours.
export function parseParticipants(
  participants: MatchParticipantRecord[] | undefined,
  selfPuuids: string[] | null,
): ParsedParticipant[] {
  if (!participants) return [];

  return participants.map((p) => ({
    ...p,
    summonerName: p.gameName || `Player ${p.participantId}`,
    isSelf: selfPuuids != null && p.puuid != null && selfPuuids.includes(p.puuid),
  }));
}

export function groupByTeam(participants: ParsedParticipant[]): Map<number, ParsedParticipant[]> {
  const teams = new Map<number, ParsedParticipant[]>();
  for (const p of participants) {
    if (!teams.has(p.teamId)) teams.set(p.teamId, []);
    teams.get(p.teamId)!.push(p);
  }
  return teams;
}
