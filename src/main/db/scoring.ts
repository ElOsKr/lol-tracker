import {
  SCORE_FORMULA_VERSION,
  type ScoreInput,
  type PlayerScore,
  computeMatchScores,
  rankByRaw,
} from "../../shared/opScore";
import { hasScore, SCORE_POLICY_VERSION } from "../../shared/queues";
import { getChampionDataVersion, getChampionClasses } from "../dragon";
import { db } from "./connection";
import { getSetting, setSetting } from "./settings";

// Score backfills are keyed on formula version + champion data version, so
// stored scores recompute when either changes (new formula, new patch,
// re-tagged champion).
// Bumped when what is stored alongside a score changes shape, so the same
// backfill that recomputes scores fills the new columns for old games too.
const STANDING_VERSION = "rank1";

export function scoreFormulaKey() {
  return `${SCORE_FORMULA_VERSION}@${getChampionDataVersion()}:${SCORE_POLICY_VERSION}+${STANDING_VERSION}`;
}

// Recompute stored scores from the participant rows. Runs whenever the formula version or
// the champion class data changes (new patch, re-tagged champion) so stored
// scores never go stale. Call after champion data has loaded; returns whether
// a backfill ran so the caller can refresh the renderer.
export function checkScoreBackfill(): boolean {
  if (getSetting("score_formula_version") === scoreFormulaKey()) return false;
  backfillScores();
  setSetting("score_formula_version", scoreFormulaKey());
  return true;
}

// Scoring grades a player against the other nine, so it always works on a whole
// game's worth of participant rows.
export interface ScoreRow {
  participant_id: number;
  puuid: string | null;
  team_id: number;
  champion_id: number;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  double_kills: number;
  triple_kills: number;
  quadra_kills: number;
  penta_kills: number;
  total_damage_dealt: number;
  total_damage_taken: number;
  gold_earned: number;
  total_heal: number;
}

export const SCORE_ROW_COLUMNS = `participant_id, puuid, team_id, champion_id, win,
       kills, deaths, assists, double_kills, triple_kills, quadra_kills, penta_kills,
       total_damage_dealt, total_damage_taken, gold_earned, total_heal`;

export function scoreInputsFromRows(rows: ScoreRow[]): (ScoreInput & { puuid: string | null })[] {
  return rows.map((r) => ({
    participantId: r.participant_id,
    teamId: r.team_id,
    puuid: r.puuid,
    championId: r.champion_id,
    kills: r.kills,
    deaths: r.deaths,
    assists: r.assists,
    doubleKills: r.double_kills,
    tripleKills: r.triple_kills,
    quadraKills: r.quadra_kills,
    pentaKills: r.penta_kills,
    totalDamageDealtToChampions: r.total_damage_dealt,
    totalDamageTaken: r.total_damage_taken,
    goldEarned: r.gold_earned,
    totalHeal: r.total_heal,
    win: r.win === 1,
  }));
}

// Groups flat participant rows spanning many games back into per-game lists,
// so a whole-library rescore is one query rather than one per game.
export function groupByGame<T extends { game_id: number }>(rows: T[]): Map<number, T[]> {
  const byGame = new Map<number, T[]>();
  for (const row of rows) {
    const list = byGame.get(row.game_id);
    if (list) list.push(row);
    else byGame.set(row.game_id, [row]);
  }
  return byGame;
}

/** Where the player finished among everyone the game scored, and out of how many. */
export interface OwnerStanding {
  score: PlayerScore;
  // 1 is the best game of the ten. Ties share a place, so two players who
  // scored the same are both second and nobody is third.
  rank: number;
  total: number;
}

export function computeOwnerStanding(
  participants: ScoreRow[],
  ownerPuuid: string | null,
  queueId: number,
  fallback?: { champion_id: number; kills: number; deaths: number; assists: number },
): OwnerStanding | null {
  const inputs = scoreInputsFromRows(participants);
  if (inputs.length === 0) return null;
  let owner = ownerPuuid ? inputs.find((p) => p.puuid === ownerPuuid) : undefined;
  if (!owner && fallback) {
    owner = inputs.find(
      (p) =>
        p.championId === fallback.champion_id &&
        p.kills === fallback.kills &&
        p.deaths === fallback.deaths &&
        p.assists === fallback.assists,
    );
  }
  if (!owner) return null;

  const scores = computeMatchScores(inputs, getChampionClasses());
  const score = scores.get(owner.participantId);
  if (!score) return null;

  const rank = rankByRaw(scores).get(owner.participantId);
  if (rank == null) return null;
  return { score, rank, total: scores.size };
}

function backfillScores() {
  const games = db
    .prepare(`
      SELECT g.game_id, g.puuid, g.queue_id, g.is_remake,
             ps.champion_id, ps.kills, ps.deaths, ps.assists
      FROM games g
      JOIN player_stats ps ON g.game_id = ps.game_id
    `)
    .all() as {
    game_id: number;
    puuid: string;
    queue_id: number;
    is_remake: number;
    champion_id: number;
    kills: number;
    deaths: number;
    assists: number;
  }[];

  const participants = groupByGame(
    db
      .prepare(`SELECT game_id, ${SCORE_ROW_COLUMNS} FROM match_participants`)
      .all() as (ScoreRow & { game_id: number })[],
  );

  const updateStmt = db.prepare(
    `UPDATE player_stats
       SET score = ?, score_raw = ?, score_badge = ?, score_rank = ?, score_rank_total = ?
     WHERE game_id = ?`,
  );
  const tx = db.transaction(() => {
    for (const row of games) {
      if (row.is_remake || !hasScore(row.queue_id)) {
        updateStmt.run(null, null, null, null, null, row.game_id);
        continue;
      }
      const standing = computeOwnerStanding(
        participants.get(row.game_id) ?? [],
        row.puuid || null,
        row.queue_id,
        row,
      );
      updateStmt.run(
        standing?.score.score ?? null,
        standing?.score.raw ?? null,
        standing?.score.badge ?? null,
        standing?.rank ?? null,
        standing?.total ?? null,
        row.game_id,
      );
    }
  });
  tx();
}
