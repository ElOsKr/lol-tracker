import { useState, useEffect } from "react";
import type { RecoveryReport } from "../lib/types";
import { useT } from "../lib/i18n";

// Shown when the app had to rebuild its database at startup. Silently restoring
// and carrying on would leave the user with no way to tell that anything
// happened — and, if the restore came from an older snapshot, no explanation
// for the games that are suddenly missing.
export default function RecoveryBanner() {
  const [report, setReport] = useState<RecoveryReport | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const t = useT();

  useEffect(() => {
    window.api.getRecoveryReport().then(setReport);
  }, []);

  if (!report || dismissed) return null;

  const cause = report.problem === "missing" ? t("recovery.missing") : t("recovery.unopenable");
  const outcome = report.restoredFrom
    ? t("recovery.restored", { file: report.restoredFrom })
    : t("recovery.empty");
  const kept = report.quarantined ? t("recovery.kept", { file: report.quarantined }) : "";

  return (
    <div className="mx-6 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
      <div className="text-xs text-amber-100/90 flex-1">
        <p className="font-semibold text-amber-200">{t("recovery.title")}</p>
        <p className="mt-0.5">
          {cause} {outcome}
          {kept}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs px-2 py-1 rounded text-amber-200/80 hover:bg-amber-500/20 transition-colors shrink-0"
      >
        {t("recovery.dismiss")}
      </button>
    </div>
  );
}
