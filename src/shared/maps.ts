// ARAM rolls one of three maps per game, and neither the client nor the stored
// match says which: all three ship inside Map12, which the client now calls
// "Random Map", and there is no separate map id for them. The only thing that
// names the one that was rolled is the map skin, which the game logs as
// "mapskin = ..." and the in-game API serves as gameData.mapTerrain.
const MAP_SKIN_NAMES: Record<string, string> = {
  Default: "Howling Abyss",
  Bilgewater: "Butcher's Bridge",
  Bloom: "Koeshin's Crossing",
};

// Anything Riot adds later still reads as a name rather than as nothing, since
// the skins are already spelled close enough to their display names.
export function mapNameForSkin(
  skin: string | null | undefined,
  mapId?: number | null,
): string | null {
  if (mapId === 11) return "Grieta del Invocador";
  if (mapId != null && mapId !== 12) return `Mapa ${mapId}`;
  if (!skin) return null;
  return MAP_SKIN_NAMES[skin] ?? skin.replace(/_/g, " ");
}
