import fs from "fs";
import path from "path";
import { getDataDir } from "./paths";

// Every one of these requests gates something the UI waits on: champion data
// blocks dragon:champions, db:teammate-detail and data:repair-puuids, and a
// request that never settles leaves those hanging with no error to show.
const REQUEST_TIMEOUT_MS = 10_000;

let championCache: Record<number, { name: string; key: string; class?: string }> = {};
// Data Dragon version the champion cache came from ("none" until any data
// loads). Folded into the score-backfill key so stored scores recompute when
// champion class data changes.
let championDataVersion = "none";
let augmentCache: Record<number, { name: string; desc: string; iconPath: string; rarity: string }> =
  {};

let championReady: Promise<void> | null = null;
let augmentReady: Promise<void> | null = null;

// fetch follows redirects itself, with its own cap — the hand-rolled version
// this replaces recursed on Location with no limit and no timeout.
async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "MayhemTracker/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${url}`);
  }
  return res.json();
}

const championCacheFile = () => path.join(getDataDir(), "champion-cache.json");

// Last successfully fetched champion data, so offline startups still have
// names and classes (and scoring stays consistent with the previous run).
function hydrateChampionCacheFromDisk() {
  try {
    const cached = JSON.parse(fs.readFileSync(championCacheFile(), "utf8"));
    if (cached?.champions && cached?.version) {
      championCache = cached.champions;
      championDataVersion = cached.version;
    }
  } catch {
    // No cache yet, or unreadable — network load will populate it
  }
}

export function loadChampionData() {
  championReady = (async () => {
    hydrateChampionCacheFromDisk();
    try {
      const versions = await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
      const version = versions[0];

      const data = await fetchJson(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
      );
      const cache: typeof championCache = {};
      for (const [key, champ] of Object.entries(data.data) as any[]) {
        cache[parseInt(champ.key)] = { name: champ.name, key, class: champ.tags?.[0] };
      }
      championCache = cache;
      championDataVersion = version;
      try {
        fs.writeFileSync(championCacheFile(), JSON.stringify({ version, champions: cache }));
      } catch (err) {
        console.error("Failed to persist champion cache:", err);
      }
      console.log(
        `Loaded ${Object.keys(championCache).length} champions from Data Dragon v${version}`,
      );
    } catch (err) {
      console.error("Failed to load champion data:", err);
    }
  })();
  return championReady;
}

export function loadAugmentData() {
  augmentReady = (async () => {
    try {
      const data = await fetchJson(
        "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json",
      );
      augmentCache = {};

      // cherry-augments.json is an array of augment objects
      if (Array.isArray(data)) {
        for (const aug of data) {
          augmentCache[aug.id] = {
            name: aug.name || aug.nameTRA || `Augment ${aug.id}`,
            desc: aug.desc || aug.descriptionTRA || "",
            iconPath: aug.augmentSmallIconPath || aug.iconSmall || aug.iconLarge || "",
            rarity: aug.rarity || "",
          };
        }
      } else if (typeof data === "object") {
        // Could be keyed by id
        for (const [id, aug] of Object.entries(data) as any[]) {
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            augmentCache[numId] = {
              name: aug.name || aug.nameTRA || `Augment ${numId}`,
              desc: aug.desc || aug.descriptionTRA || "",
              iconPath: aug.augmentSmallIconPath || aug.iconSmall || aug.iconLarge || "",
              rarity: aug.rarity || "",
            };
          }
        }
      }

      console.log(`Loaded ${Object.keys(augmentCache).length} augments from CommunityDragon`);
    } catch (err) {
      console.error("Failed to load augment data:", err);
    }
  })();
  return augmentReady;
}

export type ItemInfo = { name: string; iconPath: string; branch: string };

const itemCache = new Map<string, Record<number, ItemInfo>>();
const itemPromises = new Map<string, Promise<Record<number, ItemInfo>>>();
let latestLivePatch: string | null = null;

const itemsJsonUrl = (branch: string) =>
  `https://raw.communitydragon.org/${branch}/plugins/rcp-be-lol-game-data/global/default/v1/items.json`;

// Map a game's major.minor patch to the CommunityDragon branch that has its
// data: live patches have their own branch, the current patch is "latest",
// and a patch newer than live only exists on "pbe".
async function resolveItemBranch(patch?: string): Promise<string> {
  if (!patch) return "latest";
  try {
    if (!latestLivePatch) {
      const versions = await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
      const m = String(versions[0]).match(/^(\d+)\.(\d+)/);
      if (m) latestLivePatch = `${m[1]}.${m[2]}`;
    }
    if (latestLivePatch) {
      const [liveMajor, liveMinor] = latestLivePatch.split(".").map(Number);
      const [major, minor] = patch.split(".").map(Number);
      if (major > liveMajor || (major === liveMajor && minor > liveMinor)) return "pbe";
      if (major === liveMajor && minor === liveMinor) return "latest";
    }
  } catch {
    /* fall through to the patch's own branch */
  }
  return patch;
}

