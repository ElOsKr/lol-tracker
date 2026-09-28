import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, PageLoading } from "../components/PageState";
import { Link } from "react-router-dom";
import { useIpc } from "../hooks/useIpc";
import { useQueueSelection } from "../hooks/useQueueSelection";
import { useLcuStatus } from "../hooks/useLcuStatus";
import { useChampionData, getChampionName } from "../hooks/useChampions";
import type {
  ChallengeProgress,
  ChallengesResult,
  HomeRecentGame,
  HomeSummary,
} from "../lib/types";
import ChampionIcon from "../components/ChampionIcon";
import ChallengeToken from "../components/ChallengeToken";
import Kda from "../components/Kda";
import ScoreCell from "../components/ScoreCell";
import WinRateBar from "../components/WinRateBar";
import { ACCENTS, type StatAccent } from "../components/StatCard";
import { queueLabel } from "../components/QueueSelect";
import {
  AwardIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TrophyIcon,
} from "../components/icons";
import {
  LOCALE,
  formatDuration,
  formatPlaytime,
  formatTimeAgo,
  kdaRatio,
  scoreColor,
} from "../lib/format";
import { gamesLabel, useT, type Translate } from "../lib/i18n";
import {
  CHALLENGE_LEVEL_COLORS,
  challengeLevelName,
  formatChallengeValue,
} from "../lib/challenges";
import { challengeFraction } from "../../shared/challenges";
import { sessionDay } from "../../shared/session";

const DAY_MS = 24 * 60 * 60 * 1000;

