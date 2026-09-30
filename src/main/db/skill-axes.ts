import {
  ALL_AXES,
  axesFor,
  axisValues,
  canCompareTrend,
  meaningfulShift,
  percentileAmong,
  summarize,
  TREND_WINDOW,
  MIN_CHAMPION_GAMES,
  type AxisInput,
  type AxisKey,
  type AxisTrend,
  type ChampionAxes,
  type SkillAxes,
} from "../../shared/skill-axes";
import { participantModeFields } from "../../shared/match-mode";
import { db } from "./connection";
import { applyQueueFilter } from "./filters";
import { unpackRaw } from "./payloads";

// Turning a library into a profile.
//
// Three of the eight axes — crowd control, mitigated damage and wards — live
// only in the stored payload, so this reads the blobs rather than the
// participant table. Measured on the real library that is 111 ms for a
// thousand games, which is a page that opens rather than a page that waits,
// so nothing is denormalized for it. If it ever stops being cheap, the fix is
// a table of per-game axis values, not a cache.

const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** Games too short to say anything: a four-minute game is not a performance. */
const MIN_DURATION_SECONDS = 300;

interface GameAxes {
  championId: number;
  /** Percentile per axis, only for the axes this game had. */
  values: Partial<Record<AxisKey, number>>;
}

function inputFor(participant: any, teamKills: number, minutes: number): AxisInput {
  const s = participant.stats || participant;
  return {
    kills: num(s.kills),
    assists: num(s.assists),
    teamKills,
    deaths: num(s.deaths),
    damageToChampions: num(s.totalDamageDealtToChampions),
    damageTaken: num(s.totalDamageTaken),
    selfMitigated: num(s.damageSelfMitigated),
    ccTime: num(s.timeCCingOthers),
    gold: num(s.goldEarned),
    wardsPlaced: num(s.wardsPlaced),
    wardsKilled: num(s.wardsKilled),
    cs: num(s.totalMinionsKilled) + num(s.neutralMinionsKilled),
    neutralCs: num(s.neutralMinionsKilled),
    minutes,
  };
}

/** One game's axes for the account's own player, or null if it can't speak. */
function gameAxes(raw: any, ownPuuids: Set<string>, duration: number): GameAxes | null {
  const participants = raw?.participants;
  if (!Array.isArray(participants) || participants.length < 2) return null;
  const identities = raw.participantIdentities || [];

  const puuidOf = (p: any, index: number): string | null => {
    const identity =
      identities.find((i: any) => i.participantId === (p.participantId ?? index + 1)) ??
      identities[index];
    return p.puuid || identity?.player?.puuid || null;
  };

  let mineIndex = -1;
  const teamKills = new Map<number, number>();
  participants.forEach((p: any, index: number) => {
    const teamId = participantModeFields(raw, p, index).teamId;
    const s = p.stats || p;
    teamKills.set(teamId, (teamKills.get(teamId) ?? 0) + num(s.kills));
    const puuid = puuidOf(p, index);
    if (puuid && ownPuuids.has(puuid)) mineIndex = index;
  });
  if (mineIndex < 0) return null;

  const minutes = duration / 60;
  const lobby = participants.map((p: any, index: number) =>
    inputFor(p, teamKills.get(participantModeFields(raw, p, index).teamId) ?? 0, minutes),
  );
  const available = axesFor(lobby);
  const raws = lobby.map(axisValues);
  const mine = raws[mineIndex];

  const values: Partial<Record<AxisKey, number>> = {};
  for (const axis of available) {
    values[axis] = percentileAmong(
      raws.map((entry) => entry[axis]),
      mine[axis],
    );
  }

  const me = participants[mineIndex];
  return { championId: num(me.championId ?? me.stats?.championId), values };
}

export function getSkillAxes(queue?: number): SkillAxes {
  const ownPuuids = new Set(
    (db.prepare("SELECT puuid FROM summoner").all() as { puuid: string }[])
      .map((row) => row.puuid)
      .filter(Boolean),
  );

  const where = ["g.is_remake = 0", "g.raw_gz IS NOT NULL", "g.game_duration > ?"];
  const params: any[] = [MIN_DURATION_SECONDS];
  applyQueueFilter(where, params, queue);

  // Oldest first, so "the first two hundred" means the first two hundred.
  const rows = db
    .prepare(`
      SELECT g.game_duration AS duration, g.raw_gz
      FROM games g
      WHERE ${where.join(" AND ")}
      ORDER BY g.game_creation
    `)
    .all(...params) as { duration: number; raw_gz: Buffer }[];

  const games: GameAxes[] = [];
  for (const row of rows) {
    const parsed = gameAxes(unpackRaw(row.raw_gz), ownPuuids, row.duration);
    if (parsed) games.push(parsed);
  }

  const axes = ALL_AXES.filter((axis) => games.some((game) => game.values[axis] != null));

  const valuesOf = (axis: AxisKey, from: readonly GameAxes[]) =>
    from.map((game) => game.values[axis]).filter((value): value is number => value != null);

  const profile = axes.map((axis) => {
    const sample = summarize(valuesOf(axis, games));
    return { axis, percentile: sample.mean, games: sample.count };
  });

  const byChampion = new Map<number, GameAxes[]>();
  for (const game of games) {
    const list = byChampion.get(game.championId);
    if (list) list.push(game);
    else byChampion.set(game.championId, [game]);
  }

  const champions: ChampionAxes[] = [];
  for (const [championId, played] of byChampion) {
    if (played.length < MIN_CHAMPION_GAMES) continue;
    const values: Partial<Record<AxisKey, number>> = {};
    for (const axis of axes) {
      const sample = summarize(valuesOf(axis, played));
      // An axis only a handful of this champion's games had says nothing
      if (sample.count >= MIN_CHAMPION_GAMES) values[axis] = sample.mean;
    }
    champions.push({ championId, games: played.length, values });
  }
  champions.sort((a, b) => b.games - a.games);

  let trend: AxisTrend[] | null = null;
  if (canCompareTrend(games.length)) {
    const before = games.slice(0, TREND_WINDOW);
    const after = games.slice(-TREND_WINDOW);
    trend = axes.map((axis) => {
      const first = summarize(valuesOf(axis, before));
      const last = summarize(valuesOf(axis, after));
      return {
        axis,
        before: first.mean,
        after: last.mean,
        window: Math.min(first.count, last.count),
        meaningful: meaningfulShift(first, last),
      };
    });
  }

  return { games: games.length, axes, profile, champions, trend };
}
