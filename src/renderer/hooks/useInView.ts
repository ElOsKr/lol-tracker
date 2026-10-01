import { useEffect, useRef, useState } from "react";

/**
 * Whether an element is on screen, or close enough to be worth drawing.
 *
 * Written for the history, which scrolls without end. Each row carries about
 * a dozen icons, and a decoded 120×120 bitmap is some 60 KB: with eight
 * hundred games mounted that is the difference between the window sitting at
 * 460 MB and at 730. Measured by scrolling the same list at two widths — at
 * a width where the container queries hide most of the icons, the same scroll
 * costs nothing at all, which is what pointed at the pictures rather than at
 * the DOM.
 *
 * Rows stay mounted either way. Only the pictures come and go, so heights
 * never change, the scrollbar never jumps, and the deep links that scroll to
 * a game still land on it.
 */

/** Drawn well before it is reached, so scrolling never shows a gap. */
const MARGIN = "600px";

export function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  // Starts visible: the first paint should be complete, and a row that never
  // gets observed (an environment without IntersectionObserver) keeps its
  // icons rather than losing them for good.
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: MARGIN,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, inView];
}
