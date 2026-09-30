// CommunityDragon serves the game's own assets per patch branch ("latest",
// "pbe", or a patch like "16.14"). Both processes build these URLs — the
// renderer for every icon it draws, the main process when it goes looking for
// art a retired augment left behind — so the shape lives here.

// Turns a game-data icon path (as items.json and cherry-augments.json name it)
// into a raw asset URL on the given branch.
export function cdragonAssetUrl(branch: string, iconPath: string): string {
  return `https://raw.communitydragon.org/${branch}/game/${iconPath
    .replace("/lol-game-data/assets/", "")
    .toLowerCase()}`;
}

// Rune art is the exception to the rule above: perks.json names its icons
// with the same "/lol-game-data/assets/..." prefix as items do, but the files
// sit under the game-data plugin rather than under /game/, where the same
// path answers 404.
export function cdragonPerkUrl(branch: string, iconPath: string): string {
  return `https://raw.communitydragon.org/${branch}/plugins/rcp-be-lol-game-data/global/default/${iconPath
    .replace("/lol-game-data/assets/", "")
    .toLowerCase()}`;
}

export function cherryAugmentsUrl(branch: string): string {
  return `https://raw.communitydragon.org/${branch}/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json`;
}

// The little ranked crests the client draws beside a player's rank. These are
// SVGs of a couple of kilobytes, unlike the full emblems next door, which are
// 150 KB paintings meant to fill a profile page.
//
// They are not patch art, so they always come off "latest": a crest that moved
// would be a client redesign, not a game version, and pinning one to an old
// branch would only mean an older drawing of the same thing.
export function rankCrestUrl(tier: string): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${tier.toLowerCase()}.svg`;
}
