import { useSyncExternalStore } from "react";
import { isTrackedQueue, QUEUE_ID_ARAM } from "../../shared/queues";

let selected = QUEUE_ID_ARAM;
const listeners = new Set<() => void>();

export function initQueueSelection(value: string | null) {
  const queue = Number(value);
  selected = isTrackedQueue(queue) ? queue : QUEUE_ID_ARAM;
}

let pending: Promise<void> = Promise.resolve();

export async function selectQueue(queue: number | undefined) {
  if (!isTrackedQueue(queue)) return;
  const save = pending
    .catch(() => {})
    .then(async () => {
      await window.api.setSetting("selected_queue", String(queue));
      selected = queue;
      listeners.forEach((listener) => listener());
    });
  pending = save;
  await save;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useQueueSelection() {
  const queue = useSyncExternalStore(subscribe, () => selected);
  return [queue, selectQueue] as const;
}
