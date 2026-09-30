import { useMemo, useEffect, useState } from "react";
import { PageLoading } from "../components/PageState";
import { useNavigate } from "react-router-dom";
import { useIpc } from "../hooks/useIpc";
import { useViewState } from "../hooks/useViewState";
import { useSort } from "../hooks/useSort";
import { useChampionData, getChampionName } from "../hooks/useChampions";
import type { TeammateStats } from "../lib/types";
import ChampionIcon from "../components/ChampionIcon";
import SummonerIcon from "../components/SummonerIcon";
import WinRateBar from "../components/WinRateBar";
import SortHeader from "../components/SortHeader";
import { formatTimeAgo, kdaRatio, kdaColor } from "../lib/format";
import { useT } from "../lib/i18n";
import PlayerTags from "../components/PlayerTags";
import { teammateTags } from "../../shared/tags";
import Kda from "../components/Kda";
import SearchInput from "../components/SearchInput";

type SortKey = "games" | "winRate" | "kda" | "lastPlayed";

export default function Friends() {
  const navigate = useNavigate();
  // Read once per render rather than per row, so every tag on the page
  // measures the same moment.
  const [now] = useState(() => Date.now());
  const t = useT();
  const champData = useChampionData();
  const { data, loading, refetch } = useIpc<TeammateStats[]>(() => window.api.getTeammateStats());
  const [search, setSearch] = useViewState("friends.search", "");
  const sort = useSort<SortKey>("friends", "games");
  const { sortKey, sortDir } = sort;
  // The only tag that depends on everybody else, so it is settled here and
  // handed down. By games played, never by whatever column is sorted.
  const mostPlayedKey = useMemo(
    () =>
      (data ?? []).reduce<TeammateStats | null>(
        (best, p) => (best && best.games >= p.games ? best : p),
        null,
      )?.key,
    [data],
  );

  useEffect(() => {
    const unsub = window.api.onGamesUpdated(() => refetch());
    return unsub;
  }, [refetch]);

  const sorted = useMemo(() => {
    if (!data) return [];
    let filtered = data.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

    filtered.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case "winRate":
          av = a.games > 0 ? a.wins / a.games : 0;
          bv = b.games > 0 ? b.wins / b.games : 0;
          break;
        case "kda":
          av = a.deaths > 0 ? (a.kills + a.assists) / a.deaths : a.kills + a.assists;
          bv = b.deaths > 0 ? (b.kills + b.assists) / b.deaths : b.kills + b.assists;
          break;
        case "lastPlayed":
          av = a.lastPlayed;
          bv = b.lastPlayed;
          break;
        default:
          av = a.games;
          bv = b.games;
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });

    return filtered;
  }, [data, search, sortKey, sortDir]);

  if (loading || !data) {
    return <PageLoading />;
  }

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-lol-text-bright">{t("friends.title")}</h1>
          <span className="text-sm text-lol-text">
            {t("friends.count", { count: sorted.length })}
          </span>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder={t("friends.search")} />
      </div>

      <div className="bg-lol-card rounded-xl border border-lol-border/60 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-lol-dark/50">
            <tr>
              <th className="px-3 py-2 text-right text-xs font-medium text-lol-text uppercase tracking-wider w-12">
                #
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-lol-text uppercase tracking-wider">
                {t("friends.player")}
              </th>
              <SortHeader
                {...sort}
                numeric
                label={t("friends.games")}
                field="games"
                className="w-24"
              />
              <SortHeader
                {...sort}
                numeric
                label={t("friends.winRate")}
                field="winRate"
                className="w-32"
              />
              <SortHeader
                {...sort}
                label={t("friends.theirKda")}
                field="kda"
                className="hidden w-32 @lg:table-cell"
              />
              <th className="hidden px-3 py-2 text-left text-xs font-medium text-lol-text uppercase tracking-wider w-36 @2xl:table-cell">
                {t("friends.topChampions")}
              </th>
              <SortHeader
                {...sort}
                label={t("friends.lastPlayed")}
                field="lastPlayed"
                className="w-32"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const avgKills = t.games > 0 ? t.kills / t.games : 0;
              const avgDeaths = t.games > 0 ? t.deaths / t.games : 0;
              const avgAssists = t.games > 0 ? t.assists / t.games : 0;
              const ratio =
                avgDeaths > 0 ? (avgKills + avgAssists) / avgDeaths : avgKills + avgAssists;
              const ratioStr = kdaRatio(t.kills, t.deaths, t.assists);

              return (
                <tr
                  key={t.key}
                  onClick={() => navigate(`/friends/${encodeURIComponent(t.key)}`)}
                  className="border-t border-lol-border/50 hover:bg-lol-card-hover cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 text-xs text-lol-text text-right tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <SummonerIcon iconId={t.profileIcon} size={28} />
                      <div className="min-w-0">
                        <span className="text-sm text-lol-text-bright">{t.name}</span>
                        <PlayerTags
                          className="mt-0.5"
                          tags={teammateTags(t, now, t.key === mostPlayedKey)}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-lol-text-bright text-right tabular-nums">
                    {t.games}
                  </td>
                  <td className="px-3 py-2 w-32">
                    <WinRateBar wins={t.wins} total={t.games} />
                  </td>
                  <td className="hidden px-3 py-2 @lg:table-cell">
                    <div className="flex flex-col">
                      <span className={`text-sm ${kdaColor(ratio)}`}>{ratioStr}</span>
                      <span className="text-[10px] text-lol-text">
                        <Kda
                          kills={avgKills.toFixed(1)}
                          deaths={avgDeaths.toFixed(1)}
                          assists={avgAssists.toFixed(1)}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 @2xl:table-cell">
                    <div className="flex items-center gap-1">
                      {t.champions.slice(0, 3).map((c) => (
                        <div key={c.champion_id} className="relative group">
                          <ChampionIcon championId={c.champion_id} size={24} />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-lol-dark border border-lol-border rounded px-2 py-1 text-[10px] text-lol-text-bright whitespace-nowrap z-10">
                            {getChampionName(champData, c.champion_id)} ({c.games})
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-lol-text">{formatTimeAgo(t.lastPlayed)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-8 text-center text-sm text-lol-text">{t("friends.none")}</div>
        )}
      </div>
    </div>
  );
}
