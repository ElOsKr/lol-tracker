import type { MatchExtras, MatchPlayerExtras, MatchTeamStats } from "../../shared/match-detail";
import { participantModeFields } from "../../shared/match-mode";
import { db } from "./connection";
import { unpackRaw } from "./payloads";

// The detail page's numbers, read out of the stored payload for one game.
//
// Nothing here is denormalized into a table. These twenty-odd fields per
// player exist to be looked at one game at a time, by hand, so the cost of
// having them is one gunzip on the way to a page somebody deliberately
// opened — against twenty more columns written on every ingest and carried by
// every backup for the sake of a page that is usually closed. If a list view
// ever needs to sort on one of them, that is the day to promote it.

const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

function teamFromRaw(raw: any): MatchTeamStats {
  const bans = Array.isArray(raw?.bans) ? raw.bans : [];
  return {
    teamId: num(raw?.teamId),
    // The LCU spells this "Win" / "Fail"; SGP sends a boolean.
    win: raw?.win === true || raw?.win === "Win",
    towers: num(raw?.towerKills),
    inhibitors: num(raw?.inhibitorKills),
    dragons: num(raw?.dragonKills),
    barons: num(raw?.baronKills),
    heralds: num(raw?.riftHeraldKills),
    firstBlood: raw?.firstBlood === true,
    firstTower: raw?.firstTower === true,
    firstInhibitor: raw?.firstInhibitor === true,
    firstBaron: raw?.firstBaron === true,
    firstDragon: raw?.firstDragon === true,
    bans: bans
      .map((ban: any) => num(ban?.championId))
      // A skipped ban is recorded as -1, which is not a champion.
      .filter((id: number) => id > 0),
  };
}

function playerFromRaw(raw: any, participant: any, index: number): MatchPlayerExtras {
  const s = participant.stats || participant;
  const mode = participantModeFields(raw, participant, index);
  return {
    participantId: mode.participantId,
    championId: num(participant.championId ?? s.championId),
    teamId: mode.teamId,
    dealt: {
      physical: num(s.physicalDamageDealtToChampions),
      magic: num(s.magicDamageDealtToChampions),
      trueDamage: num(s.trueDamageDealtToChampions),
    },
    taken: {
      physical: num(s.physicalDamageTaken),
      // Spelled differently on the way in than on the way out, in Riot's own payload.
      magic: num(s.magicalDamageTaken ?? s.magicDamageTaken),
      trueDamage: num(s.trueDamageTaken),
    },
    selfMitigated: num(s.damageSelfMitigated),
    toObjectives: num(s.damageDealtToObjectives),
    toTurrets: num(s.damageDealtToTurrets),
    ccTime: num(s.timeCCingOthers),
    longestAlive: num(s.longestTimeSpentLiving),
    champLevel: num(s.champLevel),
    goldEarned: num(s.goldEarned),
    goldSpent: num(s.goldSpent),
    largestCrit: num(s.largestCriticalStrike),
    killingSprees: num(s.killingSprees),
    wardsPlaced: num(s.wardsPlaced),
    wardsKilled: num(s.wardsKilled),
    controlWards: num(s.visionWardsBoughtInGame),
    visionScore: num(s.visionScore),
    cs: mode.cs ?? 0,
    neutralCs: num(s.neutralMinionsKilled),
    totalHeal: num(s.totalHeal),
  };
}

export function getMatchExtras(gameId: number): MatchExtras | null {
  const row = db.prepare("SELECT raw_gz FROM games WHERE game_id = ?").get(gameId) as
    | { raw_gz: Buffer | null }
    | undefined;
  if (!row) return null;
  const raw = unpackRaw(row.raw_gz);
  // A game imported before payloads were kept, or one whose blob won't parse,
  // has no detail to show. The page says so rather than drawing ten zeroes.
  if (!raw || !Array.isArray(raw.participants)) return null;

  return {
    gameId,
    teams: Array.isArray(raw.teams) ? raw.teams.map(teamFromRaw) : [],
    players: raw.participants.map((p: any, i: number) => playerFromRaw(raw, p, i)),
  };
}
