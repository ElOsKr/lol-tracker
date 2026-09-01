import type { ElectronAPI } from "../../shared/api";

// The contract itself lives in src/shared/api.ts, where the preload can reach
// it too. Re-exported here because the renderer names this module everywhere,
// and because the window.api global belongs to the renderer alone.
export * from "../../shared/api";

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
