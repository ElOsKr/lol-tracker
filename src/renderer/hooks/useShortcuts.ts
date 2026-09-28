import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebarItems } from "./useSidebarItems";
import { focusPageSearch, isTypingTarget, matchShortcut, requestSync } from "../lib/shortcuts";

/**
 * The app's keyboard shortcuts, installed once by the layout.
 *
 * Bound on the window rather than on any page, because a shortcut that only
 * works while the right thing happens to have focus is not a shortcut.
 */
export function useShortcuts(): void {
  const navigate = useNavigate();
  const items = useSidebarItems();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A press being replayed by an input method is not a shortcut
      if (event.isComposing || event.repeat) return;

      const shortcut = matchShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        inField: isTypingTarget(event.target),
      });
      if (!shortcut) return;

      if (shortcut.kind === "nav") {
        const item = items[shortcut.index];
        // A number past the end of the list does nothing, rather than
        // wrapping around to a page the user wasn't aiming at
        if (!item) return;
        event.preventDefault();
        navigate(item.path);
        return;
      }

      if (shortcut.kind === "search") {
        // Only swallow the key on a page that has a search box; elsewhere
        // leave it to the browser rather than making it silently do nothing
        if (focusPageSearch()) event.preventDefault();
        return;
      }

      // Ctrl+R would otherwise be a page reload, which in this app throws away
      // the view and reconnects for nothing
      event.preventDefault();
      requestSync();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items, navigate]);
}