export function loadItemData(patch?: string): Promise<Record<number, ItemInfo>> {
  const key = patch ?? "latest";
  const cached = itemCache.get(key);
  if (cached) return Promise.resolve(cached);

  let promise = itemPromises.get(key);
  if (!promise) {
    promise = (async () => {
      const branch = await resolveItemBranch(patch);
      let data: any;
      try {
        data = await fetchJson(itemsJsonUrl(branch));
      } catch (err) {
        if (branch === "latest") throw err;
        data = await fetchJson(itemsJsonUrl("latest"));
      }
      const items: Record<number, ItemInfo> = {};
      if (Array.isArray(data)) {
        for (const item of data) {
          items[item.id] = { name: item.name || "", iconPath: item.iconPath || "", branch };
        }
      }
      itemCache.set(key, items);
      console.log(`Loaded ${Object.keys(items).length} items from CommunityDragon (${branch})`);
      return items;
    })();
    // Drop failed loads so a later request can retry
    promise.catch(() => itemPromises.delete(key));
    itemPromises.set(key, promise);
  }
  return promise;
}

export type SummonerSpellInfo = { name: string; iconPath: string };

let spellCache: Record<number, SummonerSpellInfo> | null = null;
let spellPromise: Promise<Record<number, SummonerSpellInfo>> | null = null;

// Summoner spell art doesn't change patch to patch the way item art does, so
// one "latest" fetch serves every game.
export function loadSummonerSpellData(): Promise<Record<number, SummonerSpellInfo>> {
  if (spellCache) return Promise.resolve(spellCache);
  if (!spellPromise) {
    spellPromise = (async () => {
      const data = await fetchJson(
        "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/summoner-spells.json",
      );
      const spells: Record<number, SummonerSpellInfo> = {};
      if (Array.isArray(data)) {
        for (const spell of data) {
          spells[spell.id] = { name: spell.name || "", iconPath: spell.iconPath || "" };
        }
      }
      spellCache = spells;
      console.log(`Loaded ${Object.keys(spells).length} summoner spells from CommunityDragon`);
      return spells;
    })();
    // Drop failed loads so a later request can retry
    spellPromise.catch(() => {
      spellPromise = null;
    });
  }
  return spellPromise;
}

export async function waitForChampionData() {
  if (championReady) await championReady;
}

export async function waitForAugmentData() {
  if (augmentReady) await augmentReady;
}

export function getChampionData() {
  return championCache;
}

export function getChampionClasses(): Record<number, string> {
  const map: Record<number, string> = {};
  for (const [id, champ] of Object.entries(championCache)) {
    if (champ.class) map[Number(id)] = champ.class;
  }
  return map;
}

export function getChampionDataVersion() {
  return championDataVersion;
}

export function getAugmentDataCache() {
  return augmentCache;
}

// ---------------------------------------------------------------------------
// Retired augment icons
//
// cherry-augments.json on "latest" still names augments Riot has cut (Hat on a
// Hat, Self Destruct), but their art is gone from the latest game export, so
// the icon 404s while the tooltip still works. The art does survive on the
// archived patch branches, and an augment's iconPath can differ between
// branches (1108's picked up a ".MAYHEM_New_Augments" texture suffix), so
// resolving one means reading that branch's own cherry-augments.json.

// How far back to walk before giving up. Retired augments were in the game
// recently enough to be in someone's match history, so hits come early; the cap
// stops a permanently-missing icon from pulling down a year of manifests.
const MAX_ICON_BRANCH_LOOKBACK = 12;

// A stats page renders hundreds of icons at once and CommunityDragon throttles
// bursts, so several <img> tags can fail at the same moment. Resolving those in
// parallel would aim the same burst at the same host; keep it to a trickle.
const ICON_LOOKUP_CONCURRENCY = 4;

type AugmentIconCache = Record<string, string | null>;

let augmentIconCache: AugmentIconCache | null = null;
const augmentIconPending = new Map<string, Promise<string | null>>();
const branchAugmentIcons = new Map<string, Record<number, string>>();
let archivedBranches: string[] | null = null;

const augmentIconCacheFile = () => path.join(getDataDir(), "augment-icon-cache.json");

function readAugmentIconCache(): AugmentIconCache {
  if (!augmentIconCache) {
    try {
      augmentIconCache = JSON.parse(fs.readFileSync(augmentIconCacheFile(), "utf8"));
    } catch {
      augmentIconCache = {};
    }
  }
  return augmentIconCache!;
}

function writeAugmentIconCache(id: number, url: string | null) {
  const cache = readAugmentIconCache();
  cache[String(id)] = url;
  try {
    fs.writeFileSync(augmentIconCacheFile(), JSON.stringify(cache));
  } catch (err) {
    console.error("Failed to persist augment icon cache:", err);
  }
}

