import { Menu, Tray, nativeImage } from "electron";
import { t } from "./i18n";

export interface TrayActions {
  showWindow: () => void;
  openWidget: () => void;
  quit: () => void;
}

let tray: Tray | null = null;
let actions: TrayActions | null = null;

export function createTray(iconPath: string, trayActions: TrayActions) {
  actions = trayActions;
  // Drawn at tray sizes rather than scaled down from the window icon. Electron
  // picks up the @2x file beside it on a HiDPI display.
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip("LoLeanding");
  tray.on("double-click", () => trayActions.showWindow());
  refreshTrayMenu();
}

// Rebuilt on creation and whenever the language setting changes: a context
// menu is a snapshot, not a live view of its labels.
export function refreshTrayMenu() {
  if (!tray || !actions) return;
  const { showWindow, openWidget, quit } = actions;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t("tray.showWindow"), click: showWindow },
      { label: t("tray.openWidget"), click: openWidget },
      { type: "separator" },
      { label: t("tray.quit"), click: quit },
    ]),
  );
}
