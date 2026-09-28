// The end-of-game notice: the small card that appears when a game has just
// been stored, either inside the desktop widget or, when that is closed, in a
// window of its own in the corner of the screen.

// The renderer route the corner window loads, outside the app's layout the way
// the game card's is: it has no sidebar and no title bar.
export const NOTICE_ROUTE = "/notice";

export const noticeRoute = (gameId: number) => `${NOTICE_ROUTE}/${gameId}`;

// Off turns the notice off everywhere. The OBS key is separate and off by
// default: the widget's page is also what OBS shows, so a notice drawn in it
// would otherwise go out on stream without anyone choosing that.
export const GAME_NOTICE_SETTING = "game_notice";
export const GAME_NOTICE_OBS_SETTING = "game_notice_obs";

// How long the card stays up. The countdown pauses while the pointer is over
// it, so this is the shortest it can live, not the longest.
export const NOTICE_DURATION_MS = 10_000;

// A notice older than this is stale: the widget polls every few seconds, and
// one that has been waiting longer than this belongs to a game the player has
// long since moved on from.
export const NOTICE_MAX_AGE_MS = 30_000;

// How late a capture can be and still be worth announcing. The end-of-game
// chain retries for a couple of minutes, and a card about a game that ended
// long enough ago to be in champion select by now is an interruption.
export const NOTICE_MAX_DELAY_MS = 5 * 60_000;

export interface GameNotice {
  gameId: number;
  queueId: number;
  win: boolean;
  championId: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number | null;
  scoreBadge: "MVP" | "ACE" | null;
  // One line about what this game meant, already worded in the app's language.
  // The main process words it: both surfaces that draw a notice only print it.
  highlight: string | null;
  // When the notice was raised, so a surface can refuse a stale one
  raisedAt: number;
}

// The dictionary keys the highlight can use, with the parameters each needs.
// Ranks stop at three: a fourth-best score is not news, and three keys avoid
// having to build ordinals in two languages.
export type NoticeHighlightKey =
  | "notice.bestScore"
  | "notice.secondBest"
  | "notice.thirdBest"
  | "notice.streakWins"
  | "notice.streakLosses"
  | "notice.session";

export interface NoticeHighlight {
  key: NoticeHighlightKey;
  params: Record<string, string | number>;
}

const RANK_KEYS: NoticeHighlightKey[] = [
  "notice.bestScore",
  "notice.secondBest",
  "notice.thirdBest",
];

/**
 * The one thing worth saying about a game, or nothing.
 *
 * Ordered by how much it says: a score among your best three is news, a run of
 * three or more is worth knowing, and failing both the day's tally at least
 * puts the game in context. A game that is none of those leaves the line out
 * rather than padding it.
 */
export function chooseHighlight(input: {
  // Where this game's score ranks all-time in its queue, 1 being the best
  scoreRank: number | null;
  streak: { kind: "win" | "loss"; length: number } | null;
  session: { wins: number; losses: number } | null;
  queueLabel: string;
}): NoticeHighlight | null {
  const { scoreRank, streak, session, queueLabel } = input;

  if (scoreRank != null && scoreRank >= 1 && scoreRank <= RANK_KEYS.length) {
    return { key: RANK_KEYS[scoreRank - 1], params: { queue: queueLabel } };
  }

  if (streak && streak.length >= 3) {
    return {
      key: streak.kind === "win" ? "notice.streakWins" : "notice.streakLosses",
      params: { count: streak.length },
    };
  }

  if (session && session.wins + session.losses >= 2) {
    return {
      key: "notice.session",
      params: { wins: session.wins, losses: session.losses, queue: queueLabel },
    };
  }

  return null;
}
