// Storage for the lobby's ranks: what each player in a game was ranked when
// the app first saw that game.
//
// These live in their own table rather than as columns on match_participants
// for two reasons. A player holds several ranks at once (solo and flex), so
// one row per participant would not fit them; and match_participants is wiped
// and rewritten whenever a game is repaired or re-ingested, which would throw
// away a snapshot that can never be taken again.

import { db } from "./connection";
import type { PlayerRank, RankDivision, RankTier } from "../../shared/ranks";

export interface ParticipantRank {
  participantId: number;
  puuid: string;
  rank: PlayerRank;
}

export function getGameForRanks(gameId: number): { gameCreation: number; queueId: number } | null {
  const row = db
    .prepare("SELECT game_creation, queue_id FROM games WHERE game_id = ?")
    .get(gameId) as { game_creation: number; queue_id: number } | undefined;
  return row ? { gameCreation: row.game_creation, queueId: row.queue_id } : null;
}

export function getParticipantPuuids(
  gameId: number,
): { participantId: number; puuid: string | null }[] {
  const rows = db
    .prepare(
      "SELECT participant_id, puuid FROM match_participants WHERE game_id = ? ORDER BY participant_id",
    )
    .all(gameId) as { participant_id: number; puuid: string | null }[];
  return rows.map((r) => ({ participantId: r.participant_id, puuid: r.puuid }));
}

/**
 * Whether this game has already been asked about. A game whose players were
 * all unranked leaves no rows, so the question is recorded separately in
 * `game_ranks_taken` — otherwise every launch would re-ask about the same
 * unranked ARAM lobby forever.
 */
export function hasGameRanks(gameId: number): boolean {
  const row = db.prepare("SELECT 1 FROM game_ranks_taken WHERE game_id = ?").get(gameId);
  return row != null;
}

export function saveGameRanks(gameId: number, rows: ParticipantRank[]): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO match_participant_ranks
      (game_id, participant_id, puuid, queue_type, tier, division, lp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const mark = db.prepare("INSERT OR REPLACE INTO game_ranks_taken (game_id) VALUES (?)");
  const tx = db.transaction(() => {
    for (const row of rows) {
      insert.run(
        gameId,
        row.participantId,
        row.puuid,
        row.rank.queueType,
        row.rank.tier,
        row.rank.division,
        Math.round(row.rank.lp),
      );
    }
    mark.run(gameId);
  });
  tx();
}

/** Every stored rank for a game, grouped by participant. */
export function getGameRanks(gameId: number): Map<number, PlayerRank[]> {
  const rows = db
    .prepare(`
      SELECT participant_id, queue_type, tier, division, lp
      FROM match_participant_ranks
      WHERE game_id = ?
    `)
    .all(gameId) as {
    participant_id: number;
    queue_type: string;
    tier: string;
    division: string | null;
    lp: number;
  }[];

  const byParticipant = new Map<number, PlayerRank[]>();
  for (const row of rows) {
    const list = byParticipant.get(row.participant_id) ?? [];
    list.push({
      tier: row.tier as RankTier,
      division: (row.division as RankDivision | null) ?? null,
      lp: row.lp,
      queueType: row.queue_type,
    });
    byParticipant.set(row.participant_id, list);
  }
  return byParticipant;
}
