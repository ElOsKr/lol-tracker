import { useEffect, useState } from "react";
import type { LiveGameSnapshot } from "../lib/types";

export interface LiveGameState {
  // Null until the first answer arrives, which is what tells the page apart
  // from one that has looked and found no game
  snapshot: LiveGameSnapshot | null;
  // When the snapshot landed, so the game clock can keep running between polls
  receivedAt: number;
}

/**
 * The current match, as the main process sees it.
 *
 * One pull on mount covers the tab being opened mid-match, and after that the
 * main process pushes: it polls for exactly as long as a game runs, so there is
 * no timer here to leave running.
 *
 * The client status is the other thing worth asking again on. A pull made
 * before the client had been found comes back empty and nothing would push
 * afterwards, which is exactly the case of launching the app into a game
 * already in progress.
 */
export function useLiveGame(): LiveGameState {
  const [state, setState] = useState<LiveGameState>({ snapshot: null, receivedAt: 0 });

  useEffect(() => {
    let active = true;
    const apply = (snapshot: LiveGameSnapshot) => {
      if (active) setState({ snapshot, receivedAt: Date.now() });
    };
    const pull = () => window.api.getLiveGame().then(apply);

    pull();
    const unsubLive = window.api.onLiveGame(apply);
    const unsubStatus = window.api.onStatusChanged(pull);
    return () => {
      active = false;
      unsubLive();
      unsubStatus();
    };
  }, []);

  return state;
}
