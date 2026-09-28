import { NOTICE_MAX_AGE_MS, type GameNotice } from "../shared/notice";

// The notice waiting to be drawn, kept apart from the module that builds it so
// that the widget can read it without the two importing each other.
//
// One at a time on purpose: two games cannot end within seconds of each other,
// and if they somehow did, the newer one is the one worth showing.
let pending: GameNotice | null = null;

export function setPendingNotice(notice: GameNotice | null): void {
  pending = notice;
}

/** The pending notice while it is still fresh, otherwise nothing. */
export function pendingNotice(now = Date.now()): GameNotice | null {
  if (!pending) return null;
  if (now - pending.raisedAt > NOTICE_MAX_AGE_MS) {
    pending = null;
    return null;
  }
  return pending;
}
