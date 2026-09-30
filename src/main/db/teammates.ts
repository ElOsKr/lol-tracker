import type { TeammateStats, TeammateDetail, MatchListItem, TeammateMatch } from "../../shared/api";
import { computeMatchScores } from "../../shared/opScore";
import { hasScore } from "../../shared/queues";
import { getChampionClasses } from "../dragon";
import { db } from "./connection";
import { applyQueueFilter } from "./filters";
import { MATCH_ROW_SQL } from "./matches";
import { groupByGame, SCORE_ROW_COLUMNS, type ScoreRow, scoreInputsFromRows } from "./scoring";
import { displayName, getAllPuuids } from "./summoner";

// Someone we queued with once is a stranger, not a friend — the list only
// counts players we've shared at least this many games with.
export const MIN_SHARED_GAMES = 2;

// The id the Friends list keys a teammate on — puuid when we know it, so name
// changes don't split a player in two.
function teammateKey(puuid: string | null, name: string): string {
  return puuid || name;
}

function teammateName(gameName: string | null, tagLine: string | null, participantId: number) {
  return displayName(gameName, tagLine) ?? `Player ${participantId}`;
}

interface TeammateRow {
  game_id: number;
  game_creation: number;
  participant_id: number;
  puuid: string | null;
  game_name: string | null;
  tag_line: string | null;
  profile_icon: number | null;
  champion_id: number;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
}

// Every participant who shared a team with one of our accounts, one row per
// player per game.
//
// Which (game, team) pairs are ours is resolved up front in a CTE rather than
// as an EXISTS against each candidate row: the CTE is a single indexed lookup
// per account, where the correlated form makes SQLite build a throwaway index
// on every call. DISTINCT is what keeps the row count honest when two of our
// own accounts played the same game on the same side.
function teammateRows(puuids: string[]): TeammateRow[] {
  const ours = puuids.map(() => "?").join(", ");
  const where = ["o.is_remake = 0", `(o.puuid IS NULL OR o.puuid NOT IN (${ours}))`];
  const params: any[] = [...puuids];
  applyQueueFilter(where, params, undefined, "o");

  return db
    .prepare(`
      WITH our_teams AS (
        SELECT DISTINCT game_id, team_id FROM match_participants WHERE puuid IN (${ours})
      )
      SELECT o.game_id, g.game_creation, o.participant_id, o.puuid, o.game_name, o.tag_line,
             o.profile_icon, o.champion_id, o.win, o.kills, o.deaths, o.assists
      FROM our_teams t
      JOIN match_participants o ON o.game_id = t.game_id AND o.team_id = t.team_id
      JOIN games g ON g.game_id = o.game_id
      WHERE ${where.join(" AND ")}
      ORDER BY g.game_creation DESC
    `)
    .all(...puuids, ...params) as TeammateRow[];
}

// Our own games and wins under the same queue filter the teammate rows use.
// Subtracting a teammate's shared games from this is what answers "how do you
// do without them", which is the one thing here that cannot be read off the
// page already.
export function ownRecord(): { games: number; wins: number } {
  const where = ["g.is_remake = 0"];
  const params: any[] = [];
  applyQueueFilter(where, params, undefined, "g");
  const row = db
    .prepare(`
      SELECT COUNT(*) games, COALESCE(SUM(ps.win), 0) wins
      FROM player_stats ps
      JOIN games g ON g.game_id = ps.game_id
      WHERE ${where.join(" AND ")}
    `)
    .get(...params) as { games: number; wins: number };
  return row;
}

