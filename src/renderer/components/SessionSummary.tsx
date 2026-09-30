import { Link } from "react-router-dom";
import { useMemo } from "react";
import type { HomeSession, HomeSessionGame } from "../lib/types";
import { buildSessionVerdict } from "../../shared/verdict";
import { LOCALE, formatPlaytime, kdaRatio, scoreColor } from "../lib/format";
import { gamesLabel, useT, type Translate } from "../lib/i18n";
import ChampionIcon from "./ChampionIcon";
import { getChampionName, useChampionData } from "../hooks/useChampions";
import { ScoreBadge } from "./ScoreCell";

const DAY_MS = 24 * 60 * 60 * 1000;

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

// "Last night" while it is, then the weekday, and how long ago underneath —
// a session is worth summarising even if the app went unopened for a week.
function heading(t: Translate, day: number, now: number): { title: string; ago: string | null } {
  const days = Math.round((startOfDay(now) - day) / DAY_MS);
  if (days <= 1) return { title: t("session.title"), ago: null };
  const label = new Date(day).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return {
    title: t("session.titleDay", { day: label }),
    ago: t("session.daysAgo", { days }),
  };
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function bestAndWorst(
  played: HomeSessionGame[],
): { best: HomeSessionGame; worst: HomeSessionGame } | null {
  const scored = played.filter((g) => g.score != null);
  if (scored.length < 2) return null;
  let best = scored[0];
  let worst = scored[0];
  for (const g of scored) {
    if (g.score! > best.score!) best = g;
    if (g.score! < worst.score!) worst = g;
  }
  return best === worst ? null : { best, worst };
}

/**
 * The night before, summarised once.
 *
 * What it adds over the "last session" card, which stays as it is: the shape
 * of the night game by game, the best and worst of it, and a sentence or two.
 * The card keeps repeating the bare record, which is what is still wanted
 * after this has been closed.
 */
export default function SessionSummary({
  session,
  now,
  onDismiss,
}: {
  session: HomeSession;
  now: number;
  onDismiss: () => void;
}) {
  const t = useT();
  const champData = useChampionData();
  const lines = useMemo(() => buildSessionVerdict(session), [session]);
  const extremes = useMemo(() => bestAndWorst(session.played), [session.played]);
  const { title, ago } = heading(t, session.day, now);
  const delta =
    session.avgScore != null && session.careerAvgScore != null
      ? session.avgScore - session.careerAvgScore
      : null;

  return (
    <section className="rounded-xl border border-lol-border bg-lol-card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-grow">
          <h2 className="text-lg font-semibold tracking-tight text-lol-text-bright">{title}</h2>
          <div className="mt-0.5 text-xs text-lol-text">
            {ago && <span className="mr-1">{ago} ·</span>}
            {t("session.subtitle", {
              games: gamesLabel(t, session.games),
              playtime: formatPlaytime(session.duration),
              from: clock(session.startedAt),
              to: clock(session.endedAt),
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("session.dismiss")}
          title={t("session.dismiss")}
          className="shrink-0 rounded-lg border border-lol-border px-2 py-1 text-xs leading-none text-lol-text transition-colors hover:text-lol-text-bright"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-stretch gap-3">
        <Panel label={t("session.record")}>
          <div className="text-2xl font-bold tabular-nums tracking-tight">
            <span className="text-lol-win">{session.wins}</span>
            <span className="mx-1 text-lol-text/40">·</span>
            <span className="text-lol-loss">{session.losses}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-lol-text">
            {Math.round((session.wins / session.games) * 100)}% · KDA{" "}
            {kdaRatio(session.kills, session.deaths, session.assists)}
          </div>
        </Panel>

        {session.avgScore != null && (
          <Panel label={t("session.avgScore")}>
            <div
              className={`text-2xl font-bold tabular-nums tracking-tight ${scoreColor(session.avgScore)}`}
            >
              {session.avgScore.toFixed(2)}
            </div>
            {delta != null && session.careerAvgScore != null && (
              <div
                className={`mt-0.5 text-[11px] ${delta >= 0 ? "text-lol-win" : "text-lol-loss"}`}
              >
                {t("session.vsCareer", {
                  delta: `${Math.abs(delta).toFixed(2)} ${
                    delta >= 0 ? t("session.above") : t("session.below")
                  }`,
                  average: session.careerAvgScore.toFixed(2),
                })}
              </div>
            )}
          </Panel>
        )}

        {/* The night game by game, oldest first: its shape at a glance */}
        <div className="min-w-0 flex-grow rounded-lg border border-lol-border/60 bg-lol-dark/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-lol-text">
            {t("session.shape")}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-x-2.5 gap-y-2">
            {session.played.map((game) => (
              <Link
                key={game.gameId}
                to={`/?game=${game.gameId}`}
                className="flex flex-col items-center gap-1"
                title={game.score != null ? game.score.toFixed(1) : undefined}
              >
                <ChampionIcon
                  championId={game.championId}
                  size={32}
                  className={`rounded-full ring-2 ${game.win ? "ring-lol-win" : "ring-lol-loss"}`}
                />
                {game.scoreBadge ? (
                  <ScoreBadge badge={game.scoreBadge} />
                ) : (
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      game.score != null ? scoreColor(game.score) : "text-lol-text/50"
                    }`}
                  >
                    {game.score != null ? game.score.toFixed(1) : "–"}
                  </span>
                )}
              </Link>
            ))}
            {extremes && (
              <div className="ml-auto text-right text-[11px] leading-relaxed text-lol-text">
                <div>
                  <span className="mr-1">{t("session.bestLabel")}</span>
                  <Link
                    to={`/?game=${extremes.best.gameId}`}
                    className="font-semibold text-lol-gold hover:text-lol-gold-light"
                  >
                    {getChampionName(champData, extremes.best.championId)}{" "}
                    {extremes.best.score!.toFixed(1)}
                  </Link>
                </div>
                <div>
                  <span className="mr-1">{t("session.worstLabel")}</span>
                  <Link
                    to={`/?game=${extremes.worst.gameId}`}
                    className="hover:text-lol-text-bright"
                  >
                    {getChampionName(champData, extremes.worst.championId)}{" "}
                    {extremes.worst.score!.toFixed(1)}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {lines.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {lines.map((line) => (
            <li key={line.key} className="flex gap-2 text-sm text-lol-text-bright">
              <span aria-hidden className="text-lol-gold/60">
                ·
              </span>
              <span>{t(line.key, line.vars)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 rounded-lg border border-lol-border/60 bg-lol-dark/40 px-4 py-2">
      <div className="text-[10px] uppercase tracking-wider text-lol-text">{label}</div>
      {children}
    </div>
  );
}
