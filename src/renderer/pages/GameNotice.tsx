import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useIpc } from "../hooks/useIpc";
import { useChampionData, getChampionName } from "../hooks/useChampions";
import type { GameNotice as Notice } from "../lib/types";
import ChampionIcon from "../components/ChampionIcon";
import Kda from "../components/Kda";
import { XIcon } from "../components/icons";
import { scoreColor } from "../lib/format";
import { useT } from "../lib/i18n";
import { NOTICE_DURATION_MS } from "../../shared/notice";

// How often the countdown bar is redrawn. Fine enough to look continuous,
// coarse enough to cost nothing.
const TICK_MS = 100;

/**
 * The card that appears in the corner of the screen when a game has just been
 * stored, in a window of its own outside the app's layout.
 *
 * The widget draws the same thing in its own way when it is open; this page is
 * what runs when it isn't.
 */
export default function GameNotice() {
  const { gameId } = useParams();
  const id = Number(gameId);
  const t = useT();
  const champData = useChampionData();
  const { data: notice } = useIpc<Notice | null>(() => window.api.getGameNotice(id), [id]);

  // The window is transparent so the card can have rounded corners; the app's
  // own page background would fill them in.
  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = "transparent";
    return () => {
      document.body.style.background = previous;
    };
  }, []);

  const [paused, setPaused] = useState(false);
  const [percent, setPercent] = useState(100);
  // Kept in a ref so pausing and resuming doesn't restart the countdown, and
  // doesn't re-run the effect on every tick either.
  const remaining = useRef(NOTICE_DURATION_MS);

  useEffect(() => {
    if (!notice || paused) return;
    const startedAt = Date.now();
    const from = remaining.current;
    const timer = setInterval(() => {
      const left = from - (Date.now() - startedAt);
      setPercent(Math.max(0, (left / NOTICE_DURATION_MS) * 100));
      if (left <= 0) {
        clearInterval(timer);
        void window.api.dismissNotice();
      }
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      remaining.current = Math.max(0, from - (Date.now() - startedAt));
    };
  }, [notice, paused]);

  // Nothing to draw until the data lands. The window is transparent, so this
  // is genuinely invisible rather than an empty box.
  if (!notice) return null;

  const win = notice.win;
  const accent = win ? "bg-lol-win" : "bg-lol-loss";
  const tint = win
    ? "from-lol-win/[0.14] via-lol-win/[0.02]"
    : "from-lol-loss/[0.13] via-lol-loss/[0.02]";

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex h-[132px] w-[360px] flex-col overflow-hidden rounded-xl border border-[#2c3550] bg-lol-card shadow-[0_12px_32px_rgba(0,0,0,.55)]"
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${accent}`} />
      <span
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tint} to-transparent`}
      />

      {/* The card as a whole opens the game; the close button sits above it */}
      <button
        type="button"
        onClick={() => void window.api.openNoticeRecap()}
        title={t("notice.openRecap")}
        className="relative flex flex-1 cursor-pointer flex-col items-stretch bg-transparent pt-3 pl-[14px] text-left"
      >
        <div className="flex items-start gap-2.5 pr-11">
          <ChampionIcon
            championId={notice.championId}
            size={40}
            className={`shrink-0 border-2 ${win ? "border-lol-win/55" : "border-lol-loss/45"}`}
          />
          <div className="flex min-w-0 flex-grow flex-col gap-0.5">
            <span
              className={`text-sm font-bold uppercase tracking-[0.04em] ${win ? "text-lol-win" : "text-lol-loss"}`}
            >
              {win ? t("common.victory") : t("common.defeat")}
            </span>
            <span className="truncate text-[13px] text-lol-text-bright">
              {getChampionName(champData, notice.championId)}
              <span className="mx-1.5 text-lol-text/55">·</span>
              <span className="tabular-nums">
                <Kda kills={notice.kills} deaths={notice.deaths} assists={notice.assists} />
              </span>
            </span>
          </div>
          {notice.score != null && (
            <div className="flex shrink-0 flex-col items-end gap-[3px]">
              <span
                className={`text-[22px] font-bold leading-none tabular-nums ${scoreColor(notice.score)}`}
              >
                {notice.score.toFixed(1)}
                <span className="text-xs font-medium text-lol-text"> / 10</span>
              </span>
              {notice.scoreBadge ? (
                <span
                  className={`rounded px-1.5 text-[9px] font-bold ${
                    notice.scoreBadge === "MVP"
                      ? "bg-amber-400/20 text-amber-300"
                      : "bg-purple-500/20 text-purple-400"
                  }`}
                >
                  {notice.scoreBadge}
                </span>
              ) : (
                <span className="text-[9px] uppercase tracking-[0.06em] text-lol-text/80">
                  {t("history.score")}
                </span>
              )}
            </div>
          )}
        </div>

        {notice.highlight && (
          <div className="mt-2.5 truncate pr-3 text-xs text-lol-text">{notice.highlight}</div>
        )}
      </button>

      <button
        type="button"
        onClick={() => void window.api.dismissNotice()}
        title={t("notice.close")}
        aria-label={t("notice.close")}
        className="absolute top-2.5 right-2.5 flex h-[22px] w-[22px] items-center justify-center rounded-md text-lol-text transition-colors hover:bg-white/10 hover:text-lol-text-bright"
      >
        <XIcon className="h-3 w-3" />
      </button>

      {/* What is left of the countdown */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-lol-border/80">
        <div
          className={`h-full ${win ? "bg-lol-win/75" : "bg-lol-loss/70"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
