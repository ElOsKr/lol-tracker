// La nota, el puesto en la partida y los rangos del lobby: todo lo que
// convierte una partida en un número.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");

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

test("the score is ARAM Caos's alone, and the Rift's two columns hang on wards", () => {
  const { hasScore, SCORE_POLICY_VERSION } = load("src/shared/queues.ts");
  const { QUEUE_CATALOG } = load("src/shared/queue-catalog.ts");
  const { showsLaneStats } = load("src/shared/history-columns.ts");

  // La nota se calibro con lobbies de ARAM Caos, aumentos incluidos. El ARAM
  // normal comparte mapa pero no curva de daño, y durante 195 partidas llevo
  // una nota que nadie calibro para el.
  assert.equal(hasScore(2400), true, "ARAM Caos");
  assert.equal(hasScore(3270), true, "ARAM: Caos, que estaba fuera por escribir la lista a mano");
  assert.equal(hasScore(2450), true, "ARAM Caos Classic");
  assert.equal(hasScore(450), false, "ARAM normal ya no");
  assert.equal(hasScore(440), false, "Grieta tampoco");
  assert.equal(hasScore(1700), false, "ni Arena");

  // Sale del catalogo, no de una lista escrita a mano, para que una cola de
  // Caos nueva entre sola
  const conNota = QUEUE_CATALOG.filter((q) => hasScore(q.id));
  assert.ok(conNota.length >= 3, "deberia haber varias colas de Caos");
  for (const q of conNota)
    assert.match(q.label, /Caos/i, q.id + " no parece ARAM Caos: " + q.label);
  // Y ninguna cola de fuera se cuela
  for (const q of QUEUE_CATALOG)
    if (!/Caos/i.test(q.label || "")) assert.equal(hasScore(q.id), false, q.id);

  // Cambiar el conjunto de colas puntuadas tiene que mover la version, o las
  // 195 notas viejas se quedarian guardadas
  assert.match(SCORE_POLICY_VERSION, /caos/i);

  // Las columnas de la Grieta: la prueba son los GUARDIANES, no los puntos de
  // vision. Medido sobre la biblioteca: el Abismo no registra un solo
  // guardian en 1003 partidas, pero el cliente reparte algun punto de vision
  // suelto en una de cada sesenta — colgar la columna de ahi la sacaria en
  // ARAM llena de ceros.
  const aram = [{ wards: 0 }, { wards: 0 }, { wards: 0 }];
  assert.equal(showsLaneStats(aram), false);
  assert.equal(showsLaneStats([{ wards: 0 }, { wards: 14 }]), true, "una sola partida basta");
  assert.equal(showsLaneStats([]), false, "sin partidas no se inventan columnas");
});
