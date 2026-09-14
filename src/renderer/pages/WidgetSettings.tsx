import { TRACKED_QUEUE_IDS } from "../../shared/queues";
import { useEffect, useState } from "react";
import type { MatchFilterOptions } from "../../shared/api";
import type { WidgetState, WidgetPreferences } from "../../shared/widget";
import { queueLabel } from "../components/QueueSelect";

export default function WidgetSettings() {
  const [state, setState] = useState<WidgetState | null>(null);
  const [options, setOptions] = useState<MatchFilterOptions | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
      setError(
        String(err).includes("EADDRINUSE")
          ? "El puerto local 4123 está ocupado. Cierra el widget antiguo u otra aplicación que lo utilice y vuelve a intentarlo."
          : String(err),
      );
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
        <h1 className="text-2xl font-bold text-lol-text-bright">Widget / OBS</h1>
        <p className="mt-2">
          Tu historial en una ventana compacta o como fuente de OBS. Los datos se actualizan cada
          cinco segundos desde esta aplicación.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-lol-loss">
          {error}
        </p>
      )}
      {!state ? (
        <p>Cargando configuración…</p>
      ) : (
        <>
          <section className="p-5 rounded-lg border border-lol-border space-y-4">
            <h2 className="text-lg font-semibold text-lol-text-bright">Historial mostrado</h2>
            <div className="flex flex-wrap gap-4">
              <label>
                Cuenta
                <br />
                <select
                  className="select mt-2"
                  aria-label="Cuenta del widget"
                  disabled={busy || !options?.accounts.length}
                  value={state.preferences.account}
                  onChange={(e) => select({ account: e.target.value })}
                >
                  {!options?.accounts.length && (
                    <option value="">Abre LoL o importa un historial</option>
                  )}
                  {options?.accounts.map((a) => (
                    <option key={a.puuid} value={a.puuid}>
                      {a.name ?? "Cuenta sin nombre"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cola
                <br />
                <select
                  className="select mt-2"
                  aria-label="Cola del widget"
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
            <p className="text-sm">
              Muestra las últimas 15 partidas. El porcentaje se calcula con el historial almacenado
              de la cuenta y cola seleccionadas, excluyendo remakes. No garantiza todas las partidas
              jugadas. Captura ARAM normal, ARAM Caos y Mayhem Classic.
            </p>
          </section>
          <section className="p-5 rounded-lg border border-lol-border space-y-3">
            <h2 className="text-lg font-semibold text-lol-text-bright">Escritorio</h2>
            <div className="flex flex-wrap gap-4">
              <label>
                Altura del widget
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
                Opacidad del widget
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
            <p className="text-sm">
              Se guardan automáticamente y se aplican a la ventana de escritorio. El ancho se
              mantiene en 360 px. La opacidad afecta también al texto y los iconos.
            </p>
            <p>
              Arrastra la cabecera para moverlo. Cerrar el widget mantiene abierta la aplicación.
            </p>
            <button
              className="px-4 py-2 rounded bg-lol-gold/20 text-lol-gold hover:bg-lol-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={busy}
              onClick={() => void run(() => window.api.openWidget())}
            >
              Abrir widget
            </button>
          </section>
          <section className="p-5 rounded-lg border border-lol-border space-y-3">
            <h2 className="text-lg font-semibold text-lol-text-bright">OBS en este ordenador</h2>
            <p>
              Activa la fuente y pega su dirección en una fuente Navegador de OBS: ancho 360 y alto
              560. Mantén League Companion abierto.
            </p>
            <button
              className="px-4 py-2 rounded bg-lol-gold/20 text-lol-gold hover:bg-lol-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={busy}
              onClick={() => void run(() => window.api.setObsEnabled(!state.obsUrl))}
            >
              {state.obsUrl ? "Detener fuente OBS" : "Activar fuente OBS"}
            </button>
            {state.obsUrl && (
              <label className="block">
                Dirección de la fuente
                <input
                  aria-label="Dirección OBS"
                  readOnly
                  value={state.obsUrl}
                  onFocus={(e) => e.target.select()}
                  className="block mt-2 w-full rounded border border-lol-border bg-lol-card p-3"
                />
              </label>
            )}
            <p className="text-sm">
              Solo es accesible desde este PC. No requiere abrir puertos en el router. Se desactiva
              al salir de la aplicación.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
