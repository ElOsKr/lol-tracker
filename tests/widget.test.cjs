// El widget de escritorio, su servidor para OBS y el aviso de fin de
// partida.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { load } = require("./helpers.cjs");
const http = require("node:http");
const { EventEmitter } = require("node:events");

const { startWidgetServer } = load("src/main/widget-server.ts");
const root = path.resolve(__dirname, "../public-widget");

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
