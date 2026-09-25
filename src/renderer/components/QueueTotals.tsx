import { useEffect } from "react";
import { useIpc } from "../hooks/useIpc";
import { QUEUE_LABELS } from "../../shared/queues";

export default function QueueTotals() {
  const { data, loading, error, refetch } = useIpc(() => window.api.getQueueLifetimeTotals());
  useEffect(
    () =>
      window.api.onGamesUpdated(() => {
        void refetch();
      }),
    [refetch],
  );
  return (
    <details className="px-6 py-2 border-b border-lol-border">
      <summary className="cursor-pointer">Contador de Riot por cola</summary>
      <p className="text-sm my-2">
        Último contador recibido al terminar una partida, independiente del historial guardado. Las
        colas sin una captura todavía no tienen total disponible. La cobertura histórica y el
        tratamiento de remakes están pendientes de validación.
      </p>
      {error ? (
        <p role="alert">
          No se pudieron cargar los contadores.{" "}
          <button onClick={() => void refetch()}>Reintentar</button>
        </p>
      ) : loading && !data ? (
        <p>Cargando…</p>
      ) : !data?.length ? (
        <p>
          Pendiente de capturar: termina una partida con LoLeanding abierto y conserva la pantalla
          de resultados unos segundos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Cola</th>
                <th>Partidas</th>
                <th>Victorias</th>
                <th>Derrotas</th>
                <th>Última captura</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={`${row.puuid}:${row.queueId}`}>
                  <td className="py-2">{row.account}</td>
                  <td>{QUEUE_LABELS[row.queueId] ?? `Cola ${row.queueId}`}</td>
                  <td>{(row.wins + row.losses).toLocaleString()}</td>
                  <td>{row.wins.toLocaleString()}</td>
                  <td>{row.losses.toLocaleString()}</td>
                  <td>{new Date(row.capturedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
