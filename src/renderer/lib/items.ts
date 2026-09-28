import type { ItemData, ItemUsage } from "./types";

// The catalogue's own rules, kept apart from the page that draws it: which
// entries of Riot's item file are items at all, how they are named to a reader,
// and how the search and the filters narrow them.

export type ItemSort = "games" | "cost" | "name";

export interface CatalogItem {
  id: number;
  name: string;
  priceTotal: number;
  price: number;
  categories: string[];
  from: number[];
  to: number[];
  games: number;
  wins: number;
}

// Riot writes its categories as one run-together word.
export function formatCategory(raw: string): string {
  return raw.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

/**
 * The items worth listing, each carrying how the player has done with it.
 *
 * Riot's file holds a great deal that is not an item: internal pieces, test
 * entries, things pulled from the shop patches ago. Anything out of the shop is
 * left out, unless the player has actually finished a game holding it, in which
 * case it is part of their history whatever Riot did with it since.
 */
export function buildCatalog(items: ItemData, usage: ItemUsage[]): CatalogItem[] {
  const used = new Map(usage.map((row) => [row.item_id, row]));
  const catalog: CatalogItem[] = [];
  for (const [key, item] of Object.entries(items)) {
    const id = Number(key);
    const mine = used.get(id);
    if (!item.inStore && !mine) continue;
    if (!item.name) continue;
    catalog.push({
      id,
      name: item.name,
      priceTotal: item.priceTotal,
      price: item.price,
      categories: item.categories,
      from: item.from,
      to: item.to,
      games: mine?.games ?? 0,
      wins: mine?.wins ?? 0,
    });
  }
  return catalog;
}

/** Every category in the catalogue, commonest first, then alphabetical. */
export function catalogCategories(catalog: CatalogItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of catalog) {
    for (const category of item.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category);
}

export function filterItems(
  catalog: CatalogItem[],
  { search, category, mineOnly }: { search: string; category: string; mineOnly: boolean },
): CatalogItem[] {
  // Matched against the category's readable form too, so typing "critical"
  // finds what the filter calls "Critical Strike"
  const needle = search.trim().toLowerCase();
  return catalog.filter((item) => {
    if (mineOnly && item.games === 0) return false;
    if (category && !item.categories.includes(category)) return false;
    if (!needle) return true;
    return (
      item.name.toLowerCase().includes(needle) ||
      item.categories.some((c) => formatCategory(c).toLowerCase().includes(needle))
    );
  });
}

/**
 * One row per item name, with the player's games added up across them.
 *
 * Riot ships a separate entry per game mode for many items, so the raw file has
 * three B. F. Swords with three ids and three prices. Listing all of them reads
 * as a bug, and splitting the player's games between them answers a question
 * nobody asked: what they want to know is how they do with the sword. The entry
 * kept is the one they have played most, then the cheapest.
 */
export function mergeByName(catalog: CatalogItem[]): CatalogItem[] {
  const byName = new Map<string, CatalogItem>();
  for (const item of catalog) {
    const seen = byName.get(item.name);
    if (!seen) {
      byName.set(item.name, { ...item });
      continue;
    }
    const better =
      item.games > seen.games ||
      (item.games === seen.games &&
        (item.priceTotal < seen.priceTotal ||
          (item.priceTotal === seen.priceTotal && item.id < seen.id)));
    const games = seen.games + item.games;
    const wins = seen.wins + item.wins;
    byName.set(item.name, better ? { ...item, games, wins } : { ...seen, games, wins });
  }
  return [...byName.values()];
}

export function sortItems(catalog: CatalogItem[], sort: ItemSort): CatalogItem[] {
  const sorted = [...catalog];
  switch (sort) {
    case "cost":
      // Cheap things the player never buys are not what a cost sort is for
      return sorted.sort((a, b) => b.priceTotal - a.priceTotal || a.name.localeCompare(b.name));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted.sort(
        (a, b) => b.games - a.games || b.priceTotal - a.priceTotal || a.name.localeCompare(b.name),
      );
  }
}
