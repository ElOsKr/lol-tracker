import { app, session, shell } from "electron";

// A URL reaching the main process can name any protocol the OS is willing to
// launch — file:, a UNC path, ms-msdt:. Everything this app opens is a web
// page, so anything else is refused rather than handed to the shell.
export function isAllowedExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function openExternalUrl(url: string): boolean {
  if (!isAllowedExternalUrl(url)) {
    console.warn("Refused to open external URL:", url);
    return false;
  }
  void shell.openExternal(url);
  return true;
}

// The renderer is the only page this app ever hosts: the Vite server in dev, a
// file:// bundle in production. In-app routing is HashRouter, which changes the
// fragment rather than navigating, so nothing legitimate ever triggers a real
// navigation — treat every one as an escape attempt.
function isInternalUrl(url: string): boolean {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl && url.startsWith(devUrl)) return true;
  try {
    const { protocol } = new URL(url);
    // devtools: is Electron's own inspector, which this policy has no business
    // interfering with; about:blank is the empty document, not a destination.
    return protocol === "file:" || protocol === "devtools:" || url === "about:blank";
  } catch {
    return false;
  }
}

// Nothing here uses the camera, microphone, geolocation or notifications, so no
// request for one can be genuine. Applied per session, since the card window
// runs in one of its own.
export function hardenSession(target: Electron.Session) {
  target.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
}

// Call once, after the app is ready and before any window is created.
export function applySecurityPolicy() {
  hardenSession(session.defaultSession);

  app.on("web-contents-created", (_event, contents) => {
    // Links that would open a new window go to the system browser instead. The
    // only second window the app ever has is the offscreen one it draws game
    // cards in, and that is created by the main process, not from a page.
    contents.setWindowOpenHandler(({ url }) => {
      openExternalUrl(url);
      return { action: "deny" };
    });

    contents.on("will-navigate", (event, url) => {
      if (isInternalUrl(url)) return;
      event.preventDefault();
      openExternalUrl(url);
    });

    // No <webview> is used anywhere; refuse to attach one
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  });
}
