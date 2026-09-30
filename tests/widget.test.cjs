const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const http = require("node:http");
const { EventEmitter } = require("node:events");
const esbuild = require("esbuild");
const transpile = (code) =>
  esbuild.transformSync(code, { loader: "ts", format: "cjs", target: "es2022" }).code;

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (name) => (Object.hasOwn(mocks, name) ? mocks[name] : original(name));
  mod._compile(transpile(fs.readFileSync(filename, "utf8")), filename);
  return mod.exports;
}
require.extensions[".ts"] = (mod, filename) => {
  mod._compile(transpile(fs.readFileSync(filename, "utf8")), filename);
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

// Las notas generadas por GitHub listan los pull requests con su prefijo de
// commit, el autor y el enlace, y meten tambien documentacion y chores. El
// dialogo de actualizacion solo debe ensenar lo que un usuario nota.
test("release notes keep only user-facing changes, without commit prefixes, authors or links", () => {
  const updater = load("src/main/updater.ts", {
    electron: { app: { quit: () => assert.fail("Must not quit") } },
    child_process: { spawn: () => assert.fail("Must not launch an installer") },
  });
  const note = updater.toReleaseNote({
    tag_name: "v0.3.0",
    published_at: "2026-09-27T20:00:00Z",
    html_url: "https://github.com/ElOsKr/lol-tracker/releases/tag/v0.3.0",
    body:
      "<!-- Release notes generated using configuration in .github/release.yml at v0.3.0 -->\r\n\r\n" +
      "## What's Changed\r\n" +
      "### Nuevas funciones\r\n" +
      "* feat: recordar el tamaño y la posición de la ventana by @ElOsKr in https://github.com/ElOsKr/lol-tracker/pull/21\r\n" +
      "* feat: interfaz en español e inglés (#13) by @ElOsKr in https://github.com/ElOsKr/lol-tracker/pull/23\r\n" +
      "### Correcciones\r\n" +
      "* fix(updater): quitar el comentario HTML de las notas by @ElOsKr in https://github.com/ElOsKr/lol-tracker/pull/20\r\n" +
      "### Documentación\r\n" +
      "* docs: plantilla de pull request by @ElOsKr in https://github.com/ElOsKr/lol-tracker/pull/19\r\n" +
      "* chore: versión 0.3.0 (cierre del Hito 1) by @ElOsKr in https://github.com/ElOsKr/lol-tracker/pull/24\r\n" +
      "### Otros cambios\r\n" +
      "* docs: añadir la hoja de ruta by @ElOsKr in https://github.com/ElOsKr/lol-tracker/pull/12\r\n\r\n" +
      "## New Contributors\r\n* @alguien made their first contribution in https://github.com/ElOsKr/lol-tracker/pull/25\r\n\r\n" +
      "**Full Changelog**: https://github.com/ElOsKr/lol-tracker/compare/v0.2.0...v0.3.0",
  });
  assert.equal(note.version, "0.3.0");
  assert.equal(
    note.body,
    "### Nuevas funciones\n" +
      "* Recordar el tamaño y la posición de la ventana\n" +
      "* Interfaz en español e inglés\n\n" +
      "### Correcciones\n" +
      "* Quitar el comentario HTML de las notas",
  );

  // Sin categorias (sin .github/release.yml) no hay por donde filtrar: se limpia cada linea y se conservan todas
  const flat = updater.toReleaseNote({
    tag_name: "v0.2.0",
    body: "## What's Changed\n* feat: renombrar la aplicacion a LoLeanding by @ElOsKr in #11\n",
  });
  assert.equal(flat.body, "* Renombrar la aplicacion a LoLeanding");

  // Unas notas escritas a mano en GitHub llegan tal cual
  const handwritten = updater.toReleaseNote({
    tag_name: "v0.4.0",
    body: "## Novedades\n* La app habla español.\n\n**Full Changelog**: https://x/compare/a...b",
  });
  assert.equal(handwritten.body, "## Novedades\n* La app habla español.");
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

  // Un id retirado se descarta y una pagina nueva se anade al final, salvo
  // la de inicio, que se coloca delante de todo
  const parsed = nav.parseNavLayout(
    JSON.stringify({ order: ["trends", "old-page", "history"], hidden: ["widget", "old-page"] }),
  );
  assert.deepEqual(parsed.order.slice(0, 3), ["home", "trends", "history"]);
  assert.equal(parsed.order.includes("live"), true);
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
  assert.equal(nav.resolveHomePath("/trends", noTrends), "/home");
  assert.equal(nav.resolveHomePath("/nowhere", nav.DEFAULT_NAV_LAYOUT), "/home");
  assert.equal(nav.resolveHomePath("/", nav.DEFAULT_NAV_LAYOUT), "/");
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
  let pending = null;
  let recapsOpened = 0;
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
    "./lcu": { isClientConnected: () => true },
    "./dragon": {
      getChampionDataVersion: () => "test",
      loadAugmentData: async () => ({}),
      loadItemData: async () => ({}),
    },
    "./notice-state": { pendingNotice: () => pending },
    "./notice": {
      showRecap: () => {
        recapsOpened++;
      },
    },
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
  // El aviso de fin de partida: la ventana de escritorio lo recibe siempre, y
  // OBS solo cuando se ha activado, porque sirven la misma pagina.
  assert.equal(widget.isWidgetDesktopOpen(), true);
  assert.equal(widget.widgetSnapshot().notice, null);
  pending = { gameId: 7, win: true };
  assert.equal(widget.widgetSnapshot().notice, pending);
  assert.equal(widget.widgetSnapshot(true).notice, null);
  settings.set("game_notice_obs", "true");
  assert.equal(widget.widgetSnapshot(true).notice, pending);

  // Solo la propia ventana del widget puede pedir que se abra el resumen
  events.get("widget:open-recap")({ sender: {}, senderFrame: {} });
  assert.equal(recapsOpened, 0);
  events.get("widget:open-recap")({
    sender: win.webContents,
    senderFrame: win.webContents.mainFrame,
  });
  assert.equal(recapsOpened, 1);

  widget.stopWidget();
  assert.equal(win.destroyed, true);
  assert.equal(widget.isWidgetDesktopOpen(), false);
});

test("the end-of-game notice says the most telling thing, and goes stale", () => {
  const { chooseHighlight, NOTICE_MAX_AGE_MS } = load("src/shared/notice.ts");
  const queueLabel = "ARAM Mayhem";
  const streak = { kind: "win", length: 4 };
  const session = { wins: 3, losses: 3 };

  // Una nota entre las tres mejores manda sobre todo lo demas
  assert.deepEqual(chooseHighlight({ scoreRank: 1, streak, session, queueLabel }), {
    key: "notice.bestScore",
    params: { queue: queueLabel },
  });
  assert.equal(
    chooseHighlight({ scoreRank: 3, streak, session, queueLabel }).key,
    "notice.thirdBest",
  );
  // La cuarta mejor ya no es noticia: pasa el turno a la racha
  assert.deepEqual(chooseHighlight({ scoreRank: 4, streak, session, queueLabel }), {
    key: "notice.streakWins",
    params: { count: 4 },
  });
  assert.equal(
    chooseHighlight({ scoreRank: null, streak: { kind: "loss", length: 3 }, session, queueLabel })
      .key,
    "notice.streakLosses",
  );
  // Una racha de dos no se anuncia; queda el recuento del dia
  assert.deepEqual(
    chooseHighlight({ scoreRank: null, streak: { kind: "win", length: 2 }, session, queueLabel }),
    { key: "notice.session", params: { wins: 3, losses: 3, queue: queueLabel } },
  );
  // Y la primera partida del dia no tiene nada que contar
  assert.equal(
    chooseHighlight({
      scoreRank: null,
      streak: { kind: "win", length: 1 },
      session: { wins: 1, losses: 0 },
      queueLabel,
    }),
    null,
  );

  // Un aviso guardado caduca, para que el widget no lo saque al volver de un rato
  const state = load("src/main/notice-state.ts");
  const now = Date.now();
  assert.equal(state.pendingNotice(now), null);
  state.setPendingNotice({ gameId: 1, raisedAt: now });
  assert.equal(state.pendingNotice(now + 1000).gameId, 1);
  assert.equal(state.pendingNotice(now + NOTICE_MAX_AGE_MS + 1), null);
  // Y una vez caducado no vuelve
  assert.equal(state.pendingNotice(now), null);
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
  // Sin cola propia, el widget sigue la de la aplicacion: la consulta va sin
  // cola y db.ts aplica la seleccionada. Antes caia a ARAM normal, y quien
  // nunca abria la pagina del widget veia partidas de otra cola.
  handlers.get("widget:preferences")(event, { ...appearance, queue: null });
  assert.equal(settings.get("widget_queue"), "");
  queries.length = 0;
  widget.widgetSnapshot();
  assert.deepEqual(queries, [
    { account: "account-a", queue: undefined },
    { account: "account-a", queue: undefined },
  ]);
  assert.equal(widget.widgetSnapshot().preferences, undefined);
  assert.equal(handlers.get("widget:state")(event).preferences.queue, null);
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

test("the home summary reads streak, session and best champion off the career rows", () => {
  const home = load("src/main/db/home.ts", {
    "./filters": { selectedQueue: () => 450 },
    "./records": { careerRows: () => [] },
  });
  const day = 24 * 60 * 60 * 1000;
  // Two in the morning, so the last session started the evening before
  const now = Date.UTC(2026, 8, 28, 0);
  let id = 0;
  const row = (champion, win, at, score = null) => ({
    game_id: ++id,
    game_creation: at,
    game_duration: 1200,
    queue_id: 450,
    champion_id: champion,
    win: win ? 1 : 0,
    kills: 5,
    deaths: 2,
    assists: 8,
    total_damage_dealt: 0,
    total_damage_taken: 0,
    gold_earned: 0,
    total_heal: 0,
    largest_killing_spree: 0,
    score,
    score_raw: score,
    score_badge: null,
    double_kills: 0,
    triple_kills: 0,
    quadra_kills: 0,
    penta_kills: 0,
  });

  const empty = home.summarizeHome([], 450, now);
  assert.equal(empty.totalGames, 0);
  assert.equal(empty.streak, null);
  assert.equal(empty.session, null);
  assert.equal(empty.bestChampion, null);
  assert.deepEqual(empty.recentGames, []);

  const rows = [
    // Old games outside the champion window, with the longest win streak ever
    row(1, true, now - 60 * day, 9),
    row(1, true, now - 59 * day, 9),
    row(1, true, now - 58 * day, 9),
    // Inside the window: champion 2 has one great game, champion 3 three decent ones
    row(2, false, now - 10 * day, 10),
    row(3, true, now - 9 * day, 7),
    row(3, false, now - 8 * day, 6),
    row(3, true, now - 7 * day, 8),
    // The last session: an evening that ran past midnight and still counts as one day
    row(4, false, now - 4 * 3600 * 1000, 5),
    row(4, true, now - 2 * 3600 * 1000, 6),
    row(4, true, now - 1 * 3600 * 1000, 8),
  ];
  const summary = home.summarizeHome(rows, 450, now);
  assert.equal(summary.totalGames, 10);
  assert.equal(summary.lastGameAt, rows[9].game_creation);
  assert.deepEqual(summary.streak, { kind: "win", length: 2, best: 3 });
  assert.deepEqual(summary.recentResults, [1, 1, 1, 0, 1, 0, 1, 0, 1, 1]);
  assert.equal(summary.session.games, 3);
  assert.equal(summary.session.wins, 2);
  assert.equal(summary.session.losses, 1);
  assert.equal(summary.session.duration, 3600);
  assert.equal(summary.session.avgScore.toFixed(2), "6.33");
  assert.equal(summary.windowGames, 7);
  // Champion 2's single 10 doesn't beat champion 3's three games
  assert.equal(summary.bestChampion.championId, 3);
  assert.equal(summary.bestChampion.games, 3);
  assert.equal(summary.bestChampion.wins, 2);
  assert.equal(summary.bestChampion.rankedBy, "score");
  assert.deepEqual(
    summary.recentGames.map((g) => g.game_id),
    [10, 9, 8],
  );

  // A queue without a score ranks on win rate instead, and with nobody at the
  // minimum the most played champion stands in
  const few = [row(7, false, now - day), row(8, true, now - day), row(8, false, now - 2 * day)];
  const fallback = home.summarizeHome(few, 400, now);
  assert.equal(fallback.bestChampion.championId, 8);
  assert.equal(fallback.bestChampion.rankedBy, "winRate");
  assert.equal(fallback.streak.kind, "loss");
});

test("keyboard shortcuts stay out of the way while typing and of the window manager", () => {
  const { matchShortcut } = load("src/renderer/lib/shortcuts.ts");
  const press = (over) => ({
    key: "1",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    inField: false,
    ...over,
  });

  // Los numeros abren la pagina n, contando desde cero
  assert.deepEqual(matchShortcut(press({ key: "1" })), { kind: "nav", index: 0 });
  assert.deepEqual(matchShortcut(press({ key: "9" })), { kind: "nav", index: 8 });
  // El cero no cuenta, y tampoco un numero escrito en una caja de texto
  assert.equal(matchShortcut(press({ key: "0" })), null);
  assert.equal(matchShortcut(press({ key: "3", inField: true })), null);
  // Ni con mayusculas o simbolos por encima del numero
  assert.equal(matchShortcut(press({ key: "1", shiftKey: true })), null);

  // Las combinaciones con Ctrl llevan su propio modificador, asi que valen
  // tambien mientras se escribe
  assert.deepEqual(matchShortcut(press({ key: "f", ctrlKey: true })), { kind: "search" });
  assert.deepEqual(matchShortcut(press({ key: "F", ctrlKey: true, inField: true })), {
    kind: "search",
  });
  assert.deepEqual(matchShortcut(press({ key: "r", ctrlKey: true })), { kind: "sync" });
  // Ctrl+Shift+R y Ctrl+G no son nuestros
  assert.equal(matchShortcut(press({ key: "r", ctrlKey: true, shiftKey: true })), null);
  assert.equal(matchShortcut(press({ key: "g", ctrlKey: true })), null);
  // Alt es del gestor de ventanas
  assert.equal(matchShortcut(press({ key: "f", ctrlKey: true, altKey: true })), null);
  assert.equal(matchShortcut(press({ key: "2", altKey: true })), null);
});

test("the Riot Client is found where it records itself, and nowhere it isn't", () => {
  const client = "C:\\Riot Games\\Riot Client\\RiotClientServices.exe";
  const other = "D:\\Juegos\\Riot Client\\RiotClientServices.exe";
  let installs = null;
  let present = [];
  const launcher = load("src/main/riot-launcher.ts", {
    electron: { app: { getPath: () => "C:\\Escritorio" }, shell: {} },
    child_process: { spawn: () => ({ unref() {} }) },
    fs: {
      readFileSync: () => {
        if (installs === null) throw new Error("no such file");
        return installs;
      },
      existsSync: (p) => present.includes(p),
    },
    "./shortcut": { APP_USER_MODEL_ID: "com.test" },
    "./i18n": { t: (key) => key },
  });

  // Sin registro, queda la ruta por defecto, y solo si existe de verdad
  present = [];
  assert.equal(launcher.findRiotClient(), null);
  present = [client];
  assert.equal(launcher.findRiotClient(), client);

  // El registro manda sobre la ruta por defecto, y rc_live sobre rc_default
  installs = JSON.stringify({ rc_default: client, rc_live: other });
  present = [client, other];
  assert.equal(launcher.findRiotClient(), other);
  // Un rc_live que ya no está cede el turno al siguiente candidato
  present = [client];
  assert.equal(launcher.findRiotClient(), client);
  // Las barras del fichero son las de la web; la ruta sale en formato Windows
  installs = JSON.stringify({ rc_live: "C:/Riot Games/Riot Client/RiotClientServices.exe" });
  present = [client];
  assert.equal(launcher.findRiotClient(), client);
  // Un registro ilegible no rompe nada
  installs = "{no es json";
  assert.equal(launcher.findRiotClient(), client);

  // Sin cliente no hay atajo que crear, y el fallo se cuenta
  installs = null;
  present = [];
  assert.equal(launcher.launchLeague(), false);
  assert.deepEqual(launcher.createLeagueShortcut(), {
    success: false,
    error: "startup.shortcutNotPackaged",
  });
});

test("the item catalogue keeps what is an item, and finds it by name or category", () => {
  const items = load("src/renderer/lib/items.ts");
  const data = {
    3031: {
      name: "Infinity Edge",
      description: "",
      iconPath: "",
      branch: "latest",
      priceTotal: 3500,
      price: 725,
      from: [1038],
      to: [],
      categories: ["CriticalStrike", "Damage"],
      inStore: true,
    },
    1038: {
      name: "B. F. Sword",
      description: "",
      iconPath: "",
      branch: "latest",
      priceTotal: 1300,
      price: 1300,
      from: [],
      to: [3031],
      categories: ["Damage"],
      inStore: true,
    },
    9999: {
      name: "Pieza interna",
      description: "",
      iconPath: "",
      branch: "latest",
      priceTotal: 0,
      price: 0,
      from: [],
      to: [],
      categories: [],
      inStore: false,
    },
    8888: {
      name: "Retirado",
      description: "",
      iconPath: "",
      branch: "latest",
      priceTotal: 2500,
      price: 900,
      from: [],
      to: [],
      categories: ["Health"],
      inStore: false,
    },
    7777: {
      name: "",
      description: "",
      iconPath: "",
      branch: "latest",
      priceTotal: 0,
      price: 0,
      from: [],
      to: [],
      categories: [],
      inStore: true,
    },
  };
  const usage = [
    { item_id: 3031, games: 40, wins: 24 },
    { item_id: 8888, games: 3, wins: 1 },
  ];

  const catalog = items.buildCatalog(data, usage);
  const ids = catalog.map((i) => i.id).sort((a, b) => a - b);
  // Fuera de la tienda se descarta, salvo el retirado que el jugador sí uso;
  // y una entrada sin nombre no es un objeto
  assert.deepEqual(ids, [1038, 3031, 8888]);
  assert.equal(catalog.find((i) => i.id === 3031).games, 40);
  assert.equal(catalog.find((i) => i.id === 1038).games, 0);

  // Categorias por frecuencia y luego alfabeticamente
  assert.deepEqual(items.catalogCategories(catalog), ["Damage", "CriticalStrike", "Health"]);
  assert.equal(items.formatCategory("CriticalStrike"), "Critical Strike");

  const all = { search: "", category: "", mineOnly: false };
  // La busqueda entra por el nombre y tambien por la categoria ya legible
  assert.deepEqual(
    items.filterItems(catalog, { ...all, search: "sword" }).map((i) => i.id),
    [1038],
  );
  assert.deepEqual(
    items.filterItems(catalog, { ...all, search: "critical" }).map((i) => i.id),
    [3031],
  );
  assert.deepEqual(
    items
      .filterItems(catalog, { ...all, category: "Damage" })
      .map((i) => i.id)
      .sort(),
    [1038, 3031],
  );
  assert.deepEqual(
    items
      .filterItems(catalog, { ...all, mineOnly: true })
      .map((i) => i.id)
      .sort(),
    [3031, 8888],
  );

  // Las variantes que Riot publica por modo se juntan en una fila y suman
  const variants = items.buildCatalog(
    {
      1: {
        name: "B. F. Sword",
        description: "",
        iconPath: "",
        branch: "l",
        priceTotal: 1300,
        price: 1300,
        from: [],
        to: [],
        categories: ["Damage"],
        inStore: true,
      },
      2: {
        name: "B. F. Sword",
        description: "",
        iconPath: "",
        branch: "l",
        priceTotal: 1550,
        price: 1550,
        from: [],
        to: [],
        categories: ["Damage"],
        inStore: true,
      },
    },
    [
      { item_id: 1, games: 4, wins: 3 },
      { item_id: 2, games: 6, wins: 1 },
    ],
  );
  const merged = items.mergeByName(variants);
  assert.equal(merged.length, 1);
  // Se queda la mas jugada, pero el recuento es el de las dos
  assert.equal(merged[0].id, 2);
  assert.equal(merged[0].games, 10);
  assert.equal(merged[0].wins, 4);

  // Por tus partidas primero, por coste despues, y por nombre cuando se pide
  assert.deepEqual(
    items.sortItems(catalog, "games").map((i) => i.id),
    [3031, 8888, 1038],
  );
  assert.deepEqual(
    items.sortItems(catalog, "cost").map((i) => i.id),
    [3031, 8888, 1038],
  );
  assert.deepEqual(
    items.sortItems(catalog, "name").map((i) => i.name),
    ["B. F. Sword", "Infinity Edge", "Retirado"],
  );
});

test("the augment catalogue lists them all, picked or not", () => {
  const { buildAugmentCatalog } = load("src/renderer/lib/augments.ts");
  const data = {
    1: { name: "Ataque veloz", desc: "", iconPath: "", rarity: "kSilver", branch: "l" },
    2: { name: "Dedos de hada", desc: "", iconPath: "", rarity: "kGold", branch: "l" },
    3: { name: "", desc: "", iconPath: "", rarity: "kSilver", branch: "l" },
  };
  const stats = [
    { augment_id: 2, picks: 7, wins: 4, champions: [{ champion_id: 9, picks: 7, wins: 4 }] },
    { augment_id: 99, picks: 2, wins: 1, champions: [] },
  ];

  const rows = buildAugmentCatalog(data, stats);
  const byId = new Map(rows.map((r) => [r.augment_id, r]));
  // El que nunca se ha elegido entra a cero
  assert.equal(byId.get(1).picks, 0);
  assert.deepEqual(byId.get(1).champions, []);
  // El elegido conserva sus cifras y su desglose
  assert.equal(byId.get(2).picks, 7);
  assert.equal(byId.get(2).champions.length, 1);
  // Una entrada sin nombre es relleno interno de Riot y se descarta
  assert.equal(byId.has(3), false);
  // Uno retirado del catalogo pero que el jugador si eligio sigue estando
  assert.equal(byId.get(99).picks, 2);
  assert.equal(rows.length, 3);
});

test("patch marks land on the right bucket, and crowded labels give way", () => {
  const previous = global.window;
  global.window = { api: { locale: "es-ES" } };
  let trends;
  try {
    trends = load("src/renderer/lib/trends.ts");
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
  const { bucketKeyFor, patchMarks, placeMarks } = trends;

  // Una semana se identifica por su lunes; un mes, por su mes
  assert.equal(bucketKeyFor(new Date(2026, 8, 24), "week"), "2026-09-21");
  assert.equal(bucketKeyFor(new Date(2026, 8, 21), "week"), "2026-09-21");
  assert.equal(bucketKeyFor(new Date(2026, 8, 24), "month"), "2026-09");

  const week = (key) => ({ key, label: key, games: 0, wins: 0, scoreSum: 0, scoredGames: 0 });
  const buckets = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"].map(week);
  const patch = (name, date) => ({
    patch: name,
    games: 1,
    wins: 1,
    avg_score: null,
    first_played: date.getTime(),
  });

  const marks = patchMarks(
    buckets,
    [
      // Abre la gráfica: sin marca, la línea caería sobre el eje
      patch("16.17", new Date(2026, 7, 31)),
      patch("16.18", new Date(2026, 8, 9)),
      // Dos parches en la misma semana: una sola marca, con el último
      patch("16.19", new Date(2026, 8, 22)),
      patch("16.20", new Date(2026, 8, 25)),
      // Fuera de los tramos dibujados: no hay dónde ponerla
      patch("16.21", new Date(2027, 0, 5)),
    ],
    "week",
  );
  // El número sale como lo enseña el resto de la app: 16.x se lee 26.x
  assert.deepEqual(marks, [
    { index: 1, label: "26.18" },
    { index: 3, label: "26.20" },
  ]);

  // Con sitio de sobra, las dos llevan número
  const roomy = placeMarks(marks, 38, 60);
  assert.deepEqual(
    roomy.map((m) => [m.x, m.labelled]),
    [
      [98, true],
      [218, true],
    ],
  );
  // Apretadas, la segunda conserva la línea y pierde el número
  const tight = placeMarks(
    [
      { index: 1, label: "a" },
      { index: 2, label: "b" },
    ],
    0,
    10,
  );
  assert.deepEqual(
    tight.map((m) => m.labelled),
    [true, false],
  );
});

test("a game's place among the ten is ranked on the raw score, and ties share it", () => {
  const scoring = load("src/main/db/scoring.ts", {
    "../dragon": {
      getChampionClasses: () => ({}),
      getChampionDataVersion: () => "test",
    },
    "./connection": { db: { prepare: () => ({ all: () => [], run: () => {}, get: () => null }) } },
    "./settings": { getSetting: () => null, setSetting: () => {} },
  });

  // Diez jugadores; el reparto de dano decide la nota, lo demas es igual
  const player = (id, puuid, damage) => ({
    participant_id: id,
    puuid,
    team_id: id <= 5 ? 100 : 200,
    champion_id: id,
    win: id <= 5 ? 1 : 0,
    kills: 5,
    deaths: 5,
    assists: 5,
    double_kills: 0,
    triple_kills: 0,
    quadra_kills: 0,
    penta_kills: 0,
    total_damage_dealt: damage,
    total_damage_taken: 10000,
    gold_earned: 10000,
    total_heal: 1000,
  });

  const damages = [30000, 25000, 20000, 15000, 12000, 11000, 10000, 9000, 8000, 7000];
  const rows = damages.map((d, i) => player(i + 1, "p" + (i + 1), d));

  // El que mas dano hace es el primero; el que menos, el ultimo
  const best = scoring.computeOwnerStanding(rows, "p1", 450);
  assert.equal(best.rank, 1);
  assert.equal(best.total, 10);
  const worst = scoring.computeOwnerStanding(rows, "p10", 450);
  assert.equal(worst.rank, 10);
  const third = scoring.computeOwnerStanding(rows, "p3", 450);
  assert.equal(third.rank, 3);

  // Empate: dos identicos comparten puesto y nadie ocupa el siguiente
  const tied = damages.map((d, i) => player(i + 1, "p" + (i + 1), i < 2 ? 30000 : d));
  assert.equal(scoring.computeOwnerStanding(tied, "p1", 450).rank, 1);
  assert.equal(scoring.computeOwnerStanding(tied, "p2", 450).rank, 1);
  assert.equal(scoring.computeOwnerStanding(tied, "p3", 450).rank, 3);

  // Un jugador que no esta en la partida no tiene puesto
  assert.equal(scoring.computeOwnerStanding(rows, "nadie", 450), null);
  // Y sin participantes tampoco hay nada que ordenar
  assert.equal(scoring.computeOwnerStanding([], "p1", 450), null);
});

test("the scoreboard gets every player's place from one pass, with the same rule", () => {
  const { rankByRaw } = load("src/shared/opScore.ts");

  // El marcador desplegable ordena los diez de una vez, no uno por uno
  const scores = new Map([
    [1, { raw: 9.4 }],
    [2, { raw: 7.1 }],
    [3, { raw: 7.1 }],
    [4, { raw: 2.0 }],
  ]);
  const ranks = rankByRaw(scores);
  assert.deepEqual(
    [...ranks.entries()],
    [
      [1, 1],
      [2, 2],
      [3, 2],
      [4, 4],
    ],
  );

  // Sin notas (remake, o una cola sin puntuacion) no hay puestos que ensenar
  assert.equal(rankByRaw(new Map()).size, 0);
});

test("a rank becomes a number on the real ladder, and back again", () => {
  const r = load("src/shared/ranks.ts");
  const rank = (tier, division, lp) => ({ tier, division, lp, queueType: "RANKED_SOLO_5x5" });

  // Cuatro divisiones de 100 PL por nivel, que es como sube la escalera
  assert.equal(r.rankPoints(rank("IRON", "IV", 0)), 0);
  assert.equal(r.rankPoints(rank("IRON", "I", 0)), 300);
  assert.equal(r.rankPoints(rank("BRONZE", "IV", 0)), 400);
  assert.equal(r.rankPoints(rank("GOLD", "II", 50)), 3 * 400 + 2 * 100 + 50);

  // Maestro, Gran maestro y Aspirante comparten base: no son tres escaleras,
  // son el tramo alto de una, separado por PL
  const master = r.rankPoints(rank("MASTER", null, 0));
  assert.equal(master, 7 * 400);
  assert.equal(r.rankPoints(rank("CHALLENGER", null, 900)), master + 900);
  assert.ok(r.rankPoints(rank("GRANDMASTER", null, 300)) > r.rankPoints(rank("DIAMOND", "I", 99)));

  // Y el camino de vuelta, para poder ensenar una media como un rango
  assert.deepEqual(
    {
      tier: r.pointsToRank(3 * 400 + 2 * 100 + 50).tier,
      division: r.pointsToRank(3 * 400 + 2 * 100 + 50).division,
    },
    { tier: "GOLD", division: "II" },
  );
  assert.equal(r.pointsToRank(master + 120).tier, "MASTER");
  assert.equal(r.pointsToRank(master + 120).division, null);
  assert.equal(r.pointsToRank(0).tier, "IRON");
});

test("the lobby average only appears when more than half the game is ranked", () => {
  const r = load("src/shared/ranks.ts");
  const rank = (tier, division) => ({ tier, division, lp: 0, queueType: "RANKED_SOLO_5x5" });

  // Una ARAM tipica: dos de diez con rango, asi que no hay media que valga
  const few = r.summarizeLobbyRanks([
    rank("GOLD", "II"),
    rank("SILVER", "I"),
    ...Array(8).fill(null),
  ]);
  assert.equal(few.average, null);
  assert.equal(few.ranked, 2);
  assert.equal(few.total, 10);

  // Justo la mitad tampoco basta: la regla es mas de la mitad
  assert.equal(r.summarizeLobbyRanks([rank("GOLD", "II"), null]).average, null);

  // Seis de diez si, y la media cae entre los dos extremos
  const many = r.summarizeLobbyRanks([
    ...Array(3).fill(rank("SILVER", "IV")),
    ...Array(3).fill(rank("GOLD", "IV")),
    ...Array(4).fill(null),
  ]);
  assert.equal(many.ranked, 6);
  assert.equal(many.average.tier, "SILVER");
  assert.equal(many.average.division, "II");

  // Sin nadie con rango, ni media ni cuenta que ensenar
  assert.deepEqual(r.summarizeLobbyRanks([null, null]), { average: null, ranked: 0, total: 2 });
});

test("the ladder shown follows the game, and unranked players are dropped", () => {
  const r = load("src/shared/ranks.ts");
  const ranks = load("src/main/ranks.ts", { "./db": {} });

  // El cliente manda todas las colas; solo interesan las dos escaleras, y
  // un nivel vacio o "NONE" es su forma de decir sin clasificar
  const parsed = ranks.parseRankedStats({
    queues: [
      { queueType: "RANKED_SOLO_5x5", tier: "EMERALD", division: "III", leaguePoints: 42 },
      { queueType: "RANKED_FLEX_SR", tier: "GOLD", division: "I", leaguePoints: 8 },
      { queueType: "RANKED_TFT", tier: "DIAMOND", division: "II", leaguePoints: 60 },
      { queueType: "CHERRY", tier: "NONE", division: "NA", leaguePoints: 0 },
    ],
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].tier, "EMERALD");

  // En clasificatoria flexible se ensena el rango de flexible; en cualquier
  // otra cola, el de solo
  assert.equal(r.pickRank(parsed, 440).queueType, "RANKED_FLEX_SR");
  assert.equal(r.pickRank(parsed, 420).queueType, "RANKED_SOLO_5x5");
  assert.equal(r.pickRank(parsed, 450).queueType, "RANKED_SOLO_5x5");

  // Quien solo tiene flexible lo ensena igual en una ARAM
  const flexOnly = parsed.filter((p) => p.queueType === "RANKED_FLEX_SR");
  assert.equal(r.pickRank(flexOnly, 450).queueType, "RANKED_FLEX_SR");

  // Maestro y arriba no tienen division, pero Riot manda "I" igualmente.
  // Ni se guarda ni se ensena: al lado del emblema va el PL, que es lo unico
  // que separa a esos tres niveles.
  const apex = ranks.parseRankedStats({
    queues: [
      { queueType: "RANKED_SOLO_5x5", tier: "MASTER", division: "I", leaguePoints: 312 },
      { queueType: "RANKED_FLEX_SR", tier: "CHALLENGER", division: "I", leaguePoints: 1203 },
    ],
  });
  assert.equal(apex[0].division, null);
  assert.equal(apex[1].division, null);
  // Y si una fila vieja llegara con la "I", tampoco se ensena
  assert.equal(
    r.effectiveDivision({ tier: "GRANDMASTER", division: "I", lp: 500, queueType: "x" }),
    null,
  );
  assert.equal(
    r.effectiveDivision({ tier: "DIAMOND", division: "I", lp: 50, queueType: "x" }),
    "I",
  );
  const t = (k, v) => (k === "rank.tierLp" ? v.tier + " " + v.lp + " PL" : String(k).split(".")[1]);
  assert.equal(
    r.formatRank({ tier: "MASTER", division: "I", lp: 312, queueType: "x" }, t),
    "master 312 PL",
  );

  // Y sin ninguna, nada
  assert.equal(r.pickRank([], 450), null);
  assert.deepEqual(ranks.parseRankedStats(null), []);
  assert.deepEqual(ranks.parseRankedStats({ queues: [] }), []);
});

test("ranks are only taken while the game is fresh, and only once", async () => {
  const HOUR = 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  // Una base fingida que apunta lo que le piden y lo que le mandan guardar.
  // El estado vive en el cierre y no en el objeto: el cargador copia el
  // modulo simulado, y escribir sobre la copia no llegaria hasta aqui.
  function makeDb(gameCreation) {
    const state = { saved: [], asked: false };
    return {
      state,
      getGameForRanks: () => ({ gameCreation, queueId: 450 }),
      getParticipantPuuids: () => [
        { participantId: 1, puuid: "p1" },
        { participantId: 2, puuid: "p2" },
        { participantId: 3, puuid: null },
      ],
      hasGameRanks: () => state.asked,
      saveGameRanks: (_gameId, rows) => {
        state.saved = rows;
        state.asked = true;
      },
    };
  }

  const answer = {
    p1: {
      queues: [{ queueType: "RANKED_SOLO_5x5", tier: "GOLD", division: "II", leaguePoints: 30 }],
    },
    p2: { queues: [] },
  };
  const calls = [];
  const get = async (path) => {
    calls.push(path);
    const puuid = path.split("/").pop();
    return answer[puuid] ?? null;
  };

  // Recien jugada: se pregunta por los que tienen identificador, y solo se
  // guarda a quien esta clasificado
  const fresh = makeDb(now - HOUR);
  const ranksFresh = load("src/main/ranks.ts", { "./db": fresh });
  assert.equal(await ranksFresh.captureGameRanks(1, get, now), 1);
  assert.equal(fresh.state.saved.length, 1);
  assert.equal(fresh.state.saved[0].participantId, 1);
  assert.equal(fresh.state.saved[0].rank.tier, "GOLD");
  // El jugador sin identificador no genera ninguna peticion
  assert.ok(calls.every((c) => c.endsWith("p1") || c.endsWith("p2")));

  // Ya preguntada: ni una peticion mas, aunque no guardara a nadie
  const before = calls.length;
  assert.equal(await ranksFresh.captureGameRanks(1, get, now), 0);
  assert.equal(calls.length, before);

  // Vieja: el cliente solo sabe decir el rango de hoy, asi que no se pregunta
  const old = makeDb(now - 30 * HOUR);
  const ranksOld = load("src/main/ranks.ts", { "./db": old });
  assert.equal(await ranksOld.captureGameRanks(2, get, now), 0);
  assert.equal(old.state.saved.length, 0);

  // Y un cliente que falla no puede tumbar la captura de la partida
  const angry = makeDb(now - HOUR);
  const ranksAngry = load("src/main/ranks.ts", { "./db": angry });
  assert.equal(
    await ranksAngry.captureGameRanks(
      3,
      async () => {
        throw new Error("cliente caido");
      },
      now,
    ),
    0,
  );
});

test("every tier has a crest url, lowercased the way the assets are named", () => {
  const { rankCrestUrl } = load("src/shared/cdragon.ts");
  const { RANK_TIERS } = load("src/shared/ranks.ts");
  const base =
    "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/";

  // Una errata aqui no rompe nada a la vista: la imagen falla y se cae al
  // texto, asi que el fallo seria silencioso. De ahi la prueba.
  for (const tier of RANK_TIERS) {
    assert.equal(rankCrestUrl(tier), base + tier.toLowerCase() + ".svg", tier);
  }
  assert.equal(new Set(RANK_TIERS.map(rankCrestUrl)).size, RANK_TIERS.length);
});

test("the plain-language verdict says what the numbers on screen do not", () => {
  const { buildVerdict, VERDICT_MAX_LINES } = load("src/shared/verdict.ts");
  const compact = (n) => String(Math.round(n / 100) / 10) + "k";
  const MIN = 60;

  // Alguien con 500 partidas a la espalda, que suele durar 20 minutos
  const base = (over = {}) => ({
    score: 6.0,
    career: {
      games: 500,
      wins: 250,
      avgScore: 6.0,
      avgDuration: 20 * MIN,
      avgKills: 8,
      avgDeaths: 8,
      avgAssists: 15,
      avgDamage: 40000,
      avgTaken: 40000,
      avgHeal: 10000,
      avgGold: 24000,
      ...(over.career || {}),
    },
    champion: {
      championId: 1,
      games: 20,
      wins: 10,
      kills: 0,
      deaths: 0,
      assists: 0,
      avgScore: 6.0,
      previousBest: 8.0,
      firstTime: false,
      ...(over.champion || {}),
    },
    session: {
      day: 0,
      index: 0,
      games: [],
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      avgScore: null,
      duration: 0,
      ...(over.session || {}),
    },
    streak: over.streak ?? null,
    milestones: [],
    placements: [],
    challenges: [],
    mapName: null,
    scoreBadge: null,
    detail: {
      game: { is_remake: 0, queue_id: 450, game_duration: (over.minutes ?? 20) * MIN },
      augments: [],
      participants: [],
      stats: {
        win: 1,
        kills: 8,
        deaths: 8,
        assists: 15,
        total_damage_dealt: 40000,
        total_damage_taken: 40000,
        total_heal: 10000,
        gold_earned: 24000,
        score_rank: 5,
        score_rank_total: 10,
        ...(over.stats || {}),
      },
    },
    ...(over.top || {}),
  });

  // Una partida del monton no merece que se invente nada
  assert.deepEqual(buildVerdict(base(), compact), []);

  // Un remake corta en seco: no hay nada contra lo que comparar
  const remakeRecap = base();
  remakeRecap.detail.game.is_remake = 1;
  const remake = buildVerdict(remakeRecap, compact);
  assert.equal(remake.length, 1);
  assert.equal(remake[0].key, "verdict.remake");

  // EL CASO QUE LO MOTIVO: una partida de 11 minutos con la mitad de todo.
  // Por minuto va exactamente al ritmo de siempre, asi que no hay nada que
  // decir; comparando totales habria dicho "un 45% menos de dano" y estaria
  // describiendo el reloj, no al jugador.
  const short = buildVerdict(
    base({
      minutes: 11,
      stats: {
        total_damage_dealt: 22000,
        total_damage_taken: 22000,
        total_heal: 5500,
        gold_earned: 13200,
        deaths: 4,
      },
    }),
    compact,
  );
  assert.deepEqual(
    short.filter((l) => l.family === "stat"),
    [],
  );

  // Y al reves: una partida larga floja no se salva por acumular totales.
  // Las muertes van justo en lo esperado para 40 minutos (16) para que no se
  // lleven ellas la unica frase de la familia.
  const longDull = buildVerdict(
    base({
      minutes: 40,
      stats: {
        deaths: 16,
        total_damage_dealt: 40000,
        total_damage_taken: 40000,
        total_heal: 10000,
        gold_earned: 24000,
      },
    }),
    compact,
  );
  assert.ok(longDull.some((l) => l.key === "verdict.damageDown"));

  // El dano muy por encima de su ritmo si se cuenta, con el porcentaje bien
  const carry = buildVerdict(base({ stats: { total_damage_dealt: 58000 } }), compact);
  const dmg = carry.find((l) => l.key === "verdict.damageUp");
  assert.ok(dmg, "deberia hablar del dano");
  assert.equal(dmg.vars.pct, 45);

  // Las muertes se comparan con lo que cuesta una partida de esa duracion.
  // El resto de totales van a la mitad, que en diez minutos es el ritmo de
  // siempre, para que ninguna otra frase de la familia le gane el sitio.
  const feeding = buildVerdict(
    base({
      minutes: 10,
      stats: {
        deaths: 9,
        total_damage_dealt: 20000,
        total_damage_taken: 20000,
        total_heal: 5000,
        gold_earned: 12000,
      },
    }),
    compact,
  );
  const dline = feeding.find((l) => l.key === "verdict.deathsUp");
  assert.ok(dline);
  assert.equal(dline.vars.expected, 4);

  // Una partida de dos minutos no tiene reloj fiable: ninguna frase de ritmo
  const stub = buildVerdict(base({ minutes: 2, stats: { total_damage_dealt: 100 } }), compact);
  assert.deepEqual(
    stub.filter((l) => l.family === "stat"),
    [],
  );

  // La mejor partida con el campeon manda sobre todo lo demas
  const best = buildVerdict(
    base({ top: { score: 9.2 }, champion: { previousBest: 8.0 } }),
    compact,
  );
  assert.equal(best[0].key, "verdict.championBest");

  // Nunca mas de tres frases, y nunca dos de la misma familia
  const loud = buildVerdict(
    base({
      top: { score: 9.8 },
      stats: { total_damage_dealt: 90000, deaths: 1, score_rank: 1 },
      streak: { kind: "win", length: 5, best: 5, isRecord: true },
      session: { wins: 4, losses: 1 },
    }),
    compact,
  );
  assert.ok(loud.length <= VERDICT_MAX_LINES);
  assert.equal(new Set(loud.map((l) => l.family)).size, loud.length);
  // Y en el orden de lectura: que paso, como jugaste, donde te deja
  assert.deepEqual(
    loud.map((l) => l.family),
    ["result", "stat", "context"],
  );

  // Con pocas partidas no se compara contra una media que no significa nada
  const rookie = buildVerdict(base({ top: { score: 9.5 }, career: { games: 3 } }), compact);
  assert.ok(!rookie.some((l) => l.key === "verdict.scoreAbove"));

  // Un ritmo minusculo no genera porcentajes absurdos
  const tiny = buildVerdict(
    base({ career: { avgHeal: 400 }, stats: { total_heal: 800 } }),
    compact,
  );
  assert.ok(!tiny.some((l) => String(l.key).startsWith("verdict.heal")));
});

test("a game is judged against this champion once there is enough of one", () => {
  const { pickYardstick, buildVerdict } = load("src/shared/verdict.ts");
  const compact = (n) => String(n);
  const MIN = 60;

  // Alguien que juega de todo: mucha curacion de media porque lleva supports
  const career = {
    games: 500,
    wins: 250,
    avgScore: 6.0,
    avgDuration: 20 * MIN,
    avgKills: 8,
    avgDeaths: 8,
    avgAssists: 15,
    avgDamage: 40000,
    avgTaken: 40000,
    avgHeal: 10000,
    avgGold: 24000,
  };
  // Pero con este tirador cura una decima parte, y eso es lo normal en el
  const champion = (games) => ({
    championId: 110,
    games,
    wins: 5,
    kills: 0,
    deaths: 0,
    assists: 0,
    avgScore: 6.0,
    previousBest: 8.0,
    firstTime: false,
    avgDuration: 20 * MIN,
    avgDeaths: 6,
    avgDamage: 44000,
    avgTaken: 30000,
    avgHeal: 1000,
    avgGold: 26000,
  });
  const recap = (games, stats) => ({
    score: 6.0,
    career,
    champion: champion(games),
    session: {
      day: 0,
      index: 0,
      games: [],
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      avgScore: null,
      duration: 0,
    },
    streak: null,
    milestones: [],
    placements: [],
    challenges: [],
    mapName: null,
    scoreBadge: null,
    detail: {
      game: { is_remake: 0, queue_id: 450, game_duration: 20 * MIN },
      augments: [],
      participants: [],
      stats: {
        win: 1,
        kills: 8,
        deaths: 6,
        assists: 15,
        total_damage_dealt: 44000,
        total_damage_taken: 30000,
        total_heal: 1000,
        gold_earned: 26000,
        score_rank: 5,
        score_rank_total: 10,
        ...stats,
      },
    },
  });

  // Con veinte partidas manda el campeon
  assert.equal(pickYardstick(recap(20)).onChampion, true);
  assert.equal(pickYardstick(recap(20)).heal, 1000);
  // Con dos, su media es una partida con suerte: manda la carrera
  assert.equal(pickYardstick(recap(2)).onChampion, false);
  assert.equal(pickYardstick(recap(2)).heal, 10000);

  // EL CASO QUE LO MOTIVO: curar 1000 con un tirador es exactamente lo
  // normal con el, asi que no se dice nada. Contra la carrera habria dicho
  // "un 90% menos de lo normal", que es una frase sobre que campeon eligio.
  assert.deepEqual(
    buildVerdict(recap(20), compact).filter((l) => l.family === "stat"),
    [],
  );
  assert.ok(
    buildVerdict(recap(2), compact).some((l) => l.key === "verdict.healDown"),
    "sin historial con el campeon si cae en la trampa, y se acepta: es lo unico que hay",
  );

  // Y cuando se usa el campeon, la frase lo dice
  const carry = buildVerdict(recap(20, { total_damage_dealt: 70000 }), compact);
  assert.ok(carry.some((l) => l.key === "verdict.damageUpOnChamp"));
});

test("a night gets sentences only when it has a shape worth describing", () => {
  const { buildSessionVerdict, VERDICT_MAX_LINES } = load("src/shared/verdict.ts");
  const g = (win, championId) => ({
    gameId: championId * 1000 + (win ? 1 : 0),
    championId,
    win,
    score: 6,
    scoreBadge: null,
    gameCreation: 0,
    gameDuration: 1200,
  });
  const session = (played, over = {}) => ({
    day: 0,
    games: played.length,
    wins: played.filter((p) => p.win).length,
    losses: played.filter((p) => !p.win).length,
    kills: 0,
    deaths: 0,
    assists: 0,
    avgScore: 6,
    duration: played.length * 1200,
    played,
    startedAt: 0,
    endedAt: 0,
    finished: true,
    careerAvgScore: 6,
    longerAgoDays: 1,
    ...over,
  });

  // Dos partidas no son una noche
  assert.deepEqual(buildSessionVerdict(session([g(true, 1), g(false, 2)])), []);

  // La remontada: iba 1-3 y gano las dos ultimas
  const comeback = buildSessionVerdict(
    session([g(false, 1), g(true, 2), g(false, 3), g(false, 4), g(true, 5), g(true, 6)]),
  );
  const line = comeback.find((l) => l.key === "session.comeback");
  assert.ok(line, "deberia contar la remontada");
  assert.deepEqual(line.vars, { wins: 1, losses: 3, tail: 2 });

  // Y al reves, cuando la noche se tuerce al final
  const collapse = buildSessionVerdict(
    session([g(true, 1), g(true, 2), g(true, 3), g(false, 4), g(false, 5), g(false, 6)]),
  );
  assert.ok(collapse.some((l) => l.key === "session.collapse"));

  // Ganar la ultima yendo por delante no es una remontada: no se dice nada
  const steady = buildSessionVerdict(
    session([g(true, 1), g(true, 2), g(false, 3), g(true, 4), g(true, 5)]),
  );
  assert.ok(!steady.some((l) => l.key === "session.comeback"));

  // Pleno
  const perfect = buildSessionVerdict(session([g(true, 1), g(true, 2), g(true, 3)]));
  assert.equal(perfect[0].key, "session.allWins");

  // Campeones: todos distintos, o siempre el mismo
  assert.ok(
    buildSessionVerdict(session([g(true, 1), g(false, 2), g(true, 3), g(false, 4)])).some(
      (l) => l.key === "session.allDifferent",
    ),
  );
  assert.ok(
    buildSessionVerdict(session([g(true, 7), g(false, 7), g(true, 7)])).some(
      (l) => l.key === "session.oneChampion",
    ),
  );

  // "La mas larga desde" solo si hace de verdad unos dias
  const played6 = [g(false, 1), g(true, 2), g(false, 3), g(false, 4), g(true, 5), g(true, 6)];
  assert.ok(
    buildSessionVerdict(session(played6, { longerAgoDays: 21 })).some(
      (l) => l.key === "session.longestSince",
    ),
  );
  assert.ok(
    !buildSessionVerdict(session(played6, { longerAgoDays: 2 })).some(
      (l) => l.key === "session.longestSince",
    ),
  );
  assert.ok(
    buildSessionVerdict(session(played6, { longerAgoDays: null })).some(
      (l) => l.key === "session.longestEver",
    ),
  );

  // El mismo tope y el mismo orden de lectura que las frases de partida
  const loud = buildSessionVerdict(
    session([g(false, 1), g(false, 2), g(true, 3), g(true, 4), g(true, 5)], {
      longerAgoDays: null,
    }),
  );
  assert.ok(loud.length <= VERDICT_MAX_LINES);
  assert.equal(new Set(loud.map((l) => l.family)).size, loud.length);
  assert.deepEqual(
    loud.map((l) => l.family),
    [...loud.map((l) => l.family)].sort(
      (a, b) => ["result", "stat", "context"].indexOf(a) - ["result", "stat", "context"].indexOf(b),
    ),
  );
});

test("the session panel appears once, and only for a night that is over", () => {
  const { shouldShowSession, SESSION_MIN_GAMES } = load("src/shared/session.ts");

  const night = (over = {}) => ({ day: 100, games: 4, finished: true, ...over });

  assert.equal(shouldShowSession(night(), null), true);
  // Ya cerrado: esa noche no vuelve
  assert.equal(shouldShowSession(night(), 100), false);
  // Pero la siguiente si
  assert.equal(shouldShowSession(night({ day: 200 }), 100), true);
  // Mientras sigues jugando, no
  assert.equal(shouldShowSession(night({ finished: false }), null), false);
  // Una partida suelta no es una sesion
  assert.equal(shouldShowSession(night({ games: 1 }), null), false);
  assert.equal(shouldShowSession(night({ games: SESSION_MIN_GAMES }), null), true);
  // Y sin sesion no hay nada que ensenar
  assert.equal(shouldShowSession(null, null), false);
});

test("timelines are taken once, skipped when absent, and give way to the user", async () => {
  // Una base fingida con el estado en el cierre: el cargador copia el modulo
  // simulado, asi que escribir sobre la copia no llegaria hasta aqui.
  function makeDb(pending) {
    const state = { saved: new Map(), missing: new Set(), pending: [...pending] };
    return {
      state,
      hasTimeline: (id) => state.saved.has(id),
      saveTimeline: (id, data) => {
        state.saved.set(id, data);
        state.pending = state.pending.filter((g) => g !== id);
      },
      markTimelineUnavailable: (id) => {
        state.missing.add(id);
        state.pending = state.pending.filter((g) => g !== id);
      },
      gamesMissingTimeline: (limit) => state.pending.slice(0, limit),
      timelineCoverage: () => ({
        stored: state.saved.size,
        total: state.saved.size + state.pending.length,
        bytes: state.saved.size * 8192,
      }),
    };
  }

  const buena = { frames: [{ timestamp: 60000, participantFrames: {}, events: [] }] };

  // Una partida normal: se pide, se guarda, y no se vuelve a pedir
  {
    const base = makeDb([1]);
    const tl = load("src/main/timelines.ts", { "./db": base });
    const pedidas = [];
    const get = async (p) => {
      pedidas.push(p);
      return buena;
    };
    assert.equal(await tl.captureTimeline(1, get), true);
    assert.equal(base.state.saved.size, 1);
    assert.match(pedidas[0], /\/lol-match-history\/v1\/game-timelines\/1$/);
    // Ya guardada: ni una peticion mas
    assert.equal(await tl.captureTimeline(1, get), false);
    assert.equal(pedidas.length, 1);
  }

  // Una respuesta sin fotogramas no se guarda, y se apunta para no insistir
  {
    const base = makeDb([2]);
    const tl = load("src/main/timelines.ts", { "./db": base });
    assert.equal(await tl.captureTimeline(2, async () => ({ frames: [] })), false);
    assert.equal(base.state.saved.size, 0);
    assert.ok(base.state.missing.has(2));
    // Y una que no contesta nada, igual
    const base2 = makeDb([3]);
    const tl2 = load("src/main/timelines.ts", { "./db": base2 });
    assert.equal(await tl2.captureTimeline(3, async () => null), false);
    assert.ok(base2.state.missing.has(3));
  }

  // Un cliente que revienta no puede tumbar la captura de la partida
  {
    const base = makeDb([4]);
    const tl = load("src/main/timelines.ts", { "./db": base });
    assert.equal(
      await tl.captureTimeline(4, async () => {
        throw new Error("cliente caido");
      }),
      false,
    );
  }

  // El repaso recorre lo que falta y para cuando se le dice
  {
    const base = makeDb([10, 11, 12, 13, 14]);
    const tl = load("src/main/timelines.ts", { "./db": base });
    const res = await tl.backfillTimelines(
      async () => buena,
      () => true,
      0,
    );
    assert.equal(res.saved, 5);
    assert.equal(res.remaining, 0);
    assert.equal(base.state.saved.size, 5);
  }

  // Si el usuario empieza una partida, el repaso se aparta sin guardar nada
  {
    const base = makeDb([20, 21, 22]);
    const tl = load("src/main/timelines.ts", { "./db": base });
    const res = await tl.backfillTimelines(
      async () => buena,
      () => false,
      0,
    );
    assert.equal(res.saved, 0);
    assert.equal(base.state.saved.size, 0);
  }

  // Y si el cliente deja de contestar, se rinde en vez de insistir mil veces
  {
    const muchas = Array.from({ length: 50 }, (_, i) => 100 + i);
    const base = makeDb(muchas);
    const tl = load("src/main/timelines.ts", { "./db": base });
    let peticiones = 0;
    const res = await tl.backfillTimelines(
      async () => {
        peticiones++;
        return null;
      },
      () => true,
      0,
    );
    assert.equal(res.saved, 0);
    assert.ok(peticiones <= 10, "deberia rendirse pronto, hizo " + peticiones);
  }
});

test("a teammate's tags describe the shared record, and stay quiet without one", () => {
  const tags = load("src/shared/tags.ts");
  const DAY = 24 * 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  const player = (over = {}) => ({
    games: 200,
    wins: 100,
    withoutGames: 800,
    withoutWins: 400,
    lastPlayed: now - DAY,
    firstPlayed: now - 400 * DAY,
    streak: null,
    ...over,
  });

  // Alguien con quien te va igual que sin el no merece ninguna etiqueta
  assert.deepEqual(tags.teammateTags(player(), now), []);
  assert.equal(tags.winRateSwing(player()), 0);

  // La diferencia de winrate, con los numeros reales de onji: 57.9% juntos
  // sobre 183, 50.0% sin el sobre 864
  const onji = player({ games: 183, wins: 106, withoutGames: 864, withoutWins: 432 });
  const swing = tags.winRateSwing(onji);
  assert.ok(swing > 7 && swing < 9, "esperaba unos 8 puntos, salio " + swing);
  const suyas = tags.teammateTags(onji, now);
  assert.equal(suyas[0].key, "tag.winMore");
  assert.equal(suyas[0].vars.points, 8);
  assert.equal(suyas[0].tone, "good");

  // Y al reves
  const peor = player({ games: 100, wins: 40, withoutGames: 900, withoutWins: 495 });
  assert.equal(tags.teammateTags(peor, now)[0].key, "tag.winLess");

  // Muestra pequena: no se afirma nada aunque la diferencia parezca enorme
  assert.equal(tags.winRateSwing(player({ games: 10, wins: 10 })), null);
  assert.equal(tags.winRateSwing(player({ withoutGames: 40, withoutWins: 10 })), null);
  // Y una diferencia de menos de cuatro puntos es ruido, no una etiqueta
  const casi = player({ games: 100, wins: 52, withoutGames: 900, withoutWins: 450 });
  assert.ok(!tags.teammateTags(casi, now).some((x) => x.key === "tag.winMore"));

  // Rachas compartidas
  assert.equal(
    tags.teammateTags(player({ streak: { win: false, length: 4 } }), now)[0].key,
    "tag.lossStreak",
  );
  // Dos seguidas no son una racha
  assert.ok(
    !tags
      .teammateTags(player({ streak: { win: true, length: 2 } }), now)
      .some((x) => String(x.key).includes("Streak")),
  );

  // Ausencia: solo de alguien que fue habitual, y en meses cuando se alarga,
  // porque "221 dias" es un numero que nadie se imagina
  const semanas = player({ lastPlayed: now - 35 * DAY });
  assert.ok(tags.teammateTags(semanas, now).some((x) => x.key === "tag.away"));
  const ido = player({ lastPlayed: now - 221 * DAY });
  const meses = tags.teammateTags(ido, now).find((x) => x.key === "tag.awayMonths");
  assert.ok(meses, "una ausencia larga se cuenta en meses");
  assert.equal(meses.vars.months, 7);
  const conocido = player({ games: 5, lastPlayed: now - 60 * DAY, withoutGames: 800 });
  assert.ok(!tags.teammateTags(conocido, now).some((x) => x.key === "tag.away"));

  // Recien aparecido
  const nuevo = player({ games: 4, firstPlayed: now - 5 * DAY });
  assert.ok(tags.teammateTags(nuevo, now).some((x) => x.key === "tag.new"));
  // Alguien de siempre con pocas partidas no es nuevo
  const viejo = player({ games: 4, firstPlayed: now - 300 * DAY });
  assert.ok(!tags.teammateTags(viejo, now).some((x) => x.key === "tag.new"));

  // Comparacion de notas, solo con recorrido suficiente
  const mejor = player({ betterScore: { better: 14, scored: 20 } });
  assert.equal(
    tags.teammateTags(mejor, now).find((x) => String(x.key).includes("utscore")).key,
    "tag.outscoresYou",
  );
  const pocas = player({ betterScore: { better: 8, scored: 10 } });
  assert.ok(!tags.teammateTags(pocas, now).some((x) => String(x.key).includes("utscore")));
  // Y reparto parejo: no hay nada que decir
  const parejo = player({ betterScore: { better: 25, scored: 50 } });
  assert.ok(!tags.teammateTags(parejo, now).some((x) => String(x.key).includes("utscore")));

  // Nunca mas de dos, y la diferencia de winrate manda sobre el resto
  const ruidoso = player({
    games: 183,
    wins: 106,
    withoutGames: 864,
    withoutWins: 432,
    streak: { win: true, length: 5 },
    lastPlayed: now - 60 * DAY,
    betterScore: { better: 18, scored: 20 },
  });
  const elegidas = tags.teammateTags(ruidoso, now, true);
  assert.equal(elegidas.length, tags.MAX_TAGS);
  assert.equal(elegidas[0].key, "tag.winMore");
});

test("every tag carries an explanation with the figures behind it", () => {
  const tags = load("src/shared/tags.ts");
  const i18n = load("src/shared/i18n/index.ts");
  const DAY = 24 * 60 * 60 * 1000;
  const now = 1_700_000_000_000;

  // Un jugador que dispara todas las reglas a la vez, para recorrerlas
  const todas = [
    {
      games: 183,
      wins: 106,
      withoutGames: 864,
      withoutWins: 432,
      lastPlayed: now - DAY,
      firstPlayed: now - 400 * DAY,
      streak: { win: true, length: 4 },
    },
    {
      games: 100,
      wins: 30,
      withoutGames: 900,
      withoutWins: 495,
      lastPlayed: now - 200 * DAY,
      firstPlayed: now - 400 * DAY,
      streak: { win: false, length: 5 },
    },
    {
      games: 4,
      wins: 2,
      withoutGames: 900,
      withoutWins: 450,
      lastPlayed: now,
      firstPlayed: now - 3 * DAY,
      streak: null,
    },
    {
      games: 200,
      wins: 100,
      withoutGames: 800,
      withoutWins: 400,
      lastPlayed: now,
      firstPlayed: now - 400 * DAY,
      streak: null,
      betterScore: { better: 16, scored: 20 },
    },
  ];

  const vistas = new Set();
  for (const p of todas) {
    for (const marca of [...tags.teammateTags(p, now, true), tags.livePlayerTag(p)]) {
      if (!marca) continue;
      vistas.add(marca.key);
      assert.ok(marca.hint, "sin explicacion: " + marca.key);
      // La explicacion existe en los dos idiomas y no deja huecos sin rellenar
      for (const lang of ["es", "en"]) {
        const texto = i18n.translate(lang, marca.hint.key, marca.hint.vars);
        assert.ok(texto.length > 20, marca.hint.key + " en " + lang + " es demasiado corta");
        assert.ok(!/{w+}/.test(texto), marca.hint.key + " deja un hueco sin rellenar en " + lang);
      }
    }
  }
  // Y que el recorrido haya tocado de verdad varias familias
  assert.ok(vistas.size >= 6, "esperaba recorrer mas etiquetas, vi " + vistas.size);

  // La etiqueta de diferencia de winrate lleva los dos registros aparte, para
  // poder pintarlos como dos filas en vez de como un parrafo
  const onji = { games: 183, wins: 106, withoutGames: 864, withoutWins: 432 };
  const c = tags.livePlayerTag(onji).hint.compare;
  assert.ok(c, "la comparacion deberia viajar estructurada");
  assert.deepEqual({ r: c.withRate, w: c.withWins, g: c.withGames }, { r: 58, w: 106, g: 183 });
  assert.deepEqual(
    { r: c.withoutRate, w: c.withoutWins, g: c.withoutGames },
    { r: 50, w: 432, g: 864 },
  );
  // Y las que no comparan nada no la llevan
  assert.equal(
    tags
      .teammateTags({ ...onji, lastPlayed: 0, firstPlayed: 0, streak: { win: true, length: 5 } }, 0)
      .find((x) => x.key === "tag.winStreak").hint.compare,
    undefined,
  );
});

test("the live tag only speaks about someone the app actually knows", () => {
  const tags = load("src/shared/tags.ts");

  // Un desconocido no lleva etiqueta: en nueve filas de diez no hay nada
  // cierto que decir
  assert.equal(
    tags.livePlayerTag({ games: 3, wins: 2, withoutGames: 900, withoutWins: 450 }),
    null,
  );

  // Un habitual con diferencia clara, la dice
  const onji = tags.livePlayerTag({ games: 183, wins: 106, withoutGames: 864, withoutWins: 432 });
  assert.equal(onji.key, "tag.liveWinMore");
  assert.equal(onji.vars.games, 183);
  assert.equal(onji.vars.points, 8);

  // Y un habitual sin diferencia se queda en el dato desnudo
  const plano = tags.livePlayerTag({ games: 50, wins: 25, withoutGames: 900, withoutWins: 450 });
  assert.equal(plano.key, "tag.liveTogether");
  assert.equal(plano.vars.rate, 50);
});

test("a game falls in the duration bucket its length belongs to", () => {
  const { DURATION_BUCKETS, durationBucket } = load("src/shared/trends.ts");
  const min = (m) => m * 60;

  // Los bordes: una partida justo en el corte cae en el tramo de arriba
  assert.equal(durationBucket(min(8)), 0);
  assert.equal(durationBucket(min(11.9)), 0);
  assert.equal(durationBucket(min(12)), 12);
  assert.equal(durationBucket(min(17.9)), 15);
  assert.equal(durationBucket(min(18)), 18);
  assert.equal(durationBucket(min(21)), 21);
  // Y la cola no tiene techo: una de 40 minutos sigue en el ultimo tramo
  assert.equal(durationBucket(min(25)), 25);
  assert.equal(durationBucket(min(40)), 25);
  // Una duracion imposible no revienta
  assert.equal(durationBucket(0), 0);

  // Los tramos van en orden y sin huecos
  for (let i = 1; i < DURATION_BUCKETS.length; i++) {
    assert.ok(DURATION_BUCKETS[i] > DURATION_BUCKETS[i - 1], "los cortes deben ir en orden");
  }
  // Y todo minuto plausible cae en alguno
  for (let m = 0; m <= 60; m++) {
    assert.ok(DURATION_BUCKETS.includes(durationBucket(min(m))), m + " min sin tramo");
  }
});

test("every match filter reaches the list, not just the summaries", () => {
  // useMatches no reenvia el objeto de filtros: lo desmonta y lo vuelve a
  // montar clave por clave. Olvidar una no rompe nada visible — la lista
  // ignora ese filtro mientras el resto de la pagina lo obedece, que es
  // exactamente como se colo el filtro por objeto.
  const api = fs.readFileSync(path.resolve(__dirname, "../src/shared/api.ts"), "utf8");
  const hook = fs.readFileSync(
    path.resolve(__dirname, "../src/renderer/hooks/useMatches.ts"),
    "utf8",
  );

  const block = api.slice(api.indexOf("export interface MatchFilters {"));
  const body = block.slice(block.indexOf("{") + 1, block.indexOf("\n}"));
  const keys = [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
  assert.ok(keys.length >= 8, "esperaba varias claves, encontre " + keys.length);

  for (const key of keys) {
    // multikills viaja como una cadena unida, asi que se busca su llave
    const needle = key === "multikills" ? "multikillsKey" : key;
    const veces = hook.split(needle).length - 1;
    assert.ok(
      veces >= 3,
      "useMatches solo nombra " +
        key +
        " " +
        veces +
        " vez/veces; hacen falta tres: desmontarla, meterla en la clave de filtros y enviarla",
    );
  }
});

test("a champion is only judged when the record can carry the verdict", () => {
  const { judgeChampion, MIN_POOL_GAMES } = load("src/shared/champion-pool.ts");

  // Una muestra con media y dispersion dadas, en las sumas que pide el modulo
  const scores = (n, mean, sd) => ({
    scored: n,
    scoreSum: n * mean,
    scoreSumSq: n * (sd * sd + mean * mean),
  });
  // La base de Oscar: 792 partidas, 51.1%, nota 6.54
  const base = { games: 792, wins: 405, ...scores(792, 6.54, 1.5) };
  const champ = (n, w, mean) => ({ games: n, wins: w, ...scores(n, mean, 1.5) });

  // Pocas partidas: nada que decir por espectacular que parezca
  assert.equal(judgeChampion(champ(4, 4, 9), base).verdict, null);
  assert.equal(judgeChampion(champ(MIN_POOL_GAMES - 1, 7, 8), base).verdict, null);

  // Sion: 10 partidas, 80%, nota 7.22 — gana mas y la nota acompaña
  const sion = judgeChampion(champ(10, 8, 7.22), base);
  assert.equal(sion.verdict, "reliable");
  assert.ok(sion.winGap > 25 && sion.winGap < 32, sion.winGap);

  // Azir: 8 partidas, 25%, nota 5.59 — pierde mas y la nota lo confirma
  assert.equal(judgeChampion(champ(8, 2, 5.59), base).verdict, "struggles");

  // EL CASO QUE MOTIVO EL REDISEÑO: gana mucho mas y la nota NO se mueve.
  // El veredicto sigue siendo que gana, pero el matiz dice que las victorias
  // no vienen de como juega. Pedir que la nota bajase de forma significativa
  // no disparaba nunca con muestras de diez o veinte partidas.
  const plano = judgeChampion(champ(30, 24, 6.54), base);
  assert.equal(plano.verdict, "reliable");
  assert.equal(plano.agreement, "flat");

  // Si la nota si baja de verdad, el matiz lo dice
  const suerte = judgeChampion(champ(30, 24, 5.2), base);
  assert.equal(suerte.verdict, "reliable");
  assert.equal(suerte.agreement, "contradicts");

  // Y al perder, los papeles se invierten: una nota que sube contradice
  const mala = judgeChampion(champ(30, 8, 7.8), base);
  assert.equal(mala.verdict, "struggles");
  assert.equal(mala.agreement, "contradicts");
  const coherente = judgeChampion(champ(30, 8, 5.2), base);
  assert.equal(coherente.agreement, "supports");

  // Una diferencia dentro del ruido no se etiqueta: 12 partidas al 58%
  // sobre una base del 51% es casualidad, no un hallazgo
  assert.equal(judgeChampion(champ(12, 7, 6.54), base).verdict, null);

  // Y una nota que se mueve menos que su propia dispersion tampoco cuenta
  const ruidosa = judgeChampion({ games: 30, wins: 24, ...scores(30, 6.3, 4) }, base);
  assert.equal(ruidosa.verdict, "reliable", "con la nota indistinguible, manda el winrate");
  assert.equal(ruidosa.agreement, "flat");

  // Los huecos se informan aunque no haya veredicto, para poder enseñarlos
  const flojo = judgeChampion(champ(12, 5, 6.2), base);
  assert.ok(flojo.winGap < 0);
  assert.ok(flojo.scoreGap < 0);
});

test("a detail block is only drawn when the queue actually has the thing it measures", () => {
  const { detailSections, barWidth, maxOf, perMinute, splitTotal, MIN_JUNGLE_CAMPS } = load(
    "src/shared/match-detail.ts",
  );

  // Un jugador con todo a cero salvo lo que se le pase
  const player = (over = {}) => ({
    participantId: 1,
    championId: 1,
    teamId: 100,
    dealt: { physical: 0, magic: 0, trueDamage: 0 },
    taken: { physical: 0, magic: 0, trueDamage: 0 },
    selfMitigated: 0,
    toObjectives: 0,
    toTurrets: 0,
    ccTime: 0,
    longestAlive: 0,
    champLevel: 18,
    goldEarned: 0,
    goldSpent: 0,
    largestCrit: 0,
    killingSprees: 0,
    wardsPlaced: 0,
    wardsKilled: 0,
    controlWards: 0,
    visionScore: 0,
    cs: 0,
    neutralCs: 0,
    totalHeal: 0,
    ...over,
  });
  const team = (over = {}) => ({
    teamId: 100,
    win: false,
    towers: 0,
    inhibitors: 0,
    dragons: 0,
    barons: 0,
    heralds: 0,
    firstBlood: false,
    firstTower: false,
    firstInhibitor: false,
    firstBaron: false,
    firstDragon: false,
    bans: [],
    ...over,
  });

  // La ARAM real 7999040233: torres e inhibidores si, y nada mas. Los diez
  // jugadores pusieron cero guardianes y nadie piso un campamento.
  const aram = {
    gameId: 7999040233,
    teams: [
      team({ teamId: 100, win: true, towers: 4, inhibitors: 3, firstTower: true }),
      team({ teamId: 200, towers: 2, inhibitors: 1, firstBlood: true }),
    ],
    players: [
      player({ participantId: 1, toObjectives: 625, ccTime: 73, cs: 27 }),
      player({ participantId: 7, teamId: 200, toObjectives: 0, ccTime: 5, cs: 35 }),
    ],
  };
  const enAram = detailSections(aram);
  assert.equal(enAram.bans, false, "el Abismo no tiene seleccion");
  assert.equal(enAram.epics, false, "ni dragones ni barones");
  assert.equal(enAram.vision, false, "cero guardianes no es informacion");
  assert.equal(enAram.economy, false, "sin jungla, el farmeo por minuto no compara nada");
  assert.equal(enAram.objectiveDamage, true, "a las torres si se les pega");

  // La Flex real 7761941067: aparece todo
  const grieta = {
    gameId: 7761941067,
    teams: [
      team({ teamId: 100, towers: 4, dragons: 1, bans: [53, 35, 555, 54, 90] }),
      team({
        teamId: 200,
        win: true,
        towers: 9,
        inhibitors: 1,
        dragons: 4,
        barons: 1,
        heralds: 1,
        firstBlood: true,
        firstTower: true,
        firstBaron: true,
        bans: [711, 164, 145, 800, 35],
      }),
    ],
    players: [
      player({ participantId: 5, visionScore: 126, wardsPlaced: 48, wardsKilled: 15, cs: 41 }),
      player({
        participantId: 7,
        teamId: 200,
        visionScore: 25,
        wardsKilled: 5,
        cs: 300,
        neutralCs: 223,
        toObjectives: 48564,
        goldEarned: 17748,
      }),
    ],
  };
  const enGrieta = detailSections(grieta);
  assert.deepEqual(enGrieta, {
    bans: true,
    epics: true,
    vision: true,
    economy: true,
    objectiveDamage: true,
  });

  // Una Gwen que no pone guardianes pero rompe cinco sigue contando como vision
  const soloRompe = { ...grieta, players: [player({ wardsKilled: 5, neutralCs: 300 })] };
  assert.equal(detailSections(soloRompe).vision, true);

  // EL CASO QUE OBLIGO A MEDIR: 194 ARAM guardadas dan puntos de vision a uno
  // o dos jugadores sin que nadie ponga ni rompa un guardian. Ese numero no
  // es control de vision, y el bloque no puede colgar de el.
  const aramConPuntos = {
    ...aram,
    players: [player({ visionScore: 2 }), player({ participantId: 2 })],
  };
  assert.equal(detailSections(aramConPuntos).vision, false);

  // Y el otro extremo medido: 7 campamentos en una ARAM no son una jungla,
  // 32 en la Grieta mas corta si lo son
  assert.ok(
    MIN_JUNGLE_CAMPS > 7 && MIN_JUNGLE_CAMPS < 32,
    "el umbral debe caer en el hueco medido",
  );
  assert.equal(detailSections({ ...aram, players: [player({ neutralCs: 7 })] }).economy, false);
  assert.equal(detailSections({ ...aram, players: [player({ neutralCs: 32 })] }).economy, true);

  // Un baneo saltado llega como -1 y el lector lo quita antes; una lista vacia
  // no enciende el bloque
  assert.equal(detailSections({ ...grieta, teams: [team(), team()] }).bans, false);

  // Las barras: una escala por seccion, y cero maximo deja todo vacio en vez
  // de todo lleno
  assert.equal(
    maxOf(grieta.players, (p) => p.toObjectives),
    48564,
  );
  assert.equal(barWidth(48564, 48564), 100);
  assert.equal(barWidth(24282, 48564), 50);
  assert.equal(barWidth(0, 48564), 0);
  assert.equal(barWidth(5, 0), 0, "sin maximo, nadie llena la barra");
  assert.equal(barWidth(200, 100), 100, "una barra nunca se sale de su carril");

  // Por minuto, que es como compara el resto de la app
  assert.equal(Math.round(perMinute(300, 2184) * 10) / 10, 8.2);
  assert.equal(perMinute(300, 0), 0);

  assert.equal(splitTotal({ physical: 48063, magic: 0, trueDamage: 9526 }), 57589);
});

test("the detail page's path is named once, not typed out in each link", () => {
  const shared = fs.readFileSync(path.resolve(__dirname, "../src/shared/match-detail.ts"), "utf8");
  assert.match(shared, /export const MATCH_DETAIL_PATH = "\/match"/);

  // La pantalla en negro de la v0.7.8 salio de una ruta escrita a mano que no
  // coincidia con ninguna del router. Aqui la ruta y los enlaces salen de la
  // misma constante, y esto lo vigila.
  for (const file of ["src/renderer/App.tsx", "src/renderer/pages/MatchHistory.tsx"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.ok(
      source.includes("MATCH_DETAIL_PATH"),
      file + " deberia usar MATCH_DETAIL_PATH en vez de escribir la ruta",
    );
    assert.ok(
      !/(to|path)=\{?"\/match/.test(source),
      file + " escribe /match a mano; usa la constante",
    );
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
