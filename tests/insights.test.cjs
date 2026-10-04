// Lo que la aplicación se atreve a decir: las frases del resumen, el
// veredicto por campeón, el resumen de la noche y las etiquetas de jugador.
// Casi todo aquí tiene una regla para callarse cuando la muestra no da.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");

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
    queue_id: 2400,
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

  const empty = home.summarizeHome([], 2400, now);
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
  const summary = home.summarizeHome(rows, 2400, now);
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
  // Y desde la v0.8.3 el ARAM normal es una de esas colas: comparte mapa con
  // ARAM Caos pero no su curva de daño, y la nota se calibro con aumentos.
  assert.equal(home.summarizeHome(few, 450, now).bestChampion.rankedBy, "winRate");
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

test("the explorer only colours a gap the sample can carry", () => {
  const { gapCarries, metricByKey } = load("src/shared/explore.ts");
  const winRate = metricByKey("winRate");
  const fila = (games, wins) => ({
    key: "x",
    games,
    wins,
    sample: games,
    value: (wins / games) * 100,
    sd: 0,
  });

  // 799 partidas al 51% es la media con la que se compara todo
  const global = fila(799, 408);

  // Diez partidas al 80% son 29 puntos arriba: pasa el suelo y el ruido
  assert.equal(gapCarries(fila(10, 8), global, winRate), true);
  // Doce al 67% son 16 puntos, que a esa muestra ya no se distinguen del azar
  assert.equal(gapCarries(fila(12, 8), global, winRate), false);
  // Y 400 partidas al 57% son 6 puntos que la muestra sí sostiene —aguantan
  // la prueba de ruido— pero se quedan por debajo del suelo de 8 puntos, así
  // que tampoco se marcan: los dos filtros hacen falta, no solo el ruido.
  assert.equal(gapCarries(fila(400, 228), global, winRate), false);

  // Cuatro derrotas de cuatro no son una prueba: con una proporción de 0% el
  // error estándar sale exactamente cero y, sin un mínimo de muestra, la
  // regla marcaría esa fila como diferencia real. Se vio en la vista por
  // colas, donde una cola de 4 partidas aparecía destacada.
  assert.equal(gapCarries(fila(4, 0), global, winRate), false);
  assert.equal(gapCarries(fila(2, 2), global, winRate), false);

  // Un recuento no se compara con nada
  assert.equal(gapCarries(fila(10, 8), global, metricByKey("games")), false);

  // Las medias llevan su propia desviación, no una derivada de la proporción
  const nota = metricByKey("score");
  const media = (sample, value, sd) => ({ key: "x", games: sample, wins: 0, sample, value, sd });
  const base = media(799, 6.55, 1.8);
  // Treinta partidas una nota entera por encima, con el mismo reparto: se ve
  assert.equal(gapCarries(media(30, 7.6, 1.8), base, nota), true);
  // La misma distancia con el triple de dispersión deja de verse
  assert.equal(gapCarries(media(30, 7.6, 5.4), base, nota), false);
  // Y una muestra de una partida nunca se marca, por lejos que caiga
  assert.equal(gapCarries(media(1, 10, 0), base, nota), false);
});

