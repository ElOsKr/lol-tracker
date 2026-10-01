// La página de inicio: racha, última sesión y mejor campeón del mes.
//
// Parte del contrato IPC: todo lo de aquí cruza el puente.

// One of the last games played, as the home page lists them: enough to read
// the result and open the history, nothing a full row carries.
export interface HomeRecentGame {
  game_id: number;
  game_creation: number;
  game_duration: number;
  champion_id: number;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number | null;
  score_badge: "MVP" | "ACE" | null;
}

export interface HomeStreak {
  kind: "win" | "loss";
  length: number;
  // Longest streak of the same kind on record
  best: number;
}

// The most recent day of play, under the same "day starts at 5am" rule the
// match list groups by.
export interface HomeSession {
  day: number;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  avgScore: number | null;
  // Seconds of game time
  duration: number;
  // Every game of the session, oldest first. The card ignores these; the
  // panel draws the night's shape from them.
  played: HomeSessionGame[];
  // When the first started and the last ended, for "from 21:08 to 23:01"
  startedAt: number;
  endedAt: number;
  // False while the session is still today: a night is not summarised until
  // it is over, and the day of play ends at 5am, not at midnight.
  finished: boolean;
  // The player's usual score, so the session average can be placed against
  // something. Null in queues that carry no score.
  careerAvgScore: number | null;
  // Days back to the last session with more games than this one, or null if
  // there has never been a longer one. Only for saying "your longest night
  // in three weeks" and nothing else.
  longerAgoDays: number | null;
}

export interface HomeSessionGame {
  gameId: number;
  championId: number;
  win: boolean;
  score: number | null;
  scoreBadge: "MVP" | "ACE" | null;
  gameCreation: number;
  gameDuration: number;
}

export interface HomeChampion {
  championId: number;
  games: number;
  wins: number;
  avgScore: number | null;
  // What put this champion first: the average score where the queue has one,
  // otherwise the win rate
  rankedBy: "score" | "winRate";
}

// What the home page shows for the selected queue. Everything is computed from
// the player's own games, so a queue with none leaves every card empty.
export interface HomeSummary {
  totalGames: number;
  lastGameAt: number | null;
  streak: HomeStreak | null;
  // Results of the last games, oldest first, 1 for a win
  recentResults: number[];
  session: HomeSession | null;
  bestChampion: HomeChampion | null;
  // How many days back the best champion is picked from
  championWindowDays: number;
  // Games played inside that window
  windowGames: number;
  recentGames: HomeRecentGame[];
}

// ---- Live game ----
