import type { ReactNode } from "react";
import { RefreshIcon } from "./icons";
import { useT } from "../lib/i18n";

// One way of saying "still loading" and one way of saying "nothing here", for
// every page. Each page used to spell its own out, which is how the same two
// moments ended up in four different paddings and three different type sizes.

/** Use `compact` inside a panel or a row, where the full height is too much. */
export function PageLoading({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 text-sm text-lol-text ${
        compact ? "py-4" : "py-16"
      }`}
    >
      <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
      {t("common.loading")}
    </div>
  );
}

/**
 * The box a page shows in place of its content when there is none.
 *
 * `hint` is for what the reader could do about it, which is worth keeping
 * apart from the statement of what is missing.
 */
export function EmptyState({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-lol-border/60 bg-lol-card px-6 py-16 text-center">
      <p className="text-sm text-lol-text">{children}</p>
      {hint && <p className="max-w-md text-xs text-lol-text/70">{hint}</p>}
    </div>
  );
}