test("the live column reads your own record around a champion, and shuts up when it cannot", () => {
  const consultas = [];
  const filas = [
    { champion: 222, side: "ally", games: 41, wins: 27 },
    { champion: 222, side: "enemy", games: 38, wins: 14 },
    { champion: 157, side: "self", games: 12, wins: 8 },
    { champion: 157, side: "enemy", games: 26, wins: 12 },
  ];
  const db = {
    prepare(sql) {
      consultas.push(sql);
      return {
        get: () => ({ games: 799, wins: 408 }),
        all: () => filas,
      };
    },
  };
  const mod = load("src/main/db/matchups.ts", {
    "./connection": { db },
    "./filters": {
      applyQueueFilter: (where, params, queue) => {
        where.push("g.queue_id = ?");
        params.push(queue ?? 2400);
      },
    },
    "./summoner": { getAllPuuids: () => ["yo"] },
  });

  const got = mod.getChampionMatchups([222, 157, 0, 222], 2400);
  assert.deepEqual(got.overall, { games: 799, wins: 408 });
  // El campeón sin resolver (0) no se pregunta, y los repetidos van una vez
  assert.deepEqual(Object.keys(got.byChampion).sort(), ["157", "222"]);
  assert.deepEqual(got.byChampion[222].ally, { games: 41, wins: 27 });
  assert.deepEqual(got.byChampion[222].enemy, { games: 38, wins: 14 });
  // Un lado del que no vino fila queda a cero, no indefinido
  assert.deepEqual(got.byChampion[222].self, { games: 0, wins: 0 });

  // Una misma partida no puede contarse dos veces porque dos cuentas nuestras
  // estuvieran en ella: la consulta se queda con una sola fila propia.
  const agrupada = consultas.find((sql) => sql.includes("GROUP BY champion, side"));
  assert.ok(agrupada, "no se llegó a consultar por campeón y lado");
  assert.match(agrupada, /MIN\(m2\.participant_id\)/, "falta la desambiguación de cuenta propia");

  // Y la fila del marcador: el lado que toca, la distancia a tu media, y el
  // color solo cuando la muestra la sostiene.
  const base = { games: 799, wins: 408 };
  const contra = mod.yourMatchup(got.byChampion[222], base, "enemy");
  assert.equal(contra.games, 38);
  assert.ok(contra.gap < -13 && contra.gap > -15, "distancia a tu media: " + contra.gap);
  assert.equal(contra.carries, true);

  // Doce partidas al 67% son 16 puntos, que a esa muestra no se distinguen
  const conEl = mod.yourMatchup(got.byChampion[157], base, "self");
  assert.equal(conEl.games, 12);
  assert.equal(conEl.carries, false);

  // Nada que decir: un lado sin partidas, y un campeón que nunca ha salido
  assert.equal(mod.yourMatchup(got.byChampion[157], base, "ally"), null);
  assert.equal(mod.yourMatchup(undefined, base, "enemy"), null);
  // Y una cuenta recién estrenada, sin media contra la que comparar
  assert.equal(mod.yourMatchup(got.byChampion[222], { games: 0, wins: 0 }, "enemy"), null);
});

test("a rate of zero is not evidence, however many games it spans", () => {
  const { gapCarries, metricByKey } = load("src/shared/explore.ts");
  const tasa = metricByKey("firstBlood");
  assert.equal(tasa.proportion, true, "la primera sangre debe medirse como proporción");

  // Tu media real: 12,6% de las partidas con primera sangre propia.
  const global = { key: "", games: 799, wins: 0, sample: 799, value: 12.6, sd: 33.2 };
  // Un campeón que nunca la hizo en 15 partidas. Su desviación es CERO, y esa
  // es la trampa: con la fórmula de medias el error se va casi a cero y un
  // hueco de 12,6 puntos pasaría por hallazgo. Pero cero de quince al 12,6%
  // ocurre una vez de cada siete.
  const nunca = { key: "x", games: 15, wins: 0, sample: 15, value: 0, sd: 0 };
  assert.equal(gapCarries(nunca, global, tasa), false, "cero en quince no es un hallazgo");

  // Y lo que sí lo es: cinco de doce, cuando lo normal es una de ocho.
  const mucho = { key: "y", games: 12, wins: 0, sample: 12, value: 41.7, sd: 49.3 };
  assert.equal(gapCarries(mucho, global, tasa), true);

  // La guarda de que el arreglo es el que creemos: con la regla de medias, la
  // fila de ceros sí pasaría. Si alguien quita `proportion`, esto lo caza.
  const comoMedia = { ...tasa, proportion: undefined };
  assert.equal(gapCarries(nunca, global, comoMedia), true, "así es como fallaba antes");
});
