// The keyboard shortcuts, and the rules for when a key press is one.
//
// The matching is a pure function so it can be checked on its own: the awkward
// part of a shortcut is not what it does, it is all the moments it must stay
// out of the way.

export type Shortcut =
  // Open the nth page of the sidebar, zero-based
  { kind: "nav"; index: number } | { kind: "search" } | { kind: "sync" };

export interface KeyPress {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  // Whether the press landed in something the user is typing into
  inField: boolean;
}

/**
 * The shortcut a key press asks for, or nothing.
 *
 * The digits are bare keys, so they only count outside a text field: typing 3
 * into a search box must write a 3. Ctrl combinations carry their own
 * modifier, so they work wherever the cursor happens to be.
 */
export function matchShortcut(press: KeyPress): Shortcut | null {
  const { key, ctrlKey, metaKey, altKey, shiftKey, inField } = press;
  // Alt belongs to the window manager, and a shortcut that also fires with it
  // held down would steal from it.
  if (altKey) return null;

  if (ctrlKey || metaKey) {
    if (shiftKey) return null;
    const lower = key.toLowerCase();
    if (lower === "f") return { kind: "search" };
    if (lower === "r") return { kind: "sync" };
    return null;
  }

  if (inField || shiftKey) return null;
  if (key >= "1" && key <= "9") return { kind: "nav", index: Number(key) - 1 };
  return null;
}

/** Whether an event's target is something being typed into. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// Marks the search box of whichever page has one, so Ctrl+F can find it
// without every page having to be told about the shortcut.
export const SEARCH_ATTRIBUTE = "data-shortcut-search";

export function focusPageSearch(): boolean {
  const input = document.querySelector<HTMLInputElement>(`input[${SEARCH_ATTRIBUTE}]`);
  if (!input) return false;
  input.focus();
  input.select();
  return true;
}

// Syncing lives in the sidebar, which already shows what came of it. Rather
// than lift all of that somewhere shared, the shortcut asks and the sidebar
// answers.
const SYNC_EVENT = "loleanding:sync";

export function requestSync(): void {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export function onSyncRequested(handler: () => void): () => void {
  window.addEventListener(SYNC_EVENT, handler);
  return () => window.removeEventListener(SYNC_EVENT, handler);
}
