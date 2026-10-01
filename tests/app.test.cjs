// La aplicación alrededor de las partidas: la cola seleccionada, el
// actualizador, la ventana, la barra lateral, los atajos y dónde viven los
// datos.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers.cjs");

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
