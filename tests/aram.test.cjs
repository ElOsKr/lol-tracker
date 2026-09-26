const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "loleanding-aram-test-"));
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
const load = Module._load;
let history = [];
const requested = [];
Module._load = function (name, parent, main) {
  if (name === "./paths") return { getDataDir: () => directory };
  if (name === "./dragon")
    return {
      getChampionClasses: () => ({ 1: "Tank", 2: "Support", 3: "Marksman" }),
      getChampionDataVersion: () => "test",
      loadAugmentData: async () => ({}),
      loadItemData: async () => ({}),
    };
  if (name === "league-connect")
    return {
      authenticate: async () => ({}),
      ClientNotFoundError: class extends Error {},
      ClientElevatedPermsError: class extends Error {},
      createHttp1Request: async ({ url }) => {
        requested.push(url);
        return {
          ok: true,
          json: async () =>
            url.includes("/games/")
              ? history.find((game) => url.endsWith(String(game.gameId)))
              : { games: { games: history } },
        };
      },
    };
  return load.call(this, name, parent, main);
};
const db = require("../src/main/db.ts");
const lcu = require("../src/main/lcu.ts");
const account = "fixture-owner";

function game(gameId, queueId, win = true, duration = 1200, early = false) {
  return {
    gameId,
    queueId,
    gameMode: "ARAM",
    gameDuration: duration,
    gameCreation: Date.UTC(2026, 8, 13, 12) + gameId * 1000,
    gameVersion: "26.18.1",
    participants: Array.from({ length: 10 }, (_, index) => ({
      participantId: index + 1,
      puuid: index === 0 ? account : `fixture-${index}`,
      championId: index + 1,
      teamId: index < 5 ? 100 : 200,
      stats: {
        win: index < 5 ? win : !win,
        kills: 3,
        deaths: 2,
        assists: 5,
        totalDamageDealtToChampions: 10000,
        totalDamageTaken: 8000,
        goldEarned: 7000,
        gameEndedInEarlySurrender: early,
        playerAugment1: queueId === 450 ? 0 : 1,
      },
    })),
  };
}

