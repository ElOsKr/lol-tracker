// La partida en curso, leída del puerto 2999 mientras se juega.
//
// Parte del contrato IPC: todo lo de aquí cruza el puente.

import type { SharedRecord } from "../tags";
import type { PlayerRecord } from "./stats";

export type LcuStatus = "disconnected" | "connecting" | "connected" | "ingame";

export interface LivePlayer {
  // Stable across polls, so React keys and the record cache both hold: the
  // puuid when the client gives us one, otherwise the riot id.
  key: string;
  name: string;
  tagLine: string | null;
  puuid: string | null;
  // 0 when the champion could not be resolved to an id, which only leaves the
  // name to go on
  championId: number;
  championName: string;
  teamId: number;
  isSelf: boolean;
  isBot: boolean;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  creepScore: number;
  // Seven slots, trinket last; 0 for an empty one
  items: number[];
  isDead: boolean;
  respawnTimer: number;
  spell1Id: number | null;
  spell2Id: number | null;
  // Their history on the champion they're playing, and across every champion
  championRecord: PlayerRecord | null;
  overallRecord: PlayerRecord | null;
  // Games played on our own team, and the Friends route key for them once
  // there are enough of those to have earned a profile
  gamesWithUs: number;
  friendKey: string | null;
  // Our record with them against our record without them, ready for the tag.
  // Null for a stranger, which is nearly everyone in a random lobby.
  shared: SharedRecord | null;
}

export type LiveEventTone = "kill" | "objective" | "special";

export interface LiveEvent {
  id: number;
  // Seconds into the game
  time: number;
  text: string;
  tone: LiveEventTone;
}

export interface LiveGameSnapshot {
  // A match is running and its own API is serving stats
  inGame: boolean;
  // A match exists but isn't serving stats yet: champion select is over and
  // the loading screen is up, so the roster is known and nothing else is
  starting: boolean;
  gameId: number | null;
  queueId: number | null;
  mapId: number | null;
  // "Howling Abyss", "Butcher's Bridge" or "Koeshin's Crossing"
  mapName: string | null;
  // The map skin the game reported, which is what mapName is derived from
  mapSkin: string | null;
  gameTime: number;
  players: LivePlayer[];
  // Newest last, trimmed to the recent past
  events: LiveEvent[];
}

// ---- Post-game recap ----
