import { useSyncExternalStore } from "react";
import {
  DEFAULT_NAV_LAYOUT,
  HOME_PAGE_SETTING,
  NAV_LAYOUT_SETTING,
  parseNavLayout,
  resolveHomePath,
  serializeNavLayout,
  type NavLayout,
} from "../../shared/navigation";

// Same shape as useQueueSelection: one module-level value, written through the
// settings channel, so the sidebar and the Settings page stay in step.
let layout: NavLayout = DEFAULT_NAV_LAYOUT;
let homePath = "/";
const listeners = new Set<() => void>();

export function initNavLayout(rawLayout: string | null, rawHome: string | null) {
  layout = parseNavLayout(rawLayout);
  homePath = resolveHomePath(rawHome, layout);
}

function notify() {
  listeners.forEach((listener) => listener());
}

let pending: Promise<void> = Promise.resolve();
function queue(write: () => Promise<void>) {
  const save = pending.catch(() => {}).then(write);
  pending = save;
  return save;
}

export function saveNavLayout(next: NavLayout) {
  return queue(async () => {
    await window.api.setSetting(NAV_LAYOUT_SETTING, serializeNavLayout(next));
    layout = next;
    // Hiding the start page sends launch back to the first visible one
    homePath = resolveHomePath(homePath, next);
    notify();
  });
}

export function saveHomePath(path: string) {
  return queue(async () => {
    await window.api.setSetting(HOME_PAGE_SETTING, path);
    homePath = resolveHomePath(path, layout);
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNavLayout() {
  return useSyncExternalStore(subscribe, () => layout);
}

export function useHomePath() {
  return useSyncExternalStore(subscribe, () => homePath);
}
