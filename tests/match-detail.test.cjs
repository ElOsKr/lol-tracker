// La página de detalle de una partida y lo que cuelga de ella: la línea
// temporal, el mapa de muertes, los ejes de habilidad y qué bloques se
// dibujan en cada cola.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers.cjs");

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

test("every match filter reaches the list, not just the summaries", () => {
  // useMatches no reenvia el objeto de filtros: lo desmonta y lo vuelve a
  // montar clave por clave. Olvidar una no rompe nada visible — la lista
  // ignora ese filtro mientras el resto de la pagina lo obedece, que es
  // exactamente como se colo el filtro por objeto.
  // Busca la interfaz donde este, en vez de nombrar un archivo: la primera
  // version leia src/shared/api.ts, y al repartir ese archivo por areas el
  // tipo se fue a api/matches.ts y la prueba fallo sin que nada estuviera
  // roto. Una prueba que hay que actualizar al mover codigo vigila el sitio,
  // no la regla.
  const DECL = "export interface MatchFilters {";
  const buscar = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        const dentro = buscar(completo);
        if (dentro) return dentro;
      } else if (entrada.name.endsWith(".ts")) {
        const texto = fs.readFileSync(completo, "utf8");
        if (texto.includes(DECL)) return texto;
      }
    }
    return null;
  };
  const api = buscar(path.resolve(__dirname, "../src/shared"));
  assert.ok(api, "no encuentro MatchFilters en src/shared");
  const hook = fs.readFileSync(
    path.resolve(__dirname, "../src/renderer/hooks/useMatches.ts"),
    "utf8",
  );

  const block = api.slice(api.indexOf(DECL));
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
    perks: { primaryStyle: 0, subStyle: 0, selected: [] },
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
  assert.equal(enAram.runes, false, "Mayhem las elige por ti y devuelve ceros");

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
        perks: {
          primaryStyle: 8000,
          subStyle: 8300,
          selected: [8010, 9111, 9104, 8299, 8347, 8304],
        },
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
    runes: true,
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

const RUTA_A_MANO = /(to|path)=\{?"\/match/;

test("the detail page's path is named once, not typed out in each link", () => {
  const shared = fs.readFileSync(path.resolve(__dirname, "../src/shared/match-detail.ts"), "utf8");
  assert.match(shared, /export const MATCH_DETAIL_PATH = "\/match"/);

  // La pantalla en negro de la v0.7.8 salio de una ruta escrita a mano que no
  // coincidia con ninguna del router. Esto vigila que nadie vuelva a escribirla.
  //
  // Recorre el renderer entero en vez de una lista de archivos: la primera
  // version nombraba MatchHistory.tsx, y al partir ese archivo el enlace se fue
  // a GameRow.tsx y la prueba fallo sin que nada estuviera roto. Una prueba que
  // hay que actualizar al mover codigo vigila el sitio, no la regla.
  const renderer = path.resolve(__dirname, "../src/renderer");
  const archivos = [];
  const recorrer = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(completo);
      else if (/[.]tsx?$/.test(entrada.name)) archivos.push(completo);
    }
  };
  recorrer(renderer);
  assert.ok(archivos.length > 20, "esperaba bastantes archivos de renderer");

  let usos = 0;
  for (const file of archivos) {
    const source = fs.readFileSync(file, "utf8");
    if (source.includes("MATCH_DETAIL_PATH")) usos++;
    assert.ok(
      !RUTA_A_MANO.test(source),
      path.relative(renderer, file) + " escribe /match a mano; usa la constante",
    );
  }
  // El router y al menos un enlace
  assert.ok(usos >= 2, "solo " + usos + " archivos usan la constante");
});

