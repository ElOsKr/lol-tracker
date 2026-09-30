import type { MatchTimeline, TimelineFrame, TimelineKill } from "../../shared/match-timeline";
import { mapSpan } from "../../shared/match-timeline";
import { db } from "./connection";
import { unpackRaw } from "./payloads";
import { getTimeline } from "./timelines";

// Turns a stored timeline into the two shapes the detail page draws: a frame
// a minute with everyone's gold, and every kill with where it happened.
//
// The whole timeline is 30–80 KB of JSON with far more in it than the page
// uses, so it is unpicked here rather than sent across and unpicked twice.

const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

// Data Dragon is the only place that serves a minimap for both maps: the
// game-data plugin has the Abyss but not the Rift. It keeps them on every
// version, so the picture follows whatever patch the champion art came from.
// Only the maps whose coordinates we know how to place a dot on; Data Dragon
// has pictures of others, but a dot on a map we have not measured would be a
// guess drawn as a fact.
const MAPPED = [11, 12];

function minimapUrl(mapId: number | null, dataVersion: string | null): string | null {
  if (mapId == null || !MAPPED.includes(mapId)) return null;
  if (!dataVersion || dataVersion === "none") return null;
  return `https://ddragon.leagueoflegends.com/cdn/${dataVersion}/img/map/map${mapId}.png`;
}

export function getMatchTimeline(gameId: number, dataVersion: string | null): MatchTimeline | null {
  const timeline = getTimeline(gameId) as any;
  if (!timeline || !Array.isArray(timeline.frames)) return null;

  const row = db.prepare("SELECT raw_gz FROM games WHERE game_id = ?").get(gameId) as
    | { raw_gz: Buffer | null }
    | undefined;
  const raw = row ? unpackRaw(row.raw_gz) : null;
  const mapId = typeof raw?.mapId === "number" ? raw.mapId : null;

  const frames: TimelineFrame[] = [];
  const kills: TimelineKill[] = [];

  timeline.frames.forEach((frame: any, minute: number) => {
    const gold: Record<number, number> = {};
    for (const entry of Object.values(frame?.participantFrames ?? {}) as any[]) {
      const id = num(entry?.participantId);
      if (id > 0) gold[id] = num(entry?.totalGold);
    }
    let minuteKills = 0;
    for (const event of frame?.events ?? []) {
      if (event?.type !== "CHAMPION_KILL") continue;
      minuteKills++;
      // A kill with no position is a kill the map cannot place; the chart
      // still counts it.
      if (typeof event.position?.x !== "number") continue;
      kills.push({
        second: Math.round(num(event.timestamp) / 1000),
        x: num(event.position.x),
        y: num(event.position.y),
        killerId: num(event.killerId),
        victimId: num(event.victimId),
        assists: Array.isArray(event.assistingParticipantIds)
          ? event.assistingParticipantIds.map(num).filter((id: number) => id > 0)
          : [],
      });
    }
    frames.push({ minute, gold, kills: minuteKills });
  });

  return {
    gameId,
    mapId,
    minimapUrl: minimapUrl(mapId, dataVersion),
    span: mapSpan(mapId),
    frames,
    kills,
  };
}