// "Today" and "yesterday" as a day of play counts them: a session that ran
// past midnight is still today's until the morning.
function sessionLabel(t: Translate, day: number): string {
  const today = sessionDay(Date.now());
  if (day === today) return t("home.today");
  if (today - day === DAY_MS) return t("home.yesterday");
  return new Date(day).toLocaleDateString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// The challenge closest to its next tier: the goal that a game or two could
// actually reach. Group nodes only move through their leaves, and a retired
// one can't move at all, so neither is a goal.
function nextGoal(result: ChallengesResult | null): ChallengeProgress | null {
  const data = result?.data;
  if (!data) return null;
  const candidates = [...data.groups.flatMap((g) => g.challenges), ...data.seasonal].filter(
    (c) => !c.retired && c.nextThreshold != null,
  );
  let best: ChallengeProgress | null = null;
  let bestFraction = -1;
  for (const c of candidates) {
    const fraction = challengeFraction(c.value, c.currentThreshold, c.nextThreshold);
    if (fraction > bestFraction) {
      best = c;
      bestFraction = fraction;
    }
  }
  return best;
}

// The same tile as a stat card, but a link: every card opens the page that
// tells the rest of its story.
function HomeCard({
  to,
  title,
  label,
  icon,
  accent,
  children,
}: {
  to: string;
  title: string;
  label: string;
  icon: ReactNode;
  accent: StatAccent;
  children: ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <Link
      to={to}
      title={title}
      className="relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border border-lol-border/60 bg-lol-card p-4 transition-colors hover:border-lol-gold/40 hover:bg-lol-card-hover"
    >
      <span
        className={`pointer-events-none absolute -top-14 -right-8 h-32 w-32 rounded-full blur-2xl ${a.glow}`}
      />
      <div className="relative flex items-center gap-1.5">
        <span className={`flex h-5 w-5 items-center justify-center rounded-md ${a.chip}`}>
          {icon}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-lol-text">{label}</span>
      </div>
      {children}
    </Link>
  );
}

function StreakCard({ summary }: { summary: HomeSummary }) {
  const t = useT();
  const streak = summary.streak!;
  const win = streak.kind === "win";
  const key =
    streak.length === 1
      ? win
        ? "recap.streakWin"
        : "recap.streakLoss"
      : win
        ? "recap.streakWins"
        : "recap.streakLosses";
  const last = summary.recentResults.length - 1;
  return (
    <HomeCard
      to="/"
      title={t("home.openHistory")}
      label={t("home.streak")}
      icon={win ? <TrendingUpIcon className="w-3 h-3" /> : <TrendingDownIcon className="w-3 h-3" />}
      accent={win ? "win" : "gold"}
    >
      <div
        className={`relative text-2xl font-bold leading-tight ${win ? "text-lol-win" : "text-lol-loss"}`}
      >
        {t(key, { count: streak.length })}
      </div>
      <div className="relative text-xs text-lol-text">
        {t("home.bestStreak", { count: streak.best })}
      </div>
      <div
        className="relative mt-auto flex gap-[3px] pt-1.5"
        title={t("home.lastResults", { count: summary.recentResults.length })}
      >
        {summary.recentResults.map((result, i) => (
          <span
            key={i}
            className={`h-4 w-[5px] rounded-full ${result ? "bg-lol-win" : "bg-lol-loss/70"} ${
              i === last ? "outline outline-2 outline-offset-1 outline-lol-gold" : ""
            }`}
          />
        ))}
      </div>
    </HomeCard>
  );
}

function SessionCard({ summary }: { summary: HomeSummary }) {
  const t = useT();
  const session = summary.session!;
  const kda = kdaRatio(session.kills, session.deaths, session.assists);
  return (
    <HomeCard
      to="/"
      title={t("home.openHistory")}
      label={t("home.session")}
      icon={<TimerIcon className="w-3 h-3" />}
      accent="sky"
    >
      <div className="relative text-2xl font-bold leading-tight tabular-nums">
        <span className="text-lol-win">
          {session.wins}
          {t("common.w")}
        </span>{" "}
        <span className="text-lol-loss/75">
          {session.losses}
          {t("common.l")}
        </span>
      </div>
      <div className="relative text-xs text-lol-text">
        {sessionLabel(t, session.day)} · {gamesLabel(t, session.games)} ·{" "}
        {formatPlaytime(session.duration)}
      </div>
      <div className="relative mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-xs text-lol-text">
        <span>
          <span className="font-semibold tabular-nums text-lol-text-bright">{kda}</span> KDA
        </span>
        {session.avgScore != null && (
          <span>
            <span className={`font-semibold tabular-nums ${scoreColor(session.avgScore)}`}>
              {session.avgScore.toFixed(1)}
            </span>{" "}
            {t("recap.avgScore")}
          </span>
        )}
      </div>
    </HomeCard>
  );
}

function ChampionCard({ summary }: { summary: HomeSummary }) {
  const t = useT();
  const champData = useChampionData();
  const champion = summary.bestChampion;
  return (
    <HomeCard
      to="/champions"
      title={t("home.openChampions")}
      label={t("home.bestChampion")}
      icon={<TrophyIcon className="w-3 h-3" />}
      accent="gold"
    >
      {champion ? (
        <>
          <div className="relative flex items-center gap-2.5">
            <ChampionIcon
              championId={champion.championId}
              size={40}
              className="shrink-0 border-2 border-lol-gold/50"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-lg font-bold leading-tight text-lol-text-bright">
                {getChampionName(champData, champion.championId)}
              </span>
              <span className="text-xs text-lol-text">
                {champion.rankedBy === "score" && champion.avgScore != null ? (
                  <>
                    <span className={`font-semibold tabular-nums ${scoreColor(champion.avgScore)}`}>
                      {champion.avgScore.toFixed(1)}
                    </span>{" "}
                    {t("recap.avgScore")} ·{" "}
                  </>
                ) : null}
                {gamesLabel(t, champion.games)}
              </span>
            </div>
          </div>
          <div className="relative mt-auto pt-1.5">
            <WinRateBar wins={champion.wins} total={champion.games} />
          </div>
        </>
      ) : (
        <div className="relative text-sm text-lol-text">
          {t("home.noChampion", { days: summary.championWindowDays })}
        </div>
      )}
      <div className="relative text-[11px] text-lol-text/70">
        {t("home.windowNote", { days: summary.championWindowDays })}
      </div>
    </HomeCard>
  );
}

function GoalCard() {
  const t = useT();
  const status = useLcuStatus();
  const [result, setResult] = useState<ChallengesResult | null>(null);

  // Read whatever the last reading said right away; the live one, if the
  // client is up, replaces it when it lands.
  useEffect(() => {
    let active = true;
    window.api.getChallenges().then((stored) => {
      if (active) setResult(stored);
    });
    const unsub = window.api.onChallengesChanged((live) => {
      if (active) setResult(live);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [status]);

  const goal = useMemo(() => nextGoal(result), [result]);

  let body: ReactNode;
  if (goal) {
    const fraction = challengeFraction(goal.value, goal.currentThreshold, goal.nextThreshold);
    const color = CHALLENGE_LEVEL_COLORS[goal.nextLevel ?? goal.level];
    body = (
      <>
        <div className="relative flex items-center gap-2.5">
          <ChallengeToken iconPath={goal.iconPath} size={36} className="shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span
              className="truncate text-[15px] font-semibold leading-tight text-lol-text-bright"
              title={goal.description}
            >
              {goal.name}
            </span>
            <span className="text-xs text-lol-text">
              <span
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: CHALLENGE_LEVEL_COLORS[goal.level] }}
              >
                {challengeLevelName(goal.level)}
              </span>
              {" · "}
              {t("home.remaining", {
                value: formatChallengeValue(goal.nextThreshold! - goal.value),
                level: challengeLevelName(goal.nextLevel),
              })}
            </span>
          </div>
        </div>
        <div className="relative mt-auto flex flex-col gap-1 pt-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-lol-border/70">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${fraction * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-right text-xs tabular-nums text-lol-text">
            <span className="text-lol-text-bright">{formatChallengeValue(goal.value)}</span> /{" "}
            {formatChallengeValue(goal.nextThreshold!)}
          </span>
        </div>
      </>
    );
  } else if (result?.data) {
    body = <div className="relative text-sm text-lol-text">{t("home.goalMaxed")}</div>;
  } else if (result?.pending || result == null) {
    body = <div className="relative text-sm text-lol-text">{t("home.goalLoading")}</div>;
  } else {
    body = <div className="relative text-sm text-lol-text">{t("home.goalNoClient")}</div>;
  }

  return (
    <HomeCard
      to="/challenges"
      title={t("home.openChallenges")}
      label={t("home.goal")}
      icon={<AwardIcon className="w-3 h-3" />}
      accent="purple"
    >
      {body}
    </HomeCard>
  );
}

function RecentGameRow({ game }: { game: HomeRecentGame }) {
  const t = useT();
  const champData = useChampionData();
  const win = game.win === 1;
  return (
    <Link
      to="/"
      title={t("home.openHistory")}
      className="relative flex items-center gap-3 overflow-hidden rounded-lg border border-lol-border/60 bg-lol-card py-2 pl-4 pr-3 transition-colors hover:bg-lol-card-hover"
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${win ? "bg-lol-win" : "bg-lol-loss"}`} />
      <span
        className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${
          win ? "from-lol-win/12 to-lol-win/[0.04]" : "from-lol-loss/12 to-lol-loss/[0.04]"
        }`}
      />
      <span className={`w-8 shrink-0 text-xs font-bold ${win ? "text-lol-win" : "text-lol-loss"}`}>
        {win ? t("history.win") : t("history.loss")}
      </span>
      <ChampionIcon
        championId={game.champion_id}
        size={32}
        className="rounded-md"
        rounded={false}
      />
      <span className="w-20 shrink-0 truncate text-sm text-lol-text-bright @lg:w-24">
        {getChampionName(champData, game.champion_id)}
      </span>
      <span className="w-20 shrink-0 text-sm tabular-nums text-lol-text-bright @lg:w-24">
        <Kda kills={game.kills} deaths={game.deaths} assists={game.assists} />
      </span>
      <ScoreCell score={game.score} badge={game.score_badge} />
      <span className="ml-auto shrink-0 text-right text-xs leading-snug text-lol-text">
        <span className="hidden @lg:block">{formatDuration(game.game_duration)}</span>
        {formatTimeAgo(game.game_creation)}
      </span>
    </Link>
  );
}

export default function Home() {
  const t = useT();
  const [queue] = useQueueSelection();
  const { data: summary, refetch } = useIpc<HomeSummary>(
    () => window.api.getHomeSummary(queue),
    [queue],
  );
  useEffect(() => window.api.onGamesUpdated(refetch), [refetch]);

  if (!summary) return <PageLoading />;

  const hasGames = summary.totalGames > 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold text-lol-text-bright">{t("home.title")}</h1>
          <span className="text-[13px] text-lol-text">
            {t("home.subtitle", { queue: queueLabel(queue) })}
            {hasGames && ` · ${gamesLabel(t, summary.totalGames)}`}
          </span>
        </div>
        {summary.lastGameAt != null && (
          <span className="text-xs text-lol-text">
            {t("home.lastGame", { time: formatTimeAgo(summary.lastGameAt) })}
          </span>
        )}
      </div>

      {hasGames ? (
        <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @4xl:grid-cols-4">
          <StreakCard summary={summary} />
          <SessionCard summary={summary} />
          <ChampionCard summary={summary} />
          <GoalCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
          <EmptyState hint={t("home.emptyHint")}>{t("home.empty")}</EmptyState>
          <GoalCard />
        </div>
      )}

      {hasGames && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-lol-text-bright">{t("home.recentGames")}</h2>
            <Link to="/" className="text-xs text-lol-gold hover:text-lol-gold-light">
              {t("home.viewHistory")}
            </Link>
          </div>
          <div className="flex flex-col gap-1">
            {summary.recentGames.map((game) => (
              <RecentGameRow key={game.game_id} game={game} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
