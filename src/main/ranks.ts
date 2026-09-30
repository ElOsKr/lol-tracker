// Asking the League client what rank the other nine players hold.
//
// The client answers for any player id, not just yours — this is the same
// endpoint its own post-game screen uses, and ten of them come back in a few
// milliseconds. There is no public API involved and nothing leaves the machine.
//
// What it cannot do is answer for the past: it reports a rank as it is now.
// So a rank is only worth storing while the game is fresh, and an old game
// imported from Riot's history gets none rather than getting today's rank
// presented as that day's — see RANK_MAX_AGE_MS.

import * as db from "./db";
import { APEX_TIERS, RANKED_FLEX, RANKED_SOLO, RANK_DIVISIONS, RANK_TIERS } from "../shared/ranks";
import type { PlayerRank, RankDivision, RankTier } from "../shared/ranks";

// How old a game may be and still have its players' ranks taken as that game's.
// Ranks move slowly, so this is generous enough to cover "played last night,
// opened the app this morning" while refusing a history import outright.
export const RANK_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Only these two ladders are worth asking about: the rest of a player's
// ranked-stats payload is queues nobody reads a rank off.
const LADDERS = new Set([RANKED_SOLO, RANKED_FLEX]);

const TIERS = new Set<string>(RANK_TIERS);
const DIVISIONS = new Set<string>(RANK_DIVISIONS);

/**
 * The ladders a player is actually placed on, out of the client's payload.
 *
 * Unplaced ladders come back with an empty or "NONE" tier and are dropped
 * here, so an empty array means unranked and the caller never has to know how
 * the client spells it.
 */
export function parseRankedStats(payload: any): PlayerRank[] {
  const queues = Array.isArray(payload?.queues) ? payload.queues : [];
  const out: PlayerRank[] = [];
  for (const q of queues) {
    const queueType = String(q?.queueType ?? "");
    if (!LADDERS.has(queueType)) continue;
    const tier = String(q?.tier ?? "").toUpperCase();
    if (!TIERS.has(tier)) continue;
    const division = String(q?.division ?? "").toUpperCase();
    // Apex tiers arrive carrying "I" and have no divisions, so it is dropped
    // here too: stored data should not need reinterpreting to be read.
    const apex = APEX_TIERS.includes(tier as RankTier);
    out.push({
      tier: tier as RankTier,
      division: !apex && DIVISIONS.has(division) ? (division as RankDivision) : null,
      lp: Number.isFinite(q?.leaguePoints) ? Number(q.leaguePoints) : 0,
      queueType,
    });
  }
  return out;
}

// The client query, handed in rather than imported: lcu.ts is what calls this
// module, so importing back into it would close a cycle. It also means the
// whole thing can be exercised without a League client anywhere near it.
export type LcuGet = (path: string) => Promise<any | null>;

async function fetchPlayerRanks(get: LcuGet, puuid: string): Promise<PlayerRank[]> {
  // The cached variant is what the client's own screens read and is markedly
  // faster; the live one is the fallback for a player it has not seen.
  const cached = await get(`/lol-ranked/v1/cached-ranked-stats/${puuid}`);
  const parsed = parseRankedStats(cached);
  if (parsed.length > 0) return parsed;
  return parseRankedStats(await get(`/lol-ranked/v1/ranked-stats/${puuid}`));
}

/**
 * Take and store the lobby's ranks for a game that has just been captured.
 *
 * Never throws and never blocks the capture on a slow client: a game with no
 * ranks is the ordinary case for anything older than RANK_MAX_AGE_MS, and it
 * simply shows no ranks rather than failing.
 */
export async function captureGameRanks(
  gameId: number,
  get: LcuGet,
  now = Date.now(),
): Promise<number> {
  try {
    const game = db.getGameForRanks(gameId);
    if (!game) return 0;
    if (now - game.gameCreation > RANK_MAX_AGE_MS) return 0;
    if (db.hasGameRanks(gameId)) return 0;

    const players = db.getParticipantPuuids(gameId).filter((p) => p.puuid);
    if (players.length === 0) return 0;

    const results = await Promise.all(
      players.map(async (p) => ({
        participantId: p.participantId,
        puuid: p.puuid as string,
        entries: await fetchPlayerRanks(get, p.puuid as string),
      })),
    );

    const rows = results.flatMap((r) =>
      r.entries.map((rank) => ({
        participantId: r.participantId,
        puuid: r.puuid,
        rank,
      })),
    );
    db.saveGameRanks(gameId, rows);
    const ranked = new Set(rows.map((r) => r.participantId)).size;
    console.log(`Stored ranks for ${ranked}/${players.length} players in game ${gameId}`);
    return ranked;
  } catch (err) {
    // A missing rank is cosmetic; a capture that fails because of one is not.
    console.log(`Could not read the lobby's ranks for game ${gameId}:`, err);
    return 0;
  }
}
