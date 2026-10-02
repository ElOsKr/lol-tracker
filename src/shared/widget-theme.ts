/**
 * How the widget looks: the palette, the density, and how many games it draws.
 *
 * One module for the three places that have to agree — the widget page that
 * applies it, the settings page that builds it, and the main process that
 * hands it to the desktop window — and one parser, so a value that arrives in
 * a URL from OBS gets exactly the same checking as one chosen in the app.
 *
 * Everything here is deliberately paranoid about what it accepts. These values
 * end up in CSS custom properties on a page whose content security policy
 * allows inline styles, so an unchecked string would be a way in. A colour
 * that is not six hex digits is not a colour.
 */

export const WIDGET_THEMES = ["noche", "claro", "contraste", "discreto"] as const;
export type WidgetTheme = (typeof WIDGET_THEMES)[number];

export const WIDGET_LAYOUTS = ["filas", "compacto"] as const;
export type WidgetLayout = (typeof WIDGET_LAYOUTS)[number];

/** The most games the widget will draw, whatever the URL asks for. */
export const MAX_WIDGET_MATCHES = 20;

export interface WidgetAppearance {
  theme: WidgetTheme;
  /** An override for the highlight colour, or null to keep the theme's own. */
  accent: string | null;
  layout: WidgetLayout;
  /** null means "as many as fit", which is what it did before this existed. */
  matches: number | null;
}

export const DEFAULT_APPEARANCE: WidgetAppearance = {
  theme: "noche",
  accent: null,
  layout: "filas",
  matches: null,
};

/**
 * The variables each theme overrides, against the stylesheet's own defaults.
 *
 * `win-wash` and `loss-wash` are the tint behind a result. They were two hard
 * numbers inside the card rule, which is why the first light theme came out
 * with dark green smears across it.
 */
export const THEME_VARS: Record<WidgetTheme, Record<string, string>> = {
  // The stylesheet's own palette, written out rather than left empty. Every
  // theme declares the same ten names on purpose: applying one sets
  // properties and never clears them, so a theme that only declared the
  // handful it changes would inherit the rest from whichever theme was
  // applied before it.
  noche: {
    "--dark": "#0b0e14",
    "--card": "#141924",
    "--border": "#242c3d",
    "--gold": "#c89b3c",
    "--win": "#3ecf8e",
    "--loss": "#e5636e",
    "--text": "#94a0b8",
    "--bright": "#e8ecf4",
    "--win-wash": "#182e2b",
    "--loss-wash": "#30212b",
  },
  claro: {
    "--dark": "#eef0f4",
    "--card": "#ffffff",
    "--border": "#d5dae3",
    "--gold": "#8a6a1c",
    "--win": "#17865a",
    "--loss": "#bc2f3b",
    "--text": "#4b5469",
    "--bright": "#131822",
    "--win-wash": "#dff2e8",
    "--loss-wash": "#fae0e2",
  },
  // For a small overlay on a busy stream: no gradients, no mid greys.
  contraste: {
    "--dark": "#000000",
    "--card": "#000000",
    "--border": "#ffffff",
    "--gold": "#ffd34d",
    "--win": "#3dffa6",
    "--loss": "#ff6b76",
    "--text": "#ffffff",
    "--bright": "#ffffff",
    "--win-wash": "#000000",
    "--loss-wash": "#000000",
  },
  // The opposite: something that sits in a corner without pulling the eye.
  discreto: {
    "--dark": "#0b0e14",
    "--gold": "#a8853c",
    "--card": "rgba(14, 18, 26, 0.82)",
    "--border": "rgba(255, 255, 255, 0.14)",
    "--win": "#6fae8e",
    "--loss": "#b3777d",
    "--text": "#9aa3b4",
    "--bright": "#d7dce5",
    "--win-wash": "rgba(24, 46, 43, 0.82)",
    "--loss-wash": "rgba(48, 33, 43, 0.82)",
  },
};

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

function oneOf<T extends string>(values: readonly T[], raw: string | null, fallback: T): T {
  return values.includes(raw as T) ? (raw as T) : fallback;
}

/**
 * Reads an appearance out of a query string, falling back on anything odd.
 *
 * Never throws and never reports: a browser source with a typo in its URL
 * should show the widget, not an error page.
 */
export function parseWidgetAppearance(search: string): WidgetAppearance {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const accentRaw = params.get("accent");
  // A bare "00ff88" is what anyone copying a colour out of a picker will try.
  const accent = accentRaw ? (accentRaw.startsWith("#") ? accentRaw : `#${accentRaw}`) : null;

  const matchesRaw = Number(params.get("matches"));
  const matches =
    Number.isInteger(matchesRaw) && matchesRaw >= 1
      ? Math.min(matchesRaw, MAX_WIDGET_MATCHES)
      : null;

  return {
    theme: oneOf(WIDGET_THEMES, params.get("theme"), DEFAULT_APPEARANCE.theme),
    accent: accent && HEX_COLOUR.test(accent) ? accent.toLowerCase() : null,
    layout: oneOf(WIDGET_LAYOUTS, params.get("layout"), DEFAULT_APPEARANCE.layout),
    matches,
  };
}

/**
 * The query string for an appearance, with the defaults left out.
 *
 * A URL that says nothing is the plainest way of asking for the default, and
 * it is the one someone has to paste into OBS and may well read first.
 */
export function widgetAppearanceQuery(appearance: WidgetAppearance): string {
  const params = new URLSearchParams();
  if (appearance.theme !== DEFAULT_APPEARANCE.theme) params.set("theme", appearance.theme);
  if (appearance.layout !== DEFAULT_APPEARANCE.layout) params.set("layout", appearance.layout);
  if (appearance.accent && HEX_COLOUR.test(appearance.accent)) {
    params.set("accent", appearance.accent.toLowerCase());
  }
  if (appearance.matches != null) {
    params.set("matches", String(Math.min(Math.max(1, appearance.matches), MAX_WIDGET_MATCHES)));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** The same appearance on top of a base URL, replacing any it already carries. */
export function widgetUrlWith(baseUrl: string, appearance: WidgetAppearance): string {
  const query = widgetAppearanceQuery(appearance);
  const base = baseUrl.split("?")[0];
  return base + query;
}

/**
 * Just enough of an element to be styled, so this module compiles without
 * the DOM library: it is shared with the main process, which has none.
 */
export interface StyleTarget {
  style: { setProperty(name: string, value: string): void };
  dataset: Record<string, string | undefined>;
}

/**
 * Applies an appearance to a document.
 *
 * Here rather than in the widget script because the values it writes are the
 * ones this module validated, and keeping the two together is what stops a
 * future variable from being set from an unchecked string.
 */
export function applyWidgetAppearance(root: StyleTarget, appearance: WidgetAppearance): void {
  for (const [name, value] of Object.entries(THEME_VARS[appearance.theme])) {
    root.style.setProperty(name, value);
  }
  if (appearance.accent && HEX_COLOUR.test(appearance.accent)) {
    root.style.setProperty("--gold", appearance.accent);
  }
  root.dataset.layout = appearance.layout;
  root.dataset.theme = appearance.theme;
}
