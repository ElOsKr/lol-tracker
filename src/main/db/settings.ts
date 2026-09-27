import { isTrackedQueue } from "../../shared/queues";
import { db } from "./connection";

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  if (key === "selected_queue" && (value === "" || !isTrackedQueue(Number(value))))
    throw new Error("Invalid queue selection");
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}
