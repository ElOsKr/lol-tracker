import { useState } from "react";

import { QUEUE_LABELS, QUEUE_CATALOG } from "../../shared/queues";

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
        className="select max-w-[260px] min-w-0"
      >
        {["Principales", "Otros modos", "Cooperativo y bots", "Personalizadas", "Históricas"].map(
          (group) => (
            <optgroup key={group} label={group}>
              {QUEUE_CATALOG.filter((q) => q.group === group).map((q) => (
                <option key={q.id} value={q.id}>
                  {queueLabel(q.id)}
                </option>
              ))}
            </optgroup>
          ),
        )}
      </select>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
