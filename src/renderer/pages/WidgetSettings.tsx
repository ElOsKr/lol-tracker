import { TRACKED_QUEUE_IDS } from "../../shared/queues";
import { useEffect, useState } from "react";
import type { MatchFilterOptions } from "../../shared/api";
import type { WidgetState, WidgetPreferences } from "../../shared/widget";
import { queueLabel } from "../components/QueueSelect";
import { useT } from "../lib/i18n";

export default function WidgetSettings() {
  const [state, setState] = useState<WidgetState | null>(null);
  const [options, setOptions] = useState<MatchFilterOptions | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT();
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void Promise.all([window.api.getWidgetState(), window.api.getMatchFilterOptions()])
        .then(([next, filters]) => {
          if (active) {
            setState(next);
            setOptions(filters);
          }
        })
        .catch((err) => {
          if (active) setError(String(err));
        });
    refresh();
    const unsubscribe = window.api.onGamesUpdated(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const run = async (action: () => Promise<WidgetState>) => {
    setBusy(true);
    setError("");
    try {
      setState(await action());
    } catch (err) {
      setError(String(err).includes("EADDRINUSE") ? t("widget.portBusy") : String(err));
    } finally {
      setBusy(false);
    }
  };
  const select = (change: Partial<WidgetPreferences>) => {
    if (state) void run(() => window.api.setWidgetPreferences({ ...state.preferences, ...change }));
  };
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-lol-text-bright">{t("widget.title")}</h1>
        <p className="mt-2">{t("widget.intro")}</p>
      </div>
      {error && (
        <p role="alert" className="text-lol-loss">
          {error}
        </p>
      )}
      {!state ? (
        <p>{t("widget.loading")}</p>
      ) : (
        <>
          <section className="p-5 rounded-lg border border-lol-border space-y-4">
            <h2 className="text-lg font-semibold text-lol-text-bright">
              {t("widget.historyShown")}
            </h2>
            <div className="flex flex-wrap gap-4">
              <label>
                {t("widget.account")}
                <br />
                <select
                  className="select mt-2"
                  aria-label={t("widget.accountAria")}
                  disabled={busy || !options?.accounts.length}
                  value={state.preferences.account}
                  onChange={(e) => select({ account: e.target.value })}
                >
                  {!options?.accounts.length && <option value="">{t("widget.openLol")}</option>}
                  {options?.accounts.map((a) => (
                    <option key={a.puuid} value={a.puuid}>
                      {a.name ?? t("widget.unnamedAccount")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("widget.queue")}
                <br />
                <select
                  className="select mt-2"
                  aria-label={t("widget.queueAria")}
                  disabled={busy || !options?.accounts.length}
                  value={state.preferences.queue ?? ""}
                  onChange={(e) =>
                    select({ queue: e.target.value === "" ? null : Number(e.target.value) })
                  }
                >
                  {TRACKED_QUEUE_IDS.map((q) => (
                    <option key={q} value={q}>
                      {queueLabel(q)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-sm">{t("widget.historyNote")}</p>
          </section>
          <section className="p-5 rounded-lg border border-lol-border space-y-3">
            <h2 className="text-lg font-semibold text-lol-text-bright">{t("widget.desktop")}</h2>
            <div className="flex flex-wrap gap-4">
              <label>
                {t("widget.height")}
                <select
                  className="select block mt-2"
                  disabled={busy}
                  value={state.preferences.height}
                  onChange={(e) => select({ height: Number(e.target.value) })}
                >
                  {[280, 320, 360, 400, 440, 480, 520, 560].map((height) => (
                    <option key={height} value={height}>
                      {height} px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("widget.opacity")}
                <select
                  className="select block mt-2"
                  disabled={busy}
                  value={state.preferences.opacity}
                  onChange={(e) => select({ opacity: Number(e.target.value) })}
                >
                  {[30, 40, 50, 60, 70, 80, 90, 100].map((opacity) => (
                    <option key={opacity} value={opacity}>
                      {opacity}%
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-sm">{t("widget.desktopNote")}</p>
            <p>{t("widget.dragNote")}</p>
            <button
              className="px-4 py-2 rounded bg-lol-gold/20 text-lol-gold hover:bg-lol-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={busy}
              onClick={() => void run(() => window.api.openWidget())}
            >
              {t("widget.open")}
            </button>
          </section>
          <section className="p-5 rounded-lg border border-lol-border space-y-3">
            <h2 className="text-lg font-semibold text-lol-text-bright">{t("widget.obs")}</h2>
            <p>{t("widget.obsNote")}</p>
            <button
              className="px-4 py-2 rounded bg-lol-gold/20 text-lol-gold hover:bg-lol-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={busy}
              onClick={() => void run(() => window.api.setObsEnabled(!state.obsUrl))}
            >
              {state.obsUrl ? t("widget.stopObs") : t("widget.startObs")}
            </button>
            {state.obsUrl && (
              <label className="block">
                {t("widget.sourceAddress")}
                <input
                  aria-label={t("widget.obsAria")}
                  readOnly
                  value={state.obsUrl}
                  onFocus={(e) => e.target.select()}
                  className="block mt-2 w-full rounded border border-lol-border bg-lol-card p-3"
                />
              </label>
            )}
            <p className="text-sm">{t("widget.obsPrivacy")}</p>
          </section>
        </>
      )}
    </div>
  );
}
