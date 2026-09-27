import { useSyncExternalStore } from "react";

// The three layouts the window can be in, by its width. "mobile" hides the
// sidebar behind a menu button and stacks everything; "compact" keeps the
// sidebar but trims what the pages show; "full" is the layout as designed.
export type Viewport = "full" | "compact" | "mobile";

export const MOBILE_MAX_WIDTH = 700;
export const COMPACT_MAX_WIDTH = 1200;

const mobileQuery = `(max-width: ${MOBILE_MAX_WIDTH - 1}px)`;
const compactQuery = `(max-width: ${COMPACT_MAX_WIDTH - 1}px)`;

function current(): Viewport {
  if (window.matchMedia(mobileQuery).matches) return "mobile";
  if (window.matchMedia(compactQuery).matches) return "compact";
  return "full";
}

function subscribe(listener: () => void) {
  const lists = [window.matchMedia(mobileQuery), window.matchMedia(compactQuery)];
  for (const list of lists) list.addEventListener("change", listener);
  return () => {
    for (const list of lists) list.removeEventListener("change", listener);
  };
}

/** Which layout the window currently calls for; re-renders when it changes. */
export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, current);
}
