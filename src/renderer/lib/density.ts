import { UI_SCALE_FACTORS, type UiScale } from "../../shared/density";

/**
 * Draws the whole page at the chosen size.
 *
 * `zoom` on the root element rather than Chromium's own zoom factor: that one
 * is remembered per origin for a whole session, so it would follow the widget
 * and the end-of-game card into their own windows, which are sized in pixels
 * and have no business changing with this.
 */
export function applyUiScale(scale: UiScale): void {
  const factor = UI_SCALE_FACTORS[scale];
  const root = document.documentElement;
  // Left unset at the normal size, so nothing pays for a scale of one
  root.style.zoom = factor === 1 ? "" : String(factor);
  // Read by the stylesheet, which has to undo the scale anywhere a length is
  // measured against the viewport rather than against its parent
  root.style.setProperty("--ui-scale", String(factor));
}
