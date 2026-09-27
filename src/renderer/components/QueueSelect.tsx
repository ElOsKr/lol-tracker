import { useState } from "react";

import { QUEUE_LABELS, QUEUE_CATALOG } from "../../shared/queues";
import { useT } from "../lib/i18n";
import type { TranslationKey } from "../../shared/i18n";

// The catalog names its groups in Spanish; these are the headings shown for them.
const QUEUE_GROUPS: { group: string; label: TranslationKey }[] = [
  { group: "Principales", label: "queueGroup.main" },
  { group: "Otros modos", label: "queueGroup.other" },
  { group: "Cooperativo y bots", label: "queueGroup.coop" },
  { group: "Personalizadas", label: "queueGroup.custom" },
  { group: "Históricas", label: "queueGroup.legacy" },
];

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
  const t = useT();
  return (
    <>
      <select
        value={value ?? ""}
        onChange={(e) => {
          setError("");
          void Promise.resolve(onChange(Number(e.target.value))).catch(() =>
            setError(t("queue.saveFailed")),
          );
        }}
        className="select max-w-[260px] min-w-0"
      >
        {QUEUE_GROUPS.map(({ group, label }) => (
          <optgroup key={group} label={t(label)}>
            {QUEUE_CATALOG.filter((q) => q.group === group).map((q) => (
              <option key={q.id} value={q.id}>
                {queueLabel(q.id)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
