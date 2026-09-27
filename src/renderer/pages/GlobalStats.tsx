import { hasAugments } from "../../shared/queues";
import { useQueueSelection } from "../hooks/useQueueSelection";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryFilters } from "../hooks/useQueryFilters";
import { useIpc } from "../hooks/useIpc";
import { useViewState } from "../hooks/useViewState";
import { readViewState, writeViewState } from "../lib/viewState";
import {
  useChampionData,
  getChampionName,
  useAugmentData,
  getAugmentName,
  useItemData,
} from "../hooks/useChampions";
import type { GlobalStats } from "../lib/types";
import ChampionIcon from "../components/ChampionIcon";
import AugmentIcon from "../components/AugmentIcon";
import ItemIcon from "../components/ItemIcon";
import WinRateBar from "../components/WinRateBar";
import PatchSelect from "../components/PatchSelect";
import QueueSelect from "../components/QueueSelect";
import RarityFilter, { type Rarity } from "../components/RarityFilter";
import SortHeader from "../components/SortHeader";
import SearchInput from "../components/SearchInput";
import { useSort } from "../hooks/useSort";
import { useT } from "../lib/i18n";

type Tab = "champions" | "augments" | "items";
type ChampSortKey = "games" | "winRate" | "pickRate" | "name";
type AugSortKey = "picks" | "winRate" | "pickRate" | "name";
type ItemSortKey = "picks" | "winRate" | "name";

