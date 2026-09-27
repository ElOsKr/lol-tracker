import { useEffect } from "react";
import { useIpc } from "../hooks/useIpc";
import { QUEUE_LABELS } from "../../shared/queues";
import { useT } from "../lib/i18n";

export default function QueueTotals() {
  const t = useT();
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
      <summary className="cursor-pointer">{t("totals.summary")}</summary>
      <p className="text-sm my-2">{t("totals.intro")}</p>
      {error ? (
        <p role="alert">
          {t("totals.loadFailed")}{" "}
          <button onClick={() => void refetch()}>{t("totals.retry")}</button>
        </p>
      ) : loading && !data ? (
        <p>{t("totals.loading")}</p>
      ) : !data?.length ? (
        <p>{t("totals.pending")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th>{t("totals.account")}</th>
                <th>{t("totals.queue")}</th>
                <th>{t("totals.games")}</th>
                <th>{t("totals.wins")}</th>
                <th>{t("totals.losses")}</th>
                <th>{t("totals.captured")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={`${row.puuid}:${row.queueId}`}>
                  <td className="py-2">{row.account}</td>
                  <td>{QUEUE_LABELS[row.queueId] ?? t("totals.queueId", { id: row.queueId })}</td>
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