test("ARAM capture, legacy discards, isolated statistics, scores and persistence", async () => {
  db.initDatabase();
  try {
    const sql = db.getDatabase();
    const maps = require("../src/shared/maps.ts");
    assert.equal(maps.mapNameForSkin("Default", 11), "Grieta del Invocador");
    assert.equal(maps.mapNameForSkin("Default", 12), "Howling Abyss");
    const totals = require("../src/main/queue-totals.ts");
    const observation = { gameId: 500, localPlayer: { puuid: account, wins: 2000, losses: 1800 } };
    const observedGame = game(500, 450);
    assert.equal(totals.saveQueueLifetimeTotal(observation, observedGame, account), true);
    assert.equal(totals.saveQueueLifetimeTotal(observation, observedGame, account), false);
    assert.equal(
      totals.saveQueueLifetimeTotal(observation, observedGame, "another-account"),
      false,
    );
    assert.equal(
      totals.saveQueueLifetimeTotal(
        { ...observation, localPlayer: { puuid: account, wins: 0, losses: 0 } },
        observedGame,
        account,
      ),
      false,
    );
    assert.equal(
      totals.saveQueueLifetimeTotal(
        { ...observation, localPlayer: { puuid: account, wins: null, losses: 1800 } },
        observedGame,
        account,
      ),
      false,
    );
    assert.equal(
      totals.saveQueueLifetimeTotal(
        { ...observation, localPlayer: { puuid: account, wins: 1, losses: 2 } },
        observedGame,
        account,
      ),
      false,
    );
    assert.equal(
      totals.saveQueueLifetimeTotal({ ...observation, gameId: 499 }, game(499, 450), account),
      false,
    );
    assert.equal(
      totals.saveQueueLifetimeTotal({ ...observation, gameId: 501 }, game(501, 420), account),
      true,
    );
    assert.equal(totals.getQueueLifetimeTotals().length, 2);
    assert.equal(totals.getQueueLifetimeTotals().find((r) => r.queueId === 450).wins, 2000);
    sql.prepare("INSERT INTO ignored_games (game_id) VALUES (?)").run(1);
    db.setSetting(`backfill_complete_${account}`, "1");
    assert.equal(db.getKnownGameIds().has(1), false);
    assert.equal(db.isGameKnown(1), false);
    history = [game(1, 450), game(2, 2400, false), game(3, 2450), game(4, 1090), game(5, 1090)];
    const captured = await lcu.fetchNewGames(null, {
      puuid: account,
      gameName: "Fixture",
      tagLine: "TEST",
    });
    assert.equal(captured.newGames, 3);
    assert.equal(captured.rolledOver, false);
    assert.equal(db.isGameKnown(1), true);
    assert.equal(db.isGameKnown(4), true);
    assert.equal(db.isGameKnown(5), true);
    assert.equal(
      requested.some((url) => url.endsWith("/games/1")),
      true,
    );
    assert.equal(
      requested.some((url) => url.endsWith("/games/4")),
      false,
    );
    assert.equal(
      (await lcu.fetchNewGames(null, { puuid: account, gameName: "Fixture", tagLine: "TEST" }))
        .newGames,
      0,
    );
    assert.equal(db.insertGameFull(game(6, 1090), account), false);
    sql.exec("SAVEPOINT queue_fixtures");
    for (const queueId of [400, 420, 440, 480, 490, 700, 720, 830, 900, 1020, 1400, 1810, 0]) {
      const id = 10000 + queueId;
      const fixture = game(id, queueId, true, 120);
      fixture.gameMode = queueId === 1810 ? "STRAWBERRY" : "CLASSIC";
      assert.equal(db.insertGameFull(fixture, account), true, "Queue " + queueId);
      assert.equal(db.getMatchDetail(id).stats.score, null);
      assert.equal(db.getMatchDetail(id).game.is_remake, 0);
      assert.equal(db.getMatchHistory(20, 0, { queue: queueId }).matches[0].queue_id, queueId);
    }
    const missingResult = game(50000, 420);
    delete missingResult.participants[0].stats.win;
    assert.equal(db.insertGameFull(missingResult, account), false);
    const tft = game(50001, 0);
    tft.gameMode = "TFT";
    assert.equal(db.insertGameFull(tft, account), false);
    const arena = game(60000, 1700);
    arena.gameMode = "CHERRY";
    arena.participants.forEach((p, i) => {
      p.stats.playerSubteamId = Math.floor(i / 2) + 1;
      p.stats.subteamPlacement = Math.floor(i / 2) + 1;
      p.stats.win = i < 4;
    });
    assert.equal(db.insertGameFull(arena, account), true);
    assert.equal(db.getMatchHistory(20, 0, { queue: 1700 }).matches[0].placement, 1);
    assert.equal(db.getMatchDetail(60000).participants[2].teamId, 2);
    assert.equal(db.getMatchDetail(60000).participants[2].placement, 2);
    const modeRows = db.getDatabase().prepare("SELECT COUNT(*) AS n FROM match_mode_stats").get().n;
    assert.ok(modeRows > 0);
    // Keep the original ARAM totals below focused on their original fixtures.
    sql.exec("ROLLBACK TO queue_fixtures; RELEASE queue_fixtures");
    assert.equal(db.selectedQueue(), 450);
    assert.deepEqual(
      db.getMatchHistory(20, 0).matches.map((row) => row.queue_id),
      [450],
    );
    assert.equal(db.getDashboardData().wins, 1);
    assert.equal(db.getRecords().totalGames, 1);
    assert.doesNotThrow(() => db.getGlobalStats());
    assert.doesNotThrow(() => db.getTrendsData());
    assert.equal(db.getAugmentStatsAll().length, 0);
    const aramScore = db.getMatchDetail(1).stats.score;
    assert.equal(typeof aramScore, "number");
    assert.equal(db.getDashboardData().avgScore, aramScore);
    const scoring = require("../src/shared/opScore.ts");
    const inputs = game(1, 450).participants.map((p) => ({
      ...p,
      ...p.stats,
      doubleKills: 0,
      tripleKills: 0,
      quadraKills: 0,
      pentaKills: 0,
      totalHeal: 0,
    }));
    const classes = { 1: "Tank", 2: "Support", 3: "Marksman" };
    const breakdown = scoring.computeMatchScoreBreakdowns(inputs, classes, 450).get(1);
    assert.equal(aramScore, breakdown.score, "stored score matches renderer breakdown");
    assert.equal(
      db.getTeammateDetail("fixture-1").matches[0].friend.score,
      scoring.computeMatchScores(inputs, classes, 450).get(2).score,
      "friends use the same queue profile",
    );
    const oldAramScore = scoring.computeMatchScores(inputs, classes, 2400).get(1);
    assert.notEqual(aramScore, oldAramScore.score, "fixture distinguishes ARAM profiles");
    const mayhemBefore = [2, 3].map((id) => db.getMatchDetail(id).stats);
    assert.equal(typeof db.getMatchDetail(2).stats.score, "number");
    db.setSetting("selected_queue", "2400");
    assert.equal(db.getDashboardData().wins, 0);
    assert.equal(db.getMatchHistory(20, 0).matches[0].queue_id, 2400);
    assert.equal(db.getMatchHistory(20, 0, { queue: 450 }).matches[0].queue_id, 450);
    assert.equal(db.getGameRecap(1).career.games, 1);
    assert.equal(db.getGameRecap(1).career.wins, 1);
    assert.deepEqual(db.getStoredQueues(), [450, 2400, 2450]);
    assert.equal(
      db.getMatchSessions().reduce((sum, row) => sum + row.games, 0),
      1,
    );
    assert.throws(() => db.setSetting("selected_queue", "1090"), /Invalid queue/);
    db.markIgnoredGame(7);
    assert.equal(db.getKnownGameIds().has(7), true);
    assert.equal(db.isGameKnown(7), true);
    sql
      .prepare("INSERT INTO ignored_games_by_policy (game_id, policy) VALUES (?, ?)")
      .run(99, "old-policy");
    assert.equal(db.isGameKnown(99), false);
    assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM ignored_games").get().count, 1);
    db.insertGameFull(game(8, 450, true, 240, false), account);
    db.insertGameFull(game(9, 450, false, 120, true), account);
    assert.equal(db.getMatchDetail(8).game.is_remake, 0);
    assert.equal(db.getMatchDetail(9).game.is_remake, 1);
    // Simulate an existing ARAM score under the v1 profile, not only a null note.
    sql
      .prepare("UPDATE player_stats SET score=?, score_raw=?, score_badge=? WHERE game_id=1")
      .run(oldAramScore.score, oldAramScore.raw, oldAramScore.badge);
    db.setSetting("score_formula_version", "4@test:mayhem-v4-aram-experimental-v1");
    assert.equal(db.checkScoreBackfill(), true);
    assert.equal(db.getMatchDetail(1).stats.score, aramScore);
    assert.equal(db.getMatchDetail(9).stats.score, null);
    assert.deepEqual(
      [2, 3].map((id) => db.getMatchDetail(id).stats),
      mayhemBefore,
    );
    assert.equal(db.checkScoreBackfill(), false);
    const file = path.join(directory, "export.json");
    await db.writeExportTo(file);
    const exported = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(exported.games.length, 5);
    const savedTotals = totals.getQueueLifetimeTotals();
    sql.prepare("DELETE FROM queue_lifetime_totals").run();
    assert.equal(db.importData(exported), 0);
    assert.deepEqual(totals.getQueueLifetimeTotals(), savedTotals);
    db.repairPuuids();
    assert.equal(db.getMatchDetail(1).stats.score, aramScore);
    assert.equal(db.getMatchDetail(9).stats.score, null);
    assert.deepEqual(
      [2, 3].map((id) => db.getMatchDetail(id).stats),
      mayhemBefore,
    );
    assert.equal(db.getMatchDetail(8).game.is_remake, 0);
    db.setSetting("widget_queue", "450");
    db.setSetting("widget_account", account);
    const widget = require("../src/main/widget.ts");
    const snapshot = widget.widgetSnapshot();
    assert.equal(
      snapshot.matches.every((row) => row.queueId === 450),
      true,
    );
    assert.equal(snapshot.totalWins, 2);
    assert.equal(snapshot.totalLosses, 0);
    history = Array.from({ length: 20 }, (_, index) => game(100 + index, 1090));
    const summoner = { puuid: account, gameName: "Fixture", tagLine: "TEST" };
    assert.equal((await lcu.fetchNewGames(null, summoner)).rolledOver, true);
    assert.equal((await lcu.fetchNewGames(null, summoner)).rolledOver, false);
    assert.equal((await lcu.syncRecentGames(null, summoner)).newGames, 0);
    db.closeDatabase();
    db.initDatabase();
    assert.equal(db.selectedQueue(), 2400);
    assert.equal(db.getMatchDetail(1).stats.score, aramScore);
    assert.equal(totals.getQueueLifetimeTotals().length, 2);
    assert.equal(db.getSetting("widget_queue"), "450");
    assert.equal(db.getDatabase().pragma("integrity_check", { simple: true }), "ok");
  } finally {
    db.closeDatabase();
    Module._load = load;
    // Directory is an explicit fresh temporary directory created by this test.
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("ARAM profile is isolated, bounded and consistent with its breakdown", () => {
  const { computeMatchScores, computeMatchScoreBreakdowns } = require("../src/shared/opScore.ts");
  const classes = {
    1: "Tank",
    2: "Support",
    3: "Marksman",
    4: "Mage",
    5: "Fighter",
    6: "Assassin",
  };
  const inputs = game(1, 450).participants.map((p, i) => ({
    ...p,
    ...p.stats,
    kills: 2 + i,
    assists: 3 + i,
    deaths: i % 4,
    doubleKills: 1,
    tripleKills: 0,
    quadraKills: 0,
    pentaKills: 0,
    totalHeal: i * 1000,
    totalDamageDealtToChampions: 2000 + i * 2500,
  }));
  const mayhem = computeMatchScores(inputs, classes, 2400);
  const aram = computeMatchScoreBreakdowns(inputs, classes, 450);
  const compact = computeMatchScores(inputs, classes, 450);
  assert.deepEqual(computeMatchScores(inputs, classes, 2450), mayhem);
  assert.deepEqual(computeMatchScores(inputs, classes, 2400), mayhem, "no shared weight mutation");
  for (const [id, b] of aram) {
    assert.ok(Number.isFinite(b.score) && b.score >= 1 && b.score <= 10);
    assert.ok(Math.abs(b.raw - mayhem.get(id).raw) <= 0.31200000001);
    const sum =
      b.components.reduce((s, c) => s + c.points, 0) +
      (b.multikill?.points ?? 0) +
      (b.carry?.points ?? 0) +
      b.win;
    assert.ok(Math.abs(b.raw - sum) < 1e-12);
    assert.deepEqual(compact.get(id), { score: b.score, raw: b.raw, badge: b.badge });
    if (id >= 4) assert.deepEqual(compact.get(id).score, mayhem.get(id).score);
  }
  assert.deepEqual(
    computeMatchScores(inputs, undefined, 450),
    computeMatchScores(inputs, undefined, 2400),
  );
  assert.equal(computeMatchScores([], classes, 450).size, 0);
  const perfect = inputs.map((p) => ({
    ...p,
    kills: 50,
    assists: 500,
    deaths: 0,
    totalDamageDealtToChampions: 10000,
    totalDamageTaken: 10000,
    totalHeal: 10000,
    goldEarned: 10000,
    pentaKills: 1,
  }));
  for (const score of computeMatchScores(perfect, classes, 450).values())
    assert.equal(score.score, 10);
});
