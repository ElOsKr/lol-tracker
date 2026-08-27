import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A hover tooltip rich enough to hold markup, for the places a native title=
// attribute can only show a name.
//
// It renders into document.body rather than beside its trigger: every caller
// sits inside a scrolling table or an expanded match row, and an absolutely
// positioned card would be clipped by that container's overflow. Body-level
// means fixed coordinates, so the card is measured after mount and flipped to
// whichever side of the trigger it fits on.

const GAP = 8;
const MARGIN = 8;
// Long enough that skimming a row of items doesn't flash six cards, short
// enough that pausing on one feels immediate.
const OPEN_DELAY_MS = 260;

type Position = { top: number; left: number };

export default function HoverCard({
  content,
  children,
  width = 300,
}: {
  content: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const show = () => {
    if (!content) return;
    cancel();
    timer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };

  const hide = useCallback(() => {
    cancel();
    setOpen(false);
    setPos(null);
  }, [cancel]);

  // Measured rather than guessed: the card's height depends on how much text
  // the item has, which decides whether it goes above or below.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const card = cardRef.current;
    if (!trigger || !card) return;

    // The wrapper is display:contents so it can sit inside the grids and flex
    // rows that hold the icons without adding a box of its own — which also
    // means it has no box to measure, and its own rect is all zeros. The
    // child is what the cursor is actually over.
    const anchored = trigger.firstElementChild ?? trigger;
    const anchor = anchored.getBoundingClientRect();
    const { width: cardW, height: cardH } = card.getBoundingClientRect();

    const below = anchor.bottom + GAP;
    const above = anchor.top - GAP - cardH;
    // Prefer below, flip up when it would run off the bottom, and give up on
    // flipping if neither side fits — clamping keeps it on screen either way.
    const top = below + cardH <= window.innerHeight - MARGIN || above < MARGIN ? below : above;

    const left = anchor.left + anchor.width / 2 - cardW / 2;
    const maxLeft = window.innerWidth - cardW - MARGIN;

    setPos({
      top: Math.min(Math.max(top, MARGIN), Math.max(window.innerHeight - cardH - MARGIN, MARGIN)),
      left: Math.min(Math.max(left, MARGIN), Math.max(maxLeft, MARGIN)),
    });
  }, [open]);

  // A card pinned to viewport coordinates goes stale the moment the list under
  // it moves, and there's no trigger left under the cursor to close it.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => hide();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, hide]);

  return (
    <>
      <span
        ref={triggerRef}
        className="contents"
        onMouseEnter={show}
        onMouseLeave={hide}
        onPointerDown={hide}
      >
        {children}
      </span>
      {open &&
        content &&
        createPortal(
          <div
            ref={cardRef}
            role="tooltip"
            // Rendered off-screen for the first frame so measuring it doesn't
            // flash the card at the wrong spot.
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width,
              visibility: pos ? "visible" : "hidden",
            }}
            className="fixed z-50 pointer-events-none rounded-lg border border-lol-border bg-lol-card px-3 py-2 text-xs leading-relaxed text-lol-text shadow-xl shadow-black/50"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
