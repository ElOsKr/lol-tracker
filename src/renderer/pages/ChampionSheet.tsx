import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useIpc } from "../hooks/useIpc";
import { useQueueSelection } from "../hooks/useQueueSelection";
import { useChampionData, getChampionName } from "../hooks/useChampions";
import type { ChampionDetail, ChampionStats, MatchListItem } from "../lib/types";
import ChampionIcon from "../components/ChampionIcon";
import Kda from "../components/Kda";
import RiotText from "../components/RiotText";
import StatCard from "../components/StatCard";
import WinRateBar from "../components/WinRateBar";
import { EmptyState, PageLoading } from "../components/PageState";
import { CDRAGON_ASSET_URL } from "../lib/constants";
import { LOCALE, formatDuration, formatTimeAgo, kdaRatio, scoreColor } from "../lib/format";
import { gamesLabel, useT } from "../lib/i18n";

// How many of the player's games with this champion the sheet lists
const RECENT_GAMES = 5;

function BackLink() {
  const t = useT();
  return (
    <Link
      to="/champions"
      className="inline-flex items-center gap-1.5 text-xs text-lol-text transition-colors hover:text-lol-text-bright"
    >
      <span aria-hidden>←</span> {t("champions.title")}
    </Link>
  );
}

function Ability({
  ability,
  branch,
}: {
  ability: ChampionDetail["abilities"][number];
  branch: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-xl border border-lol-border/60 bg-lol-card p-3">
      {/* self-start, or the flex row stretches this to the card height and the
          key badge lands at the bottom of the card instead of on the icon */}
      <div className="relative shrink-0 self-start">
        {ability.iconPath ? (
          <img
            src={CDRAGON_ASSET_URL(branch, ability.iconPath)}
            alt=""
            width={40}
            height={40}
            className="rounded-md"
            onError={(e) => {
              (e.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="h-10 w-10 rounded-md border border-white/10 bg-white/5" />
        )}
        <span className="absolute -bottom-1 -right-1 rounded bg-lol-dark px-1 text-[10px] font-bold text-lol-gold">
          {ability.key}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-lol-text-bright">{ability.name}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-lol-text">
          <RiotText markup={ability.description} />
        </p>
      </div>
    </div>
  );
}

export default function ChampionSheet() {
  const t = useT();
  const { championId } = useParams();
  const id = Number(championId);
  const [queue] = useQueueSelection();
  const champData = useChampionData();

  const { data: detail, loading } = useIpc<ChampionDetail | null>(
    () => window.api.getChampionDetail(id),
    [id],
  );
  const { data: stats } = useIpc<ChampionStats[]>(
    () => window.api.getChampionStats(undefined, queue),
    [queue],
  );
  const [matches, setMatches] = useState<MatchListItem[] | null>(null);
  useEffect(() => {
    let active = true;
    window.api.getChampionMatchHistory(id, RECENT_GAMES, 0, undefined, queue).then((result) => {
      if (active) setMatches(result.matches);
    });
    return () => {
      active = false;
    };
  }, [id, queue]);

  const mine = stats?.find((row) => row.champion_id === id);
  // The name comes from the roster the app already has, so the header reads
  // right even while the sheet itself is still on its way.
  const name = detail?.name || getChampionName(champData, id);

  if (loading && !detail) return <PageLoading />;

  return (
    <div className="max-w-5xl space-y-4">
      <BackLink />

      <div className="flex flex-wrap items-center gap-4">
        <ChampionIcon championId={id} size={64} className="border-2 border-lol-gold/40" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-lol-text-bright">{name}</h1>
          {detail?.title && <p className="text-sm text-lol-text">{detail.title}</p>}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[...(detail?.tags ?? []), ...(detail?.roles ?? [])].map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-lol-border bg-white/5 px-2 py-0.5 text-[11px] capitalize text-lol-text"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* What the player has done with them, in the queue they are looking at */}
      {mine ? (
        <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
          <StatCard
            label={t("champions.games")}
            value={mine.games}
            subtext={<WinRateBar wins={mine.wins} total={mine.games} />}
          />
          <StatCard
            label={t("champions.kdaLabel")}
            value={kdaRatio(mine.kills, mine.deaths, mine.assists)}
            subtext={
              <Kda
                kills={mine.avg_kills.toFixed(1)}
                deaths={mine.avg_deaths.toFixed(1)}
                assists={mine.avg_assists.toFixed(1)}
              />
            }
          />
          <StatCard
            label={t("history.avgScore")}
            value={
              mine.avg_score != null ? (
                <span className={scoreColor(mine.avg_score)}>{mine.avg_score.toFixed(1)}</span>
              ) : (
                "—"
              )
            }
            subtext={t("champions.mvpAce", { mvps: mine.mvps, aces: mine.aces })}
          />
          <StatCard
            label={t("champions.avgDamage")}
            value={Math.round(mine.avg_damage).toLocaleString(LOCALE)}
          />
        </div>
      ) : (
        <EmptyState>{t("champions.noGamesChampion")}</EmptyState>
      )}

      {/* The champion as the game describes them now */}
      {detail && detail.abilities.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
          {detail.abilities.map((ability) => (
            <Ability key={ability.key + ability.name} ability={ability} branch={detail.branch} />
          ))}
        </div>
      ) : (
        <EmptyState>{t("champions.noAbilities")}</EmptyState>
      )}

      {matches && matches.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-lol-text-bright">
            {t("champions.recentGames")}
          </h2>
          <div className="space-y-1">
            {matches.map((m) => (
              <div
                key={m.game_id}
                className={`flex h-8 items-center gap-2 rounded px-2 text-xs ${
                  m.is_remake
                    ? "bg-white/[0.03]"
                    : m.win
                      ? "bg-lol-win/[0.07]"
                      : "bg-lol-loss/[0.07]"
                }`}
              >
                <span
                  className={`w-4 shrink-0 text-center font-bold ${
                    m.is_remake ? "text-gray-500" : m.win ? "text-lol-win" : "text-lol-loss"
                  }`}
                >
                  {m.is_remake ? "-" : m.win ? t("common.w") : t("common.l")}
                </span>
                <span className="shrink-0 text-lol-text-bright">
                  <Kda kills={m.kills} deaths={m.deaths} assists={m.assists} />
                </span>
                {m.score != null && !m.is_remake && (
                  <span className={`shrink-0 font-semibold tabular-nums ${scoreColor(m.score)}`}>
                    {m.score.toFixed(1)}
                  </span>
                )}
                <span className="ml-auto shrink-0 tabular-nums text-lol-text">
                  {formatDuration(m.game_duration)}
                </span>
                <span className="shrink-0 text-lol-text">{formatTimeAgo(m.game_creation)}</span>
              </div>
            ))}
          </div>
          {mine && (
            <p className="text-xs text-lol-text">
              {t("champions.ofGames", { count: gamesLabel(t, mine.games) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
