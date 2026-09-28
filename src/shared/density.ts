// How large the interface is drawn. One control rather than two, because the
// pages are laid out in a mix of rem and fixed pixels and only a page-wide
// scale moves all of it together; a setting that shrank the padding and left
// the type alone would pull the two apart.

export const UI_SCALE_SETTING = "ui_scale";

export type UiScale = "compact" | "normal" | "large";

export const UI_SCALES: UiScale[] = ["compact", "normal", "large"];

export const DEFAULT_UI_SCALE: UiScale = "normal";

export function parseUiScale(raw: string | null | undefined): UiScale {
  return raw === "compact" || raw === "large" ? raw : DEFAULT_UI_SCALE;
}

// Gentle on purpose. Past about 15% either way the fixed pixel sizes scattered
// through the pages stop sitting right against the scaled ones.
export const UI_SCALE_FACTORS: Record<UiScale, number> = {
  compact: 0.85,
  normal: 1,
  large: 1.15,
};
