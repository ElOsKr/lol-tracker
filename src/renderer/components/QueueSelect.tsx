import { useState } from "react";

import { QUEUE_LABELS, TRACKED_QUEUE_IDS } from "../../shared/queues";

export function queueLabel(queueId: number): string {
  return QUEUE_LABELS[queueId] ?? `Queue ${queueId}`;
}

export default function QueueSelect({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (queue: number | undefined) => void;
}) {
  const [error, setError] = useState("");
  return (
    <>
      <select
        value={value ?? ""}
        onChange={(e) => {
          setError("");
          void Promise.resolve(onChange(Number(e.target.value))).catch(() =>
            setError("No se pudo guardar la cola"),
          );
        }}
        className="select"
      >
        {TRACKED_QUEUE_IDS.map((q) => (
          <option key={q} value={q}>
            {queueLabel(q)}
          </option>
        ))}
      </select>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
