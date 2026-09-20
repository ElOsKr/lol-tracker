import { useEffect } from "react";
import { useFilterOptions } from "../hooks/useFilterOptions";
import { QUEUE_LABELS } from "../../shared/queues";

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
  const { queues } = useFilterOptions();

  // Clear the selection if new data leaves it without any matching games
  useEffect(() => {
    if (value !== undefined && queues.length > 0 && !queues.includes(value)) {
      onChange(undefined);
    }
  }, [queues, value, onChange]);

  // A queue dropdown is noise while the database only holds one queue
  if (queues.length < 2) return null;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      className="select"
    >
      <option value="">All Queues</option>
      {queues.map((q) => (
        <option key={q} value={q}>
          {queueLabel(q)}
        </option>
      ))}
    </select>
  );
}