test("the match chart reads from your side of the game, not from Riot's team order", () => {
  const { goldSwing, ownVersusAverage, peakOf, worstMoment, dotPosition, mapSpan, hasMap } = load(
    "src/shared/match-timeline.ts",
  );

  // Dos minutos de una partida de cinco contra cinco. El equipo 100 va
  // ganando por 300 en el primero y por 900 en el segundo.
  const frames = [
    { minute: 0, kills: 0, gold: { 1: 500, 2: 500, 3: 500, 6: 350, 7: 350, 8: 500 } },
    { minute: 1, kills: 3, gold: { 1: 900, 2: 900, 3: 900, 6: 600, 7: 600, 8: 600 } },
  ];
  const teams = { 1: 100, 2: 100, 3: 100, 6: 200, 7: 200, 8: 200 };
  const teamOf = (id) => teams[id];

  // El mismo dato, leido desde cada lado, sale con el signo cambiado. Esto es
  // lo que evita que la grafica se lea al reves en la mitad de las partidas.
  assert.deepEqual(goldSwing(frames, teamOf, 100), [300, 900]);
  assert.deepEqual(goldSwing(frames, teamOf, 200), [-300, -900]);

  // Tu oro y la media de los diez de esa partida
  const mio = ownVersusAverage(frames, 7);
  assert.deepEqual(mio.own, [350, 600]);
  assert.deepEqual(mio.average, [450, 750]);
  // Sin saber quien eres, la media sigue siendo util
  assert.deepEqual(ownVersusAverage(frames, null).own, [0, 0]);

  // LA ARAM REAL 7999040233, desde el lado de Oscar (equipo 200): por delante
  // los tres primeros minutos y por detras los veintiuno siguientes.
  const aram = [
    0, -3, 220, 228, 166, -895, -313, -393, -1110, -1772, -3206, -3155, -3803, -3712, -3407, -3535,
    -3203, -2869, -4656, -3393, -3285, -2359, -1888, -2005, -2951,
  ];
  assert.deepEqual(worstMoment(aram), { minute: 18, gap: -4656 });
  assert.equal(peakOf(aram), 4656);
  assert.equal(aram.filter((v) => v > 0).length, 3, "solo tres minutos por delante");

  // Una partida en la que nunca se va por detras no tiene peor momento
  assert.equal(worstMoment([0, 100, 250]), null);
  // Y una escala nunca es cero, o cada barra saldria llena en vez de vacia
  assert.equal(peakOf([]), 1);
  assert.equal(peakOf([0, 0, 0]), 1);

  // El mapa: la y del juego crece al norte y la de la pantalla hacia abajo
  const abismo = mapSpan(12);
  assert.equal(abismo, 12850);
  const centro = dotPosition({ x: 6425, y: 6425 }, abismo);
  assert.equal(Math.round(centro.left), 50);
  assert.equal(Math.round(centro.top), 50);
  const arriba = dotPosition({ x: 1000, y: 12000 }, abismo);
  assert.ok(arriba.top < 10, "una muerte al norte se pinta arriba, no abajo");
  // Una coordenada imposible se queda dentro del cuadro en vez de salirse
  const fuera = dotPosition({ x: 99999, y: -5000 }, abismo);
  assert.equal(fuera.left, 100);
  assert.equal(fuera.top, 100);
  // Un mapa que nadie ha medido usa el mayor, que mete los puntos hacia
  // dentro en vez de sacarlos del cuadro
  assert.equal(mapSpan(30), 14870);
  assert.equal(mapSpan(null), 14870);

  // Sin dibujo del mapa o sin muertes, el bloque no sale
  const base = { gameId: 1, mapId: 12, span: 12850, frames: [], kills: [{ x: 1, y: 1 }] };
  assert.equal(hasMap({ ...base, minimapUrl: "https://x/map12.png" }), true);
  assert.equal(hasMap({ ...base, minimapUrl: null }), false);
  assert.equal(hasMap({ ...base, minimapUrl: "https://x/map12.png", kills: [] }), false);
  assert.equal(hasMap(null), false);
});