export default function GlobalStats() {
  const t = useT();
  const champData = useChampionData();
  const augmentData = useAugmentData();
  const navigate = useNavigate();
  // Filters and tab live in the URL so returning from a champion page lands
  // back on the same view
  const { searchParams, setSearchParams, setParam, patch } = useQueryFilters();
  // The queue is the app-wide selection rather than a query parameter
  const [queue, setQueue] = useQueueSelection();
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    (tabParam === "augments" && hasAugments(queue)) || tabParam === "items"
      ? tabParam
      : "champions";

  const setPatch = (p: string | undefined) => setParam("patch", p);

  const setTab = (t: Tab) => setParam("tab", t === "champions" ? undefined : t);

  // Those three live in the URL, so remembering them means putting the query
  // string back on the way in. Arriving with one already set — the back link
  // from a champion page — wins over whatever was stored.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const saved = readViewState("global.params", "");
    if (saved && !searchParams.toString()) {
      setSearchParams(new URLSearchParams(saved), { replace: true });
    }
    setRestored(true);
    // Only ever on the way in, so the stored value can't clobber a live edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (restored) writeViewState("global.params", searchParams.toString());
  }, [restored, searchParams]);

  // Carried into the champion page so it opens with the same filters, and
  // comes back on its back link
  const filterQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (patch) params.set("patch", patch);
    if (queue != null) params.set("queue", String(queue));
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [patch, queue]);

  const { data, refetch } = useIpc<GlobalStats>(
    () => window.api.getGlobalStats(patch, queue),
    [patch, queue],
  );

  // Champion tab state
  const [champSearch, setChampSearch] = useViewState("global.champSearch", "");
  const champSort = useSort<ChampSortKey>("global.champ", "games");
  const { sortKey: champSortKey, sortDir: champSortDir } = champSort;

  // Augment tab state
  const [augSearch, setAugSearch] = useViewState("global.augSearch", "");
  const augSort = useSort<AugSortKey>("global.aug", "picks");
  const { sortKey: augSortKey, sortDir: augSortDir } = augSort;
  const [rarityFilter, setRarityFilter] = useViewState<Rarity>("global.augRarity", "all");

  // Item tab state
  const itemData = useItemData(patch);
  const [itemSearch, setItemSearch] = useViewState("global.itemSearch", "");
  const itemSort = useSort<ItemSortKey>("global.item", "picks");
  const { sortKey: itemSortKey, sortDir: itemSortDir } = itemSort;

  useEffect(() => {
    const unsub = window.api.onGamesUpdated(() => refetch());
    return unsub;
  }, [refetch]);

  const sortedChampions = useMemo(() => {
    if (!data) return [];
    let filtered = data.champions.filter((c) => {
      const name = getChampionName(champData, c.champion_id).toLowerCase();
      return name.includes(champSearch.toLowerCase());
    });

    filtered.sort((a, b) => {
      let av: number, bv: number;
      if (champSortKey === "name") {
        const nameA = getChampionName(champData, a.champion_id);
        const nameB = getChampionName(champData, b.champion_id);
        const cmp = nameA.localeCompare(nameB);
        return champSortDir === "asc" ? cmp : -cmp;
      } else if (champSortKey === "winRate") {
        av = a.games > 0 ? a.wins / a.games : 0;
        bv = b.games > 0 ? b.wins / b.games : 0;
      } else if (champSortKey === "pickRate") {
        av = data.totalParticipantSlots > 0 ? a.games / data.totalParticipantSlots : 0;
        bv = data.totalParticipantSlots > 0 ? b.games / data.totalParticipantSlots : 0;
      } else {
        av = a.games;
        bv = b.games;
      }
      return champSortDir === "desc" ? bv - av : av - bv;
    });

    return filtered;
  }, [data, champSearch, champSortKey, champSortDir, champData]);

  const sortedAugments = useMemo(() => {
    if (!data) return [];
    let filtered = data.augments.filter((a) => {
      const name = getAugmentName(augmentData, a.augment_id).toLowerCase();
      if (!name.includes(augSearch.toLowerCase())) return false;
      if (rarityFilter !== "all" && augmentData[a.augment_id]?.rarity !== rarityFilter)
        return false;
      return true;
    });

    filtered.sort((a, b) => {
      let av: number, bv: number;
      if (augSortKey === "name") {
        const nameA = getAugmentName(augmentData, a.augment_id);
        const nameB = getAugmentName(augmentData, b.augment_id);
        const cmp = nameA.localeCompare(nameB);
        return augSortDir === "asc" ? cmp : -cmp;
      } else if (augSortKey === "winRate") {
        av = a.picks > 0 ? a.wins / a.picks : 0;
        bv = b.picks > 0 ? b.wins / b.picks : 0;
      } else if (augSortKey === "pickRate") {
        av = data!.totalParticipantSlots > 0 ? a.picks / data!.totalParticipantSlots : 0;
        bv = data!.totalParticipantSlots > 0 ? b.picks / data!.totalParticipantSlots : 0;
      } else {
        av = a.picks;
        bv = b.picks;
      }
      return augSortDir === "desc" ? bv - av : av - bv;
    });

    return filtered;
  }, [data, augSearch, augSortKey, augSortDir, augmentData, rarityFilter]);

  const getItemName = useCallback(
    (id: number) => itemData[id]?.name ?? t("global.itemId", { id }),
    [itemData, t],
  );

  const sortedItems = useMemo(() => {
    if (!data) return [];
    const filtered = data.items.filter((it) =>
      getItemName(it.item_id).toLowerCase().includes(itemSearch.toLowerCase()),
    );

    filtered.sort((a, b) => {
      if (itemSortKey === "name") {
        const cmp = getItemName(a.item_id).localeCompare(getItemName(b.item_id));
        return itemSortDir === "asc" ? cmp : -cmp;
      }
      let av: number, bv: number;
      if (itemSortKey === "winRate") {
        av = a.picks > 0 ? a.wins / a.picks : 0;
        bv = b.picks > 0 ? b.wins / b.picks : 0;
      } else {
        av = a.picks;
        bv = b.picks;
      }
      return itemSortDir === "desc" ? bv - av : av - bv;
    });

    return filtered;
  }, [data, itemSearch, itemSortKey, itemSortDir, getItemName]);

  if (!data) {
    return <div className="text-lol-text text-center mt-20">{t("common.loading")}</div>;
  }

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-lol-text-bright">{t("global.title")}</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-lol-text">
            {t("global.summary", {
              games: data.totalGames,
              champions: data.champions.length,
              augments: data.augments.length,
              items: data.items.length,
            })}
          </span>
          <QueueSelect value={queue} onChange={setQueue} />
          <PatchSelect value={patch} onChange={setPatch} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("champions")}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            tab === "champions"
              ? "bg-lol-gold/20 text-lol-gold border-lol-gold/50"
              : "text-lol-text border-lol-border bg-lol-card hover:border-lol-border/80"
          }`}
        >
          {t("champions.title")}
        </button>
        <button
          hidden={!hasAugments(queue)}
          onClick={() => setTab("augments")}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            tab === "augments"
              ? "bg-lol-gold/20 text-lol-gold border-lol-gold/50"
              : "text-lol-text border-lol-border bg-lol-card hover:border-lol-border/80"
          }`}
        >
          {t("scoreboard.augments")}
        </button>
        <button
          onClick={() => setTab("items")}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            tab === "items"
              ? "bg-lol-gold/20 text-lol-gold border-lol-gold/50"
              : "text-lol-text border-lol-border bg-lol-card hover:border-lol-border/80"
          }`}
        >
          {t("live.items")}
        </button>
      </div>

      {tab === "champions" && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-lol-text">
              {t("global.championsCount", { count: sortedChampions.length })}
            </span>
            <SearchInput
              value={champSearch}
              onChange={setChampSearch}
              placeholder={t("champions.search")}
            />
          </div>

          <div className="bg-lol-card rounded-xl border border-lol-border/60 overflow-hidden">
            <table className="w-full">
              <thead className="bg-lol-dark/50">
                <tr>
                  <th className="px-3 py-2 text-right text-xs font-medium text-lol-text uppercase tracking-wider w-12">
                    #
                  </th>
                  <SortHeader {...champSort} label={t("champions.champion")} field="name" />
                  <SortHeader
                    {...champSort}
                    numeric
                    label={t("global.appearances")}
                    field="games"
                    className="w-36"
                  />
                  <SortHeader
                    {...champSort}
                    numeric
                    label={t("global.pickRate")}
                    field="pickRate"
                    className="w-24"
                  />
                  <SortHeader
                    {...champSort}
                    numeric
                    label={t("friends.winRate")}
                    field="winRate"
                    className="w-32"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedChampions.map((c, i) => {
                  const pickRate =
                    data.totalParticipantSlots > 0
                      ? ((c.games / data.totalParticipantSlots) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr
                      key={c.champion_id}
                      onClick={() => navigate(`/global/champion/${c.champion_id}${filterQuery}`)}
                      className="group border-t border-lol-border/50 hover:bg-lol-card-hover cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2 text-xs text-lol-text text-right tabular-nums">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <ChampionIcon championId={c.champion_id} size={28} />
                          <span className="text-sm text-lol-text-bright group-hover:text-lol-gold transition-colors">
                            {getChampionName(champData, c.champion_id)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-lol-text-bright text-right tabular-nums whitespace-nowrap">
                        {c.games}
                        {c.ownGames > 0 && (
                          <span className="ml-1.5 text-[11px] text-lol-text">
                            {c.ownGames === 1
                              ? t("global.ownGame")
                              : t("global.ownGames", { count: c.ownGames })}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-lol-text text-right tabular-nums">
                        {pickRate}%
                      </td>
                      <td className="px-3 py-2 w-32">
                        <WinRateBar wins={c.wins} total={c.games} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedChampions.length === 0 && (
              <div className="py-8 text-center text-sm text-lol-text">{t("champions.none")}</div>
            )}
          </div>
        </>
      )}

      {tab === "items" && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-lol-text">
              {t("global.itemsCount", { count: sortedItems.length })}
            </span>
            <SearchInput
              value={itemSearch}
              onChange={setItemSearch}
              placeholder={t("global.searchItem")}
            />
          </div>

          <div className="bg-lol-card rounded-xl border border-lol-border/60 overflow-hidden">
            <table className="w-full">
              <thead className="bg-lol-dark/50">
                <tr>
                  <SortHeader {...itemSort} label={t("global.item")} field="name" />
                  <SortHeader
                    {...itemSort}
                    numeric
                    label={t("global.picks")}
                    field="picks"
                    className="w-24"
                  />
                  <th className="px-3 py-2 text-right text-xs font-medium text-lol-text uppercase tracking-wider w-24">
                    {t("global.pickRate")}
                  </th>
                  <SortHeader
                    {...itemSort}
                    numeric
                    label={t("friends.winRate")}
                    field="winRate"
                    className="w-32"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const pickRate =
                    data.totalParticipantSlots > 0
                      ? ((item.picks / data.totalParticipantSlots) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr
                      key={item.item_id}
                      className="border-t border-lol-border/50 hover:bg-lol-card-hover transition-colors"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <ItemIcon itemId={item.item_id} size={28} patch={patch} />
                          <span className="text-sm text-lol-text-bright">
                            {getItemName(item.item_id)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-lol-text-bright text-right tabular-nums">
                        {item.picks}
                      </td>
                      <td className="px-3 py-2 text-sm text-lol-text text-right tabular-nums">
                        {pickRate}%
                      </td>
                      <td className="px-3 py-2 w-32">
                        <WinRateBar wins={item.wins} total={item.picks} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedItems.length === 0 && (
              <div className="py-8 text-center text-sm text-lol-text">{t("global.noItems")}</div>
            )}
          </div>
        </>
      )}

      {tab === "augments" && (
        <>
          <div className="flex items-center gap-2">
            <RarityFilter value={rarityFilter} onChange={setRarityFilter} />
            <span className="text-xs text-lol-text self-center ml-2">
              {t("global.augmentsCount", { count: sortedAugments.length })}
            </span>
            <div className="ml-auto">
              <SearchInput
                value={augSearch}
                onChange={setAugSearch}
                placeholder={t("global.searchAugment")}
              />
            </div>
          </div>

          <div className="bg-lol-card rounded-xl border border-lol-border/60 overflow-hidden">
            <table className="w-full">
              <thead className="bg-lol-dark/50">
                <tr>
                  <SortHeader {...augSort} label={t("global.augment")} field="name" />
                  <SortHeader
                    {...augSort}
                    numeric
                    label={t("global.picks")}
                    field="picks"
                    className="w-24"
                  />
                  <th className="px-3 py-2 text-right text-xs font-medium text-lol-text uppercase tracking-wider w-24">
                    {t("global.pickRate")}
                  </th>
                  <SortHeader
                    {...augSort}
                    numeric
                    label={t("friends.winRate")}
                    field="winRate"
                    className="w-32"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedAugments.map((a) => {
                  const pickRate =
                    data.totalParticipantSlots > 0
                      ? ((a.picks / data.totalParticipantSlots) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr
                      key={a.augment_id}
                      className="border-t border-lol-border/50 hover:bg-lol-card-hover transition-colors"
                    >
                      <td className="px-3 py-2">
                        <AugmentIcon augmentId={a.augment_id} showName />
                      </td>
                      <td className="px-3 py-2 text-sm text-lol-text-bright text-right tabular-nums">
                        {a.picks}
                      </td>
                      <td className="px-3 py-2 text-sm text-lol-text text-right tabular-nums">
                        {pickRate}%
                      </td>
                      <td className="px-3 py-2 w-32">
                        <WinRateBar wins={a.wins} total={a.picks} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedAugments.length === 0 && (
              <div className="py-8 text-center text-sm text-lol-text">{t("global.noAugments")}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