export function getTeammateStats(): TeammateStats[] {
  const puuids = getAllPuuids();
  if (puuids.length === 0) return [];

  const playerMap = new Map<
    string,
    {
      name: string;
      puuid: string | null;
      profileIcon: number | null;
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      champions: Map<number, number>;
      lastPlayed: number;
      firstPlayed: number;
      // Rows arrive newest first, so the streak is still open while every row
      // seen so far has the same result as the first.
      streakWin: boolean | null;
      streakLength: number;
      streakOpen: boolean;
    }
  >();

  for (const row of teammateRows(puuids)) {
    const name = teammateName(row.game_name, row.tag_line, row.participant_id);
    const key = teammateKey(row.puuid, name);

    // If we now have a puuid but previously tracked this player by name, merge
    if (row.puuid && !playerMap.has(row.puuid) && playerMap.has(name)) {
      const old = playerMap.get(name)!;
      if (!old.puuid) {
        playerMap.set(row.puuid, old);
        old.puuid = row.puuid;
        playerMap.delete(name);
      }
    }

    if (!playerMap.has(key)) {
      playerMap.set(key, {
        name,
        puuid: row.puuid,
        profileIcon: null,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        champions: new Map(),
        lastPlayed: 0,
        firstPlayed: Number.POSITIVE_INFINITY,
        streakWin: null,
        streakLength: 0,
        streakOpen: true,
      });
    }

    const entry = playerMap.get(key)!;
    // Update name and icon to the most recent version
    if (row.game_creation > entry.lastPlayed) {
      entry.name = name;
      if (row.profile_icon != null) entry.profileIcon = row.profile_icon;
    }
    entry.games++;
    if (row.win) entry.wins++;
    entry.kills += row.kills;
    entry.deaths += row.deaths;
    entry.assists += row.assists;
    entry.lastPlayed = Math.max(entry.lastPlayed, row.game_creation);
    entry.firstPlayed = Math.min(entry.firstPlayed, row.game_creation);
    if (entry.streakOpen) {
      const win = row.win === 1;
      if (entry.streakWin === null) entry.streakWin = win;
      if (entry.streakWin === win) entry.streakLength++;
      else entry.streakOpen = false;
    }
    entry.champions.set(row.champion_id, (entry.champions.get(row.champion_id) || 0) + 1);
  }

  const own = ownRecord();
  return Array.from(playerMap.entries())
    .filter(([, p]) => p.games >= MIN_SHARED_GAMES)
    .map(([key, p]) => ({
      key,
      name: p.name,
      puuid: p.puuid,
      profileIcon: p.profileIcon,
      games: p.games,
      wins: p.wins,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      // Champion id breaks ties so the same five champions come back in the
      // same order every time, rather than in whatever order the rows arrived.
      champions: Array.from(p.champions.entries())
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, 5)
        .map(([champion_id, games]) => ({ champion_id, games })),
      lastPlayed: p.lastPlayed,
      firstPlayed: Number.isFinite(p.firstPlayed) ? p.firstPlayed : p.lastPlayed,
      streak: p.streakWin === null ? null : { win: p.streakWin, length: p.streakLength },
      withoutGames: Math.max(0, own.games - p.games),
      withoutWins: Math.max(0, own.wins - p.wins),
    }))
    .sort((a, b) => b.games - a.games);
}

