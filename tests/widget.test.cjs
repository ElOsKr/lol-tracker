const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const http = require("node:http");
const { EventEmitter } = require("node:events");
const ts = require("typescript");

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (name) => (Object.hasOwn(mocks, name) ? mocks[name] : original(name));
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
  return mod.exports;
}
require.extensions[".ts"] = (mod, filename) => {
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
};
const { startWidgetServer } = load("src/main/widget-server.ts");
const root = path.resolve(__dirname, "../public-widget");

test("queue selection persists in order and never clears to all queues", async () => {
  const previous = global.window;
  const writes = [];
  global.window = {
    api: {
      setSetting: async (key, value) => {
        writes.push([key, value]);
      },
    },
  };
  try {
    const selection = load("src/renderer/hooks/useQueueSelection.ts", {
      react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    });
    selection.initQueueSelection(null);
    assert.equal(selection.useQueueSelection()[0], 450);
    await Promise.all([selection.selectQueue(2400), selection.selectQueue(2450)]);
    assert.deepEqual(writes, [
      ["selected_queue", "2400"],
      ["selected_queue", "2450"],
    ]);
    assert.equal(selection.useQueueSelection()[0], 2450);
    await selection.selectQueue(undefined);
    assert.equal(selection.useQueueSelection()[0], 2450);
    global.window.api.setSetting = async () => {
      throw new Error("write failed");
    };
    await assert.rejects(selection.selectQueue(450), /write failed/);
    assert.equal(selection.useQueueSelection()[0], 2450);
    selection.initQueueSelection("2400");
    assert.equal(selection.useQueueSelection()[0], 2400);
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

// El proyecto ya publica sus propias releases, asi que comprobar
// actualizaciones es legitimo. Lo que sigue sin poder ocurrir es instalar un
// ejecutable ajeno: el renderer solo devuelve una URL, y la validacion del
// origen es lo unico que impide apuntar el instalador a otro sitio.
test("an installer can only be fed a download from this project's own releases", async () => {
  const previous = process.env.PORTABLE_EXECUTABLE_FILE;
  process.env.PORTABLE_EXECUTABLE_FILE = "C:\\test\\LoLeanding.exe";
  const originalFetch = global.fetch;
  global.fetch = async () => {
    assert.fail("A rejected URL must not reach the network");
  };
  try {
    const updater = load("src/main/updater.ts", {
      electron: { app: { quit: () => assert.fail("Must not quit") } },
      child_process: { spawn: () => assert.fail("Must not launch an installer") },
    });
    // La release del proyecto original, que es justo la que no debe instalarse
    const upstream = await updater.downloadAndInstall(
      {},
      "https://github.com/Yhprum/mayhem-tracker/releases/download/v1.11.0/MayhemTracker.exe",
    );
    assert.equal(upstream.success, false);
    assert.match(upstream.error, /Unexpected download URL/);

    // Cualquier otro anfitrion, incluido uno que solo se le parezca
    for (const url of [
      "https://github.com/ElOsKr-evil/lol-tracker/releases/download/v1/x.exe",
      "https://example.com/lol-tracker/x.exe",
      "https://github.com/ElOsKr/otro-repo/releases/download/v1/x.exe",
    ]) {
      const bad = await updater.downloadAndInstall({}, url);
      assert.equal(bad.success, false, url);
      assert.match(bad.error, /Unexpected download URL/, url);
    }
  } finally {
    global.fetch = originalFetch;
    if (previous === undefined) delete process.env.PORTABLE_EXECUTABLE_FILE;
    else process.env.PORTABLE_EXECUTABLE_FILE = previous;
  }
});

// GitHub antepone a las notas generadas un comentario HTML con el nombre de la
// configuracion; el dialogo pinta el cuerpo como texto plano, asi que saldria tal cual.
test("release notes drop GitHub's generated-notes comment and the changelog footer", () => {
  const updater = load("src/main/updater.ts", {
    electron: { app: { quit: () => assert.fail("Must not quit") } },
    child_process: { spawn: () => assert.fail("Must not launch an installer") },
  });
  const note = updater.toReleaseNote({
    tag_name: "v0.2.0",
    published_at: "2026-09-26T18:27:00Z",
    html_url: "https://github.com/ElOsKr/lol-tracker/releases/tag/v0.2.0",
    body:
      "<!-- Release notes generated using configuration in .github/release.yml at v0.2.0 -->\r\n\r\n" +
      "## What's Changed\r\n* feat: renombrar la aplicacion a LoLeanding by @ElOsKr in #11\r\n\r\n" +
      "**Full Changelog**: https://github.com/ElOsKr/lol-tracker/compare/v0.1.0...v0.2.0",
  });
  assert.equal(note.version, "0.2.0");
  assert.equal(
    note.body,
    "## What's Changed\n* feat: renombrar la aplicacion a LoLeanding by @ElOsKr in #11",
  );
});

// El tamano y la posicion guardados solo se restauran si siguen cayendo en una
// pantalla conectada; si no, la ventana apareceria fuera de la vista sin poder agarrarla.
test("saved window bounds are restored only when they still land on a display", () => {
  const { pickBounds, MIN_WIDTH, MIN_HEIGHT } = load("src/main/window-state.ts", {
    electron: { screen: { getAllDisplays: () => [] } },
    "./db": { getSetting: () => null, setSetting: () => {} },
  });
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  const second = { x: 1920, y: 0, width: 2560, height: 1400 };

  assert.equal(pickBounds(null, [primary]), null);
  assert.equal(pickBounds({ x: "1", y: 2, width: 3, height: 4 }, [primary]), null);

  const kept = pickBounds({ x: 200, y: 100, width: 1400, height: 900, maximized: true }, [primary]);
  assert.deepEqual(kept, { x: 200, y: 100, width: 1400, height: 900, maximized: true });

  // Un monitor que ya no esta conectado
  assert.equal(
    pickBounds({ x: 2000, y: 100, width: 1400, height: 900, maximized: false }, [primary]),
    null,
  );
  assert.ok(
    pickBounds({ x: 2000, y: 100, width: 1400, height: 900, maximized: false }, [primary, second]),
  );

  // Casi entera fuera por la izquierda o por debajo, o por encima del borde superior
  assert.equal(
    pickBounds({ x: -1350, y: 100, width: 1400, height: 900, maximized: false }, [primary]),
    null,
  );
  assert.equal(
    pickBounds({ x: 200, y: 1010, width: 1400, height: 900, maximized: false }, [primary]),
    null,
  );
  assert.equal(
    pickBounds({ x: 200, y: -300, width: 1400, height: 900, maximized: false }, [primary]),
    null,
  );

  // Nunca por debajo del minimo que impone la propia ventana
  const small = pickBounds({ x: 10, y: 10, width: 300, height: 200, maximized: false }, [primary]);
  assert.equal(small.width, MIN_WIDTH);
  assert.equal(small.height, MIN_HEIGHT);
});

// La barra lateral se configura desde Ajustes: el orden y las paginas ocultas se
// guardan en settings y se leen con manga ancha, para que una pagina nueva o retirada
// nunca deje el menu vacio ni rompa el arranque.
test("the sidebar layout tolerates stale ids and never hides every page", () => {
  const nav = load("src/shared/navigation.ts");
  const all = nav.NAV_ITEMS.map((item) => item.id);

  assert.deepEqual(nav.parseNavLayout(null), nav.DEFAULT_NAV_LAYOUT);
  assert.deepEqual(nav.parseNavLayout("{not json"), nav.DEFAULT_NAV_LAYOUT);

  // Un id retirado se descarta y una pagina nueva se anade al final
  const parsed = nav.parseNavLayout(
    JSON.stringify({ order: ["trends", "old-page", "history"], hidden: ["widget", "old-page"] }),
  );
  assert.deepEqual(parsed.order.slice(0, 2), ["trends", "history"]);
  assert.deepEqual([...parsed.order].sort(), [...all].sort());
  assert.deepEqual(parsed.hidden, ["widget"]);

  // Reordenar no sale de los limites ni pierde elementos
  const first = nav.DEFAULT_NAV_LAYOUT.order[0];
  assert.equal(nav.moveNavItem(nav.DEFAULT_NAV_LAYOUT, first, -1), nav.DEFAULT_NAV_LAYOUT);
  const moved = nav.moveNavItem(nav.DEFAULT_NAV_LAYOUT, first, 1);
  assert.equal(moved.order[1], first);
  assert.equal(moved.order.length, all.length);

  // Nunca puede ocultarse la ultima pagina visible
  let layout = nav.DEFAULT_NAV_LAYOUT;
  for (const id of all) layout = nav.setNavItemHidden(layout, id, true);
  assert.equal(nav.visibleNavItems(layout).length, 1);

  // La pagina de inicio solo vale mientras siga visible
  assert.equal(nav.resolveHomePath("/trends", nav.DEFAULT_NAV_LAYOUT), "/trends");
  const noTrends = nav.setNavItemHidden(nav.DEFAULT_NAV_LAYOUT, "trends", true);
  assert.equal(nav.resolveHomePath("/trends", noTrends), "/");
  assert.equal(nav.resolveHomePath("/nowhere", nav.DEFAULT_NAV_LAYOUT), "/");
  assert.equal(nav.resolveHomePath(null, layout), nav.visibleNavItems(layout)[0].path);
});

test("closing the desktop widget hides it, reopening reuses it, shutdown destroys it", async () => {
  const events = new Map();
  const handlers = new Map();
  const settings = new Map();
  const main = { webContents: { mainFrame: {} } };
  const windows = [];
  class Window extends EventEmitter {
    constructor() {
      super();
      windows.push(this);
      this.visible = false;
      this.destroyed = false;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = {};
      this.webContents.setWindowOpenHandler = () => {};
    }
    async loadFile() {}
    setOpacity(value) {
      this.opacity = value;
    }
    setSize(width, height) {
      this.size = [width, height];
    }
    show() {
      this.visible = true;
    }
    hide() {
      this.visible = false;
    }
    focus() {}
    restore() {}
    isDestroyed() {
      return this.destroyed;
    }
    isVisible() {
      return this.visible;
    }
    close() {
      let prevented = false;
      this.emit("close", {
        preventDefault: () => {
          prevented = true;
        },
      });
      if (!prevented) this.destroy();
    }
    destroy() {
      this.destroyed = true;
      this.emit("closed");
    }
  }
  const widget = load("src/main/widget.ts", {
    electron: {
      app: { getAppPath: () => root },
      BrowserWindow: Window,
      ipcMain: { handle: (key, fn) => handlers.set(key, fn), on: (key, fn) => events.set(key, fn) },
    },
    "./db": {
      getSetting: (key) => settings.get(key) ?? null,
      setSetting: (key, value) => settings.set(key, value),
      getSummoner: () => null,
      getMatchFilterOptions: () => ({ accounts: [] }),
    },
    "./lcu": {},
    "./dragon": {},
    "./widget-server": { startWidgetServer },
  });
  widget.registerWidgetHandlers(() => main);
  widget.openWidget();
  await Promise.resolve();
  const win = windows[0];
  assert.equal(win.opacity, 1);
  const event = { sender: main.webContents, senderFrame: main.webContents.mainFrame };
  handlers.get("widget:preferences")(event, { account: "", queue: 450, height: 280, opacity: 30 });
  assert.deepEqual(win.size, [360, 280]);
  assert.equal(win.opacity, 0.3);
  assert.equal(handlers.get("widget:state")(event).preferences.height, 280);
  events.get("widget:close")({ sender: {}, senderFrame: {} });
  assert.equal(win.visible, true);
  assert.deepEqual(win.size, [360, 280]);
  assert.equal(win.opacity, 0.3);
  events.get("widget:close")({ sender: win.webContents, senderFrame: win.webContents.mainFrame });
  await new Promise(setImmediate);
  assert.equal(win.visible, false);
  assert.equal(win.destroyed, false);
  widget.openWidget();
  assert.equal(windows.length, 1);
  assert.equal(win.visible, true);
  widget.stopWidget();
  assert.equal(win.destroyed, true);
});
const request = (url, headers = {}, method = "GET") =>
  new Promise((resolve, reject) => {
    const req = http.request(url, { headers, method }, (res) => {
      let body = "";
      res.on("data", (part) => (body += part));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });

test("OBS serves only public widget assets and read-only snapshots on loopback", async () => {
  const server = await startWidgetServer(root, () => ({ matches: [], totalMatches: 7 }), 0);
  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:/);
    assert.equal((await request(server.url)).status, 200);
    const base = server.url.replace("/widget.html", "");
    for (const route of ["/widget.css", "/build/widget/widget.js"])
      assert.equal((await request(base + route)).status, 200);
    const data = await request(base + "/api/matches");
    assert.equal(JSON.parse(data.body).totalMatches, 7);
    assert.equal(data.headers["access-control-allow-origin"], undefined);
    assert.equal((await request(base + "/api/matches", {}, "POST")).status, 405);
    assert.equal(
      (await request(base + "/api/matches", { Origin: "https://example.com" })).status,
      403,
    );
    assert.equal((await request(base + "/api/matches", { Host: "example.com" })).status, 403);
    for (const route of ["/data/matches.db", "/src/main/widget.ts", "/package.json", "/api/quit"])
      assert.equal((await request(base + route)).status, 404);
    await assert.rejects(
      startWidgetServer(root, () => ({}), Number(new URL(server.url).port)),
      { code: "EADDRINUSE" },
    );
  } finally {
    server.close();
  }
  await assert.rejects(request(server.url));
});

test("widget shares account/queue filters, excludes remakes from streak and exposes no raw records", () => {
  const handlers = new Map();
  const settings = new Map([
    ["widget_account", "account-a"],
    ["widget_queue", "2400"],
  ]);
  const queries = [];
  const row = {
    game_id: 1,
    win: 1,
    is_remake: 0,
    queue_id: 2400,
    champion_id: 2,
    kills: 4,
    deaths: 2,
    assists: 8,
    game_creation: 1,
    game_version: null,
    augment_ids: null,
    raw_gz: "private",
    puuid: "account-a",
  };
  const main = { webContents: { mainFrame: {} } };
  const widget = load("src/main/widget.ts", {
    electron: {
      app: { getAppPath: () => root },
      ipcMain: { handle: (key, fn) => handlers.set(key, fn), on: () => {} },
    },
    "./db": {
      getSetting: (key) => settings.get(key) ?? null,
      setSetting: (key, value) => settings.set(key, value),
      getSummoner: () => null,
      getStoredQueues: () => [2400],
      getMatchFilterOptions: () => ({ accounts: [{ puuid: "account-a", name: "Demo" }] }),
      getDashboardData: (filters) => {
        queries.push(filters);
        return { wins: 6, totalGames: 10 };
      },
      getMatchHistory: (_limit, _offset, filters) => {
        queries.push(filters);
        return {
          total: 4,
          matches: [
            row,
            { ...row, game_id: 2, win: 0, is_remake: 1 },
            { ...row, game_id: 3 },
            { ...row, game_id: 4, win: 0 },
          ],
        };
      },
    },
    "./lcu": { isClientConnected: () => false },
    "./dragon": {
      getChampionDataVersion: () => "",
      loadAugmentData: async () => ({}),
      loadItemData: async () => ({}),
    },
    "./widget-server": { startWidgetServer },
  });
  widget.registerWidgetHandlers(() => main);
  const snapshot = widget.widgetSnapshot();
  assert.deepEqual(queries, [
    { account: "account-a", queue: 2400 },
    { account: "account-a", queue: 2400 },
  ]);
  assert.equal(snapshot.streak, 2);
  assert.equal(snapshot.totalWinrate, 60);
  assert.equal(snapshot.totalLosses, 4);
  assert.equal(snapshot.connected, false);
  assert.equal(snapshot.matches[1].remake, true);
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
  assert.equal(JSON.stringify(snapshot).includes("account-a"), false);
  assert.throws(
    () => handlers.get("widget:state")({ sender: {}, senderFrame: {} }),
    /Invalid widget sender/,
  );
  const event = { sender: main.webContents, senderFrame: main.webContents.mainFrame };
  assert.throws(
    () => handlers.get("widget:preferences")(event, { account: "other", queue: null }),
    /Invalid widget selection/,
  );
  const appearance = { account: "account-a", queue: 450, height: 320, opacity: 60 };
  handlers.get("widget:preferences")(event, appearance);
  assert.equal(settings.get("widget_queue"), "450");
  assert.equal(settings.get("widget_height"), "320");
  assert.equal(settings.get("widget_opacity"), "60");
  for (const change of [
    { height: 0 },
    { height: 1000 },
    { opacity: 0 },
    { opacity: 101 },
    { opacity: NaN },
  ]) {
    assert.throws(
      () => handlers.get("widget:preferences")(event, { ...appearance, ...change }),
      /Invalid widget selection/,
    );
  }
});

// El paquete se llamó mayhem-tracker hasta la 0.2.0, y Electron deriva la
// carpeta userData del nombre: las instalaciones anteriores guardan sus
// partidas bajo el nombre viejo. Se mueven solo data y backups, nunca la
// carpeta entera, porque Chromium ya ha creado la nueva cuando esto corre.
test("legacy data and backups move to the renamed userData folder exactly once", () => {
  const os = require("node:os");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "loleanding-migrate-"));
  const oldRoot = path.join(root, "mayhem-tracker");
  const newRoot = path.join(root, "loleanding");
  fs.mkdirSync(path.join(oldRoot, "data"), { recursive: true });
  fs.mkdirSync(path.join(oldRoot, "backups"), { recursive: true });
  fs.mkdirSync(path.join(oldRoot, "Cache"), { recursive: true });
  fs.writeFileSync(path.join(oldRoot, "data", "matches.db"), "db");
  fs.writeFileSync(path.join(oldRoot, "backups", "a.db"), "bak");
  fs.writeFileSync(path.join(oldRoot, "Cache", "x"), "cache");
  // Chromium creates the new folder before the app gets a turn
  fs.mkdirSync(newRoot, { recursive: true });
  try {
    const paths = load("src/main/paths.ts", { electron: { app: {} } });

    assert.deepEqual(paths.migrateLegacyRoot(oldRoot, newRoot), ["data", "backups"]);
    assert.equal(fs.readFileSync(path.join(newRoot, "data", "matches.db"), "utf8"), "db");
    assert.equal(fs.readFileSync(path.join(newRoot, "backups", "a.db"), "utf8"), "bak");
    assert.ok(!fs.existsSync(path.join(oldRoot, "data")), "old data folder is gone");
    assert.ok(fs.existsSync(path.join(oldRoot, "Cache")), "unrelated old folders stay put");

    // Second launch: nothing left to move
    assert.deepEqual(paths.migrateLegacyRoot(oldRoot, newRoot), []);

    // A new install that already has its own data never gets overwritten
    fs.mkdirSync(path.join(oldRoot, "data"), { recursive: true });
    fs.writeFileSync(path.join(oldRoot, "data", "matches.db"), "stale");
    assert.deepEqual(paths.migrateLegacyRoot(oldRoot, newRoot), []);
    assert.equal(fs.readFileSync(path.join(newRoot, "data", "matches.db"), "utf8"), "db");

    // No old folder at all, and same folder twice: both are no-ops
    assert.deepEqual(paths.migrateLegacyRoot(path.join(root, "nope"), newRoot), []);
    assert.deepEqual(paths.migrateLegacyRoot(newRoot, newRoot), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("migrateLegacyUserData resolves the old folder next to the new one and only when packaged", () => {
  const os = require("node:os");
  const appData = fs.mkdtempSync(path.join(os.tmpdir(), "loleanding-appdata-"));
  const oldRoot = path.join(appData, "mayhem-tracker");
  const newRoot = path.join(appData, "loleanding");
  fs.mkdirSync(path.join(oldRoot, "data"), { recursive: true });
  fs.writeFileSync(path.join(oldRoot, "data", "matches.db"), "db");
  const app = (packaged) => ({
    isPackaged: packaged,
    getPath: (name) => (name === "appData" ? appData : newRoot),
  });
  try {
    // Development runs keep their data in the project folder; nothing to touch
    load("src/main/paths.ts", { electron: { app: app(false) } }).migrateLegacyUserData();
    assert.ok(fs.existsSync(path.join(oldRoot, "data")), "dev leaves the old folder alone");

    load("src/main/paths.ts", { electron: { app: app(true) } }).migrateLegacyUserData();
    assert.equal(fs.readFileSync(path.join(newRoot, "data", "matches.db"), "utf8"), "db");
    assert.ok(!fs.existsSync(path.join(oldRoot, "data")));
  } finally {
    fs.rmSync(appData, { recursive: true, force: true });
  }
});

test("the Spanish dictionary covers every key and translate fills placeholders", () => {
  const i18n = load("src/shared/i18n/index.ts");
  const { en } = load("src/shared/i18n/en.ts");
  const { es } = load("src/shared/i18n/es.ts");
  const enKeys = Object.keys(en);
  const esKeys = Object.keys(es);
  assert.ok(enKeys.length > 400, `unexpectedly small dictionary: ${enKeys.length}`);
  assert.deepEqual(
    esKeys.filter((k) => !(k in en)),
    [],
    "Spanish has keys English does not",
  );
  assert.deepEqual(
    enKeys.filter((k) => !(k in es)),
    [],
    "English keys missing from Spanish",
  );
  // A placeholder used in English must survive translation, or a number silently vanishes
  for (const key of enKeys) {
    const wanted = (en[key].match(/\{\w+\}/g) ?? []).sort();
    const got = (es[key].match(/\{\w+\}/g) ?? []).sort();
    assert.deepEqual(got, wanted, `placeholders differ for ${key}`);
  }

  assert.equal(i18n.translate("en", "settings.gamesCount", { count: 3 }), "3 games");
  assert.equal(i18n.translate("es", "settings.gamesCount", { count: 3 }), "3 partidas");
  // Unknown params are left visible rather than blanked
  assert.equal(i18n.translate("en", "settings.gamesCount"), "{count} games");

  assert.equal(i18n.resolveLanguage("system", "es-ES"), "es");
  assert.equal(i18n.resolveLanguage("system", "en-US"), "en");
  assert.equal(i18n.resolveLanguage("system", "fr-FR"), "en");
  assert.equal(i18n.resolveLanguage("en", "es-ES"), "en");
  assert.equal(i18n.parseLanguageChoice("de"), "system");
  assert.equal(i18n.parseLanguageChoice(null), "system");
  assert.equal(i18n.parseLanguageChoice("es"), "es");
});
