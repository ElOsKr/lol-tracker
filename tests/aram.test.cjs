const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "riftally-aram-test-"));
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
      getChampionClasses: () => ({}),
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
    sql.prepare("INSERT INTO ignored_games (game_id) VALUES (?)").run(1);
    db.setSetting(`backfill_complete_${account}`, "1");
    assert.equal(db.getKnownGameIds().has(1), false);
    assert.equal(db.isGameKnown(1), false);
    history = [game(1, 450), game(2, 2400, false), game(3, 2450), game(4, 420), game(5, 1090)];
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
    assert.equal(db.insertGameFull(game(6, 1700), account), false);
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
    assert.equal(db.getMatchDetail(1).stats.score, null);
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
    assert.throws(() => db.setSetting("selected_queue", "420"), /Invalid queue/);
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
    db.checkScoreBackfill();
    assert.equal(db.getMatchDetail(1).stats.score, null);
    const file = path.join(directory, "export.json");
    await db.writeExportTo(file);
    const exported = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(exported.games.length, 5);
    assert.equal(db.importData(exported), 0);
    db.repairPuuids();
    assert.equal(db.getMatchDetail(1).stats.score, null);
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
    history = Array.from({ length: 20 }, (_, index) => game(100 + index, 420));
    const summoner = { puuid: account, gameName: "Fixture", tagLine: "TEST" };
    assert.equal((await lcu.fetchNewGames(null, summoner)).rolledOver, true);
    assert.equal((await lcu.fetchNewGames(null, summoner)).rolledOver, false);
    assert.equal((await lcu.syncRecentGames(null, summoner)).newGames, 0);
    db.closeDatabase();
    db.initDatabase();
    assert.equal(db.selectedQueue(), 2400);
    assert.equal(db.getSetting("widget_queue"), "450");
    assert.equal(db.getDatabase().pragma("integrity_check", { simple: true }), "ok");
  } finally {
    db.closeDatabase();
    Module._load = load;
    // Directory is an explicit fresh temporary directory created by this test.
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