test("a skill axis is a place inside its own game, and a trend has to beat its noise", () => {
  const {
    axisValues,
    percentileAmong,
    axesFor,
    summarize,
    meaningfulShift,
    canCompareTrend,
    CORE_AXES,
    MIN_JUNGLE_CAMPS,
    TREND_WINDOW,
  } = load("src/shared/skill-axes.ts");

  const jugador = (over = {}) => ({
    kills: 0,
    assists: 0,
    teamKills: 20,
    deaths: 0,
    damageToChampions: 0,
    damageTaken: 0,
    selfMitigated: 0,
    ccTime: 0,
    gold: 0,
    wardsPlaced: 0,
    wardsKilled: 0,
    cs: 0,
    neutralCs: 0,
    minutes: 20,
    ...over,
  });

  // Todos los ejes apuntan al mismo lado: mas es mejor. Las muertes van
  // negadas, o la tabla tendria una fila que se lee al reves.
  const muereMucho = axisValues(jugador({ deaths: 10 }));
  const muerePoco = axisValues(jugador({ deaths: 2 }));
  assert.ok(muerePoco.survival > muereMucho.survival, "morir menos puntua mas");

  // Y todo lo acumulable va por minuto, como el resto de la app
  assert.equal(axisValues(jugador({ damageToChampions: 40000, minutes: 20 })).damage, 2000);
  assert.equal(axisValues(jugador({ damageToChampions: 40000, minutes: 40 })).damage, 1000);
  assert.equal(axisValues(jugador({ kills: 3, assists: 7, teamKills: 20 })).aggression, 0.5);
  // Una partida sin una sola muerte del equipo no divide por cero
  assert.equal(axisValues(jugador({ kills: 0, teamKills: 0 })).aggression, 0);

  // El percentil: de los otros nueve, a cuantos superas
  const diez = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentileAmong(diez, 10), 100, "el mejor supera a los nueve");
  assert.equal(percentileAmong(diez, 1), 0, "el peor no supera a nadie");
  assert.equal(Math.round(percentileAmong(diez, 6)), 56);
  // Empatar no es superar: un eje donde nadie puntuo no da un 100 a los diez
  assert.equal(percentileAmong([0, 0, 0, 0], 0), 0);

  // Vision y farmeo solo donde la cola los tiene, con el mismo umbral que la
  // pagina de detalle. En ARAM nadie pone un guardian ni pisa un campamento.
  const aram = [jugador(), jugador({ cs: 70 })];
  assert.deepEqual(axesFor(aram), [...CORE_AXES]);
  assert.ok(axesFor([jugador({ wardsPlaced: 1 })]).includes("vision"));
  assert.ok(axesFor([jugador({ wardsKilled: 1 })]).includes("vision"), "romperlo tambien cuenta");
  assert.ok(!axesFor([jugador({ neutralCs: 7 })]).includes("farm"), "7 campamentos no son jungla");
  assert.ok(axesFor([jugador({ neutralCs: 32 })]).includes("farm"), "32 si");
  assert.ok(MIN_JUNGLE_CAMPS > 7 && MIN_JUNGLE_CAMPS < 32);

  // LOS CAMBIOS REALES MEDIDOS sobre las 994 ARAM de Oscar, primeras 200
  // frente a ultimas 200. La supervivencia sube 19 puntos y eso es un
  // hallazgo; el control baja 3 y eso es ruido.
  const conSd = (mean, sd, count) => ({ mean, sd, count });
  const sd = 30; // dispersion tipica de un percentil sobre 200 partidas
  assert.equal(meaningfulShift(conSd(38.8, sd, 200), conSd(58.1, sd, 200)), true, "supervivencia");
  assert.equal(meaningfulShift(conSd(61.9, sd, 200), conSd(50.8, sd, 200)), true, "aguante");
  assert.equal(
    meaningfulShift(conSd(55.7, sd, 200), conSd(52.4, sd, 200)),
    false,
    "control es ruido",
  );

  // Muestras diminutas no hablan por espectaculares que parezcan
  assert.equal(meaningfulShift(conSd(10, 30, 1), conSd(90, 30, 1)), false);
  assert.equal(canCompareTrend(TREND_WINDOW * 2 - 1), false);
  assert.equal(canCompareTrend(TREND_WINDOW * 2), true);

  // El resumen, que es de donde sale todo lo anterior
  const m = summarize([10, 20, 30]);
  assert.equal(m.mean, 20);
  assert.equal(m.count, 3);
  assert.ok(Math.abs(m.sd - 8.165) < 0.01);
  assert.deepEqual(summarize([]), { mean: 0, sd: 0, count: 0 });
});