// Every game we played alongside one teammate, from both sides: our stored
// stats for the row plus the teammate's own line in that game.
export function getTeammateDetail(key: string): TeammateDetail | null {
  const puuids = getAllPuuids();
  if (puuids.length === 0) return null;

  // Rows are newest-first, so the first hit carries the current name and icon.
  // Older games can be missing puuids; once we know who we're looking at, match
  // those on name too — the same merge the Friends list does.
  const theirs: TeammateRow[] = [];
  let name: string | null = null;
  for (const row of teammateRows(puuids)) {
    const rowName = teammateName(row.game_name, row.tag_line, row.participant_id);
    if (teammateKey(row.puuid, rowName) === key) {
      name ??= rowName;
      theirs.push(row);
    } else if (name != null && row.puuid == null && rowName === name) {
      theirs.push(row);
    }
  }
  if (theirs.length === 0) return null;

  const byGame = new Map(theirs.map((row) => [row.game_id, row]));
  const gameIds = Array.from(byGame.keys());
  const idList = gameIds.map(() => "?").join(", ");

  // Our own row for each shared game — the same columns the match list shows.
  const ourMatches = db
    .prepare(`
      SELECT ${MATCH_ROW_SQL}
      FROM games g
      JOIN player_stats ps ON g.game_id = ps.game_id
      WHERE g.game_id IN (${idList})
      ORDER BY g.game_creation DESC
    `)
    .all(...gameIds) as MatchListItem[];

  // The teammate's score has to be computed rather than looked up — player_stats
  // only ever scores our own row — so each shared game needs all ten players.
  const scoreRows = groupByGame(
    db
      .prepare(
        `SELECT game_id, ${SCORE_ROW_COLUMNS} FROM match_participants WHERE game_id IN (${idList})`,
      )
      .all(...gameIds) as (ScoreRow & { game_id: number })[],
  );

  interface ChampionTotals {
    games: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
  }

  const matches: TeammateMatch[] = [];
  const champions = new Map<number, ChampionTotals>();
  const first = theirs[0];
  const player = {
    key,
    name: name ?? key,
    puuid: first.puuid,
    profileIcon: first.profile_icon,
    games: 0,
    wins: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    champions: [] as ({ champion_id: number } & ChampionTotals)[],
    lastPlayed: first.game_creation,
    firstPlayed: first.game_creation,
    streak: null as { win: boolean; length: number } | null,
    withoutGames: 0,
    withoutWins: 0,
    betterScore: null as { better: number; scored: number } | null,
  };

  // Gathered as we go and worked out below, so the order the rows arrive in
  // cannot change the answer.
  const shared: { creation: number; win: boolean }[] = [];
  let better = 0;
  let scored = 0;

  for (const row of ourMatches) {
    const friend = byGame.get(row.game_id);
    if (!friend) continue;

    if (player.profileIcon == null) player.profileIcon = friend.profile_icon;

    player.games++;
    if (friend.win) player.wins++;
    player.kills += friend.kills;
    player.deaths += friend.deaths;
    player.assists += friend.assists;

    if (!champions.has(friend.champion_id)) {
      champions.set(friend.champion_id, { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 });
    }
    const champ = champions.get(friend.champion_id)!;
    champ.games++;
    if (friend.win) champ.wins++;
    champ.kills += friend.kills;
    champ.deaths += friend.deaths;
    champ.assists += friend.assists;

    const gameRows = scoreRows.get(row.game_id) ?? [];
    const friendScore = !hasScore(row.queue_id)
      ? undefined
      : computeMatchScores(scoreInputsFromRows(gameRows), getChampionClasses(), row.queue_id).get(
          friend.participant_id,
        );
    const friendStats = gameRows.find((p) => p.participant_id === friend.participant_id);

    matches.push({
      ...row,
      friend: {
        champion_id: friend.champion_id,
        win: friend.win,
        kills: friend.kills,
        deaths: friend.deaths,
        assists: friend.assists,
        total_damage_dealt: friendStats?.total_damage_dealt ?? 0,
        total_damage_taken: friendStats?.total_damage_taken ?? 0,
        total_heal: friendStats?.total_heal ?? 0,
        score: friendScore?.score ?? null,
        score_badge: friendScore?.badge ?? null,
      },
    });

    shared.push({ creation: row.game_creation, win: friend.win === 1 });
    if (friendScore?.score != null && row.score != null) {
      scored++;
      if (friendScore.score > row.score) better++;
    }
  }

  if (player.games === 0) return null;

  shared.sort((a, b) => b.creation - a.creation);
  if (shared.length > 0) {
    player.firstPlayed = shared[shared.length - 1].creation;
    player.lastPlayed = shared[0].creation;
    const win = shared[0].win;
    let length = 0;
    for (const g of shared) {
      if (g.win !== win) break;
      length++;
    }
    player.streak = { win, length };
  }
  const own = ownRecord();
  player.withoutGames = Math.max(0, own.games - player.games);
  player.withoutWins = Math.max(0, own.wins - player.wins);
  player.betterScore = scored > 0 ? { better, scored } : null;
  player.champions = Array.from(champions.entries())
    .map(([champion_id, totals]) => ({ champion_id, ...totals }))
    .sort((a, b) => b.games - a.games);

  return { player, matches };
}
