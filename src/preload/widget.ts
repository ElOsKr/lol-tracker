import { contextBridge, ipcRenderer } from "electron";
import type { WidgetControls } from "../shared/widget";
const controls: WidgetControls = {
  snapshot: () => ipcRenderer.invoke("widget:snapshot"),
  minimize: () => ipcRenderer.send("widget:minimize"),
  close: () => ipcRenderer.send("widget:close"),
};
contextBridge.exposeInMainWorld("widgetControls", controls);
