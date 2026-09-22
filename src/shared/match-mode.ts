import { isArenaQueue, isTrackedQueue } from "./queues";

export function isSupportedLolMatch(game: any): boolean {
  if (!isTrackedQueue(game?.queueId) || /TFT/i.test(String(game?.gameMode))) return false;
  if (!Number.isSafeInteger(game.gameId) || game.gameId <= 0) return false;
  if (!Array.isArray(game.participants) || game.participants.length === 0) return false;
  // Missing outcomes must never be silently recorded as defeats.
  return game.participants.every((p: any) => {
    const s = p.stats || p;
    return typeof s.win === "boolean" || s.win === 0 || s.win === 1;
  });
}

export function participantModeFields(game: any, p: any, index: number) {
  const s = p.stats || p;
  const arena = isArenaQueue(game.queueId) || game.gameMode === "CHERRY";
  const subteam = s.playerSubteamId ?? p.playerSubteamId;
  const positive = (v: any): number | null => (Number.isInteger(v) && v > 0 ? v : null);
  const nonnegative = (v: any): number | null => (Number.isFinite(v) && v >= 0 ? v : null);
  return {
    participantId: p.participantId ?? index + 1,
    // An unknown Arena squad stays separate rather than becoming a false teammate.
    teamId: arena
      ? (positive(subteam) ?? -(p.participantId ?? index + 1))
      : (p.teamId ?? s.teamId ?? 100),
    placement: arena ? positive(s.subteamPlacement ?? s.placement ?? p.placement) : null,
    cs:
      typeof s.totalMinionsKilled === "number"
        ? s.totalMinionsKilled + (s.neutralMinionsKilled ?? 0)
        : null,
    vision: nonnegative(s.visionScore),
    position: typeof p.teamPosition === "string" && p.teamPosition ? p.teamPosition : null,
  };
}