let lookupSlots = ICON_LOOKUP_CONCURRENCY;
const lookupQueue: (() => void)[] = [];

async function withLookupSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (lookupSlots === 0) await new Promise<void>((resolve) => lookupQueue.push(resolve));
  lookupSlots--;
  try {
    return await fn();
  } finally {
    lookupSlots++;
    lookupQueue.shift()?.();
  }
}

// Patch branches newest first. Only numeric ones — "latest" and "pbe" are
// already covered by the live data, and the rest are per-locale mirrors.
async function getArchivedBranches(): Promise<string[]> {
  if (archivedBranches) return archivedBranches;
  const listing = await fetchJson("https://raw.communitydragon.org/json/");
  const branches: string[] = (Array.isArray(listing) ? listing : [])
    .map((entry: any) => String(entry?.name ?? ""))
    .filter((name) => /^\d+\.\d+$/.test(name))
    .sort((a, b) => {
      const [aMajor, aMinor] = a.split(".").map(Number);
      const [bMajor, bMinor] = b.split(".").map(Number);
      return bMajor - aMajor || bMinor - aMinor;
    });
  archivedBranches = branches;
  return branches;
}

async function getBranchAugmentIcons(branch: string): Promise<Record<number, string>> {
  const cached = branchAugmentIcons.get(branch);
  if (cached) return cached;
  const icons: Record<number, string> = {};
  try {
    const data = await fetchJson(
      `https://raw.communitydragon.org/${branch}/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json`,
    );
    const entries = Array.isArray(data) ? data : Object.values(data ?? {});
    for (const aug of entries as any[]) {
      const iconPath = aug?.augmentSmallIconPath || aug?.iconSmall || aug?.iconLarge;
      if (aug?.id != null && iconPath) icons[Number(aug.id)] = iconPath;
    }
  } catch {
    // Branch missing or unreadable — memoize the empty result so the walk
    // doesn't retry it for every other augment in the same session.
  }
  branchAugmentIcons.set(branch, icons);
  return icons;
}

// Mirrors the renderer's CDRAGON_ASSET_URL so a resolved URL can be used as-is.
function assetUrl(branch: string, iconPath: string): string {
  return `https://raw.communitydragon.org/${branch}/game/${iconPath
    .replace("/lol-game-data/assets/", "")
    .toLowerCase()}`;
}

// The UI prefers the large art; the data names the small path, and a few
// augments only ever shipped the one the data names.
function iconVariants(iconPath: string): string[] {
  return [...new Set([iconPath.replace("small", "large"), iconPath])];
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "MayhemTracker/1.0" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function findIconOnBranch(branch: string, iconPath: string): Promise<string | null> {
  for (const variant of iconVariants(iconPath)) {
    const url = assetUrl(branch, variant);
    if (await urlExists(url)) return url;
  }
  return null;
}

/**
 * Full CDN URL for an augment whose icon failed to load from the latest export,
 * or null if no recent patch branch has it.
 *
 * A genuinely retired augment resolves to an archived patch branch, and that
 * result (misses included) persists to disk so the branch walk happens once per
 * augment rather than once per launch. An augment whose art is still on
 * "latest" only got here because the CDN dropped the request, so it hands back
 * the live URL and caches nothing — pinning it to today's patch branch would
 * freeze art that Riot may still update.
 */
export function resolveAugmentIcon(id: number, patch?: string): Promise<string | null> {
  const cache = readAugmentIconCache();
  const key = String(id);
  if (key in cache) return Promise.resolve(cache[key]);

  let pending = augmentIconPending.get(key);
  if (!pending) {
    pending = withLookupSlot(async () => {
      const livePath = augmentCache[id]?.iconPath;
      if (livePath) {
        const live = await findIconOnBranch("latest", livePath);
        if (live) return live;
      }
      const branches = await getArchivedBranches();
      // The game's own patch is the branch most likely to have the art, so try
      // it first; otherwise walk back from the newest archived patch.
      const ordered = new Set([
        ...(patch && branches.includes(patch) ? [patch] : []),
        ...branches.slice(0, MAX_ICON_BRANCH_LOOKBACK),
      ]);
      for (const branch of ordered) {
        const iconPath = (await getBranchAugmentIcons(branch))[id];
        const url = iconPath && (await findIconOnBranch(branch, iconPath));
        if (url) {
          console.log(`Resolved augment ${id} icon from CommunityDragon ${branch}`);
          writeAugmentIconCache(id, url);
          return url;
        }
      }
      writeAugmentIconCache(id, null);
      return null;
    });
    // Drop the in-flight entry either way: a resolved lookup is either cached
    // on disk or a transient miss that should be retried on the next render.
    pending.catch(() => {}).finally(() => augmentIconPending.delete(key));
    augmentIconPending.set(key, pending);
  }
  return pending;
}
