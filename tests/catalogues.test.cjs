// Los catálogos que vienen de Riot — objetos, aumentos, parches— y los
// diccionarios de la interfaz.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");

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
