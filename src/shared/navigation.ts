// The sidebar's pages, in their default order. Settings is not here: it must
// always be reachable, or there would be no way back to this configuration.
// Labels come from the dictionary under `nav.<id>`.
export const NAV_ITEMS = [
  { id: "home", path: "/home" },
  { id: "history", path: "/" },
  { id: "live", path: "/live" },
  { id: "champions", path: "/champions" },
  { id: "augments", path: "/augments" },
  { id: "items", path: "/items" },
  { id: "friends", path: "/friends" },
  { id: "trends", path: "/trends" },
  { id: "skills", path: "/skills" },
  { id: "explore", path: "/explore" },
  { id: "records", path: "/records" },
  { id: "widget", path: "/widget" },
  { id: "challenges", path: "/challenges" },
  { id: "global", path: "/global" },
] as const;

export type NavItemId = (typeof NAV_ITEMS)[number]["id"];

export const NAV_LAYOUT_SETTING = "nav_layout";
export const HOME_PAGE_SETTING = "home_page";

export interface NavLayout {
  /** Every item id exactly once, in display order */
  order: NavItemId[];
  /** Items left out of the sidebar */
  hidden: NavItemId[];
}

const IDS = new Set<string>(NAV_ITEMS.map((item) => item.id));
const isId = (value: unknown): value is NavItemId => typeof value === "string" && IDS.has(value);

export const DEFAULT_NAV_LAYOUT: NavLayout = {
  order: NAV_ITEMS.map((item) => item.id),
  hidden: [],
};

/**
 * Reads the stored layout leniently: unknown ids (from a page that no longer
 * exists) are dropped, ids missing from the order (a page added since) are
 * appended in default order, and anything unparseable falls back to the default.
 * The home page is the one exception: a layout saved before it existed gets
 * it at the top, where a front door belongs, rather than at the bottom.
 */
export function parseNavLayout(raw: string | null | undefined): NavLayout {
  if (!raw) return DEFAULT_NAV_LAYOUT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_NAV_LAYOUT;
  }
  if (!parsed || typeof parsed !== "object") return DEFAULT_NAV_LAYOUT;
  const { order: rawOrder, hidden: rawHidden } = parsed as Record<string, unknown>;
  const order: NavItemId[] = [];
  if (Array.isArray(rawOrder)) {
    for (const id of rawOrder) if (isId(id) && !order.includes(id)) order.push(id);
  }
  for (const item of NAV_ITEMS) {
    if (order.includes(item.id)) continue;
    if (item.id === "home") order.unshift(item.id);
    else order.push(item.id);
  }
  const hidden = Array.isArray(rawHidden) ? rawHidden.filter(isId) : [];
  return { order, hidden: [...new Set(hidden)] };
}

export function serializeNavLayout(layout: NavLayout): string {
  return JSON.stringify({ order: layout.order, hidden: layout.hidden });
}

/** The items to show, in order, with a hidden item still available when `id` matches (for the Settings list). */
export function visibleNavItems(layout: NavLayout) {
  return layout.order
    .filter((id) => !layout.hidden.includes(id))
    .map((id) => NAV_ITEMS.find((item) => item.id === id)!);
}

/**
 * The page to open on launch. A stored choice only counts while that page is
 * still shown in the sidebar; otherwise the first visible page, and failing
 * that Match History, which cannot be hidden from routing anyway.
 */
export function resolveHomePath(raw: string | null | undefined, layout: NavLayout): string {
  const visible = visibleNavItems(layout);
  const chosen = visible.find((item) => item.path === raw);
  if (chosen) return chosen.path;
  return visible[0]?.path ?? "/";
}

export function moveNavItem(layout: NavLayout, id: NavItemId, direction: -1 | 1): NavLayout {
  const index = layout.order.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= layout.order.length) return layout;
  const order = [...layout.order];
  [order[index], order[target]] = [order[target], order[index]];
  return { ...layout, order };
}

export function setNavItemHidden(layout: NavLayout, id: NavItemId, hide: boolean): NavLayout {
  const hidden = layout.hidden.filter((h) => h !== id);
  if (hide) hidden.push(id);
  // Never let the sidebar go empty: the last visible page stays
  if (hidden.length >= layout.order.length) return layout;
  return { ...layout, hidden };
}
