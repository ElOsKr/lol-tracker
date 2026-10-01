import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/PageState";
import { useQueueSelection } from "../hooks/useQueueSelection";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMatches } from "../hooks/useMatches";
import { useChampionData, getChampionName } from "../hooks/useChampions";
import { useItemData } from "../hooks/useChampions";
import { useIpc } from "../hooks/useIpc";
import { useLcuStatus } from "../hooks/useLcuStatus";
import { useBackfill } from "../hooks/useBackfill";
import { useViewState } from "../hooks/useViewState";
import { EMPTY_FILTER_OPTIONS } from "../hooks/useFilterOptions";
import type {
  MatchListItem,
  MatchDetail,
  GameRecap,
  DashboardData,
  MatchFilterOptions,
  MatchSession,
  MatchSort,
  MatchSortDir,
  MultikillType,
  LcuStatus,
  BackfillProgress,
} from "../lib/types";
import ItemIcon from "../components/ItemIcon";
import { groupIntoSessions, type Session } from "../lib/sessions";
import GameRow from "../components/GameRow";
import { showsLaneStats } from "../../shared/history-columns";
import { hasScore } from "../../shared/queues";
import StatCard from "../components/StatCard";
import SummonerIcon from "../components/SummonerIcon";
import WinRateBar from "../components/WinRateBar";
import {
  ArrowDownIcon,
  CopyIcon,
  ImageIcon,
  StarIcon,
  SwordsIcon,
  ZapIcon,
} from "../components/icons";
import { ExportImageMessage, useGameImageExport } from "../components/ExportImage";
import {
  formatPlaytime,
  formatKDA,
  formatPatch,
  kdaRatio,
  kdaColor,
  scoreColor,
} from "../lib/format";
import QueueSelect from "../components/QueueSelect";
import { gamesLabel, useT, type Translate } from "../lib/i18n";
import type { TranslationKey } from "../../shared/i18n";
import { SESSION_GROUPING_SETTING, parseSessionGrouping } from "../../shared/session";
import Kda from "../components/Kda";

// An empty list means something different depending on whether we're still
// waiting on the client, mid-import, or genuinely out of games.
function emptyStateMessage(
  t: Translate,
  status: LcuStatus,
  backfill: { running: boolean; progress: BackfillProgress | null },
) {
  if (backfill.running) {
    const p = backfill.progress;
    return p && p.total > 0
      ? t("history.importingProgress", { current: p.current, total: p.total })
      : t("history.importing");
  }
  if (status !== "connected" && status !== "ingame") {
    return t("history.waitingClient");
  }
  return t("history.noGamesQueue");
}

// The unselected state is the default sort (date), so it isn't listed here
const SORT_OPTIONS: { value: MatchSort; label: TranslationKey }[] = [
  { value: "score", label: "sort.score" },
  { value: "kda", label: "sort.kda" },
  { value: "kills", label: "sort.kills" },
  { value: "duration", label: "sort.duration" },
  { value: "damageDealt", label: "sort.damageDealt" },
  { value: "damageTaken", label: "sort.damageTaken" },
  { value: "healing", label: "sort.healing" },
];

// How a link names the game it wants opened: /?game=<id>
const GAME_PARAM = "game";
// How the items page names the item whose games it wants: /?item=<id>
const ITEM_PARAM = "item";
// Long enough for the row to have rendered with its detail open, so the
// scroll lands on the whole panel rather than on where the row used to be.
const SCROLL_DELAY_MS = 120;

export default function MatchHistory() {
  const t = useT();
  const [championFilter, setChampionFilter] = useViewState<number | undefined>(
    "matches.champion",
    undefined,
  );
  const [patchFilter, setPatchFilter] = useViewState<string | undefined>(
    "matches.patch",
    undefined,
  );
  const [queueFilter, setQueueFilter] = useQueueSelection();
  const [accountFilter, setAccountFilter] = useViewState<string | undefined>(
    "matches.account",
    undefined,
  );
  const [multikillFilter, setMultikillFilter] = useViewState<MultikillType[]>(
    "matches.multikills",
    [],
  );
  const [sort, setSort] = useViewState<MatchSort | undefined>("matches.sort", undefined);
  const [sortDir, setSortDir] = useViewState<MatchSortDir>("matches.sortDir", "desc");
  const [favoritesOnly, setFavoritesOnly] = useViewState("matches.favorites", false);
  // A link from elsewhere can name a game: open it and scroll to it, once.
  // The parameter is dropped afterwards so going back or reloading does not
  // reopen it, and so the history is its plain self from then on.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedGame = searchParams.get(GAME_PARAM);
  // Set by the items page, and cleared from here rather than from there: a
  // filter you cannot see how to remove is a trap.
  const itemParam = Number(searchParams.get(ITEM_PARAM));
  const itemFilter = Number.isFinite(itemParam) && itemParam > 0 ? itemParam : undefined;
  const clearItemFilter = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(ITEM_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const { matches, loading, hasMore, loadMore, reload } = useMatches({
    championId: championFilter,
    patch: patchFilter,
    queue: queueFilter,
    account: accountFilter,
    sort,
    sortDir,
    multikills: multikillFilter,
    favorites: favoritesOnly,
    itemId: itemFilter,
  });

  const toggleMultikill = useCallback(
    (kind: MultikillType) => {
      setMultikillFilter((prev) =>
        prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
      );
    },
    [setMultikillFilter],
  );
  const champData = useChampionData();
  const itemData = useItemData();
  // Read once on mount, which is every time the page is opened: coming back
  // from Settings is what changes it.
  const { data: storedGrouping } = useIpc<string | null>(
    () => window.api.getSetting(SESSION_GROUPING_SETTING),
    [],
  );
  const grouping = parseSessionGrouping(storedGrouping);
  const { data: dashboard, refetch: refetchDashboard } = useIpc<DashboardData>(
    () =>
      window.api.getDashboard({
        championId: championFilter,
        patch: patchFilter,
        queue: queueFilter,
        account: accountFilter,
      }),
    [championFilter, patchFilter, queueFilter, accountFilter],
  );
  // The list arrives a page at a time, so the rows on screen describe the page
  // rather than the day. These cover every game the filters match.
  const { data: sessionTotals, refetch: refetchSessions } = useIpc<MatchSession[]>(
    () =>
      window.api.getMatchSessions({
        championId: championFilter,
        patch: patchFilter,
        queue: queueFilter,
        account: accountFilter,
        multikills: multikillFilter,
        favorites: favoritesOnly,
        itemId: itemFilter,
      }),
    [
      championFilter,
      patchFilter,
      queueFilter,
      accountFilter,
      multikillFilter,
      favoritesOnly,
      itemFilter,
    ],
  );

  // Null until the first answer. The effects below drop selections the data no
  // longer supports, and an empty stand-in would read as data supporting none.
  const [loadedOptions, setLoadedOptions] = useState<MatchFilterOptions | null>(null);
  const filterOptions = loadedOptions ?? EMPTY_FILTER_OPTIONS;
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    match: MatchListItem;
  } | null>(null);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  // The sentences need career and per-champion averages, which the detail
  // does not carry; the recap does, and answers for any game.
  const [recap, setRecap] = useState<GameRecap | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // One instance for the page: both of the right-click menu's image items
  // report through the same message
  const exporting = useGameImageExport();
  const [puuids, setPuuids] = useState<string[] | null>(null);
  const [profile, setProfile] = useState<{
    name: string | null;
    profileIcon: number | null;
  } | null>(null);
  // Decided over everything loaded rather than the page on screen, so the
  // columns do not appear halfway down an infinite scroll.
  const laneStats = useMemo(() => showsLaneStats(matches), [matches]);
  const scored = hasScore(queueFilter);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lcuStatus = useLcuStatus();
  const backfill = useBackfill();

  useEffect(() => {
    window.api.getAllSummonerPuuids().then(setPuuids);
  }, []);

  // The name and icon can change under us as new games arrive
  useEffect(() => {
    const load = () => window.api.getProfile().then(setProfile);
    load();
    return window.api.onGamesUpdated(load);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const fetchOptions = useCallback(
    () =>
      window.api
        .getMatchFilterOptions({
          championId: championFilter,
          patch: patchFilter,
          queue: queueFilter,
          account: accountFilter,
        })
        .then(setLoadedOptions),
    [championFilter, patchFilter, queueFilter, accountFilter],
  );

  useEffect(() => {
    fetchOptions();

    const unsub = window.api.onGamesUpdated(() => {
      refetchDashboard();
      refetchSessions();
      fetchOptions();
    });
    return unsub;
  }, [fetchOptions, refetchDashboard, refetchSessions]);

  // Clear a selection if new data leaves it without any matching games
  useEffect(() => {
    if (!loadedOptions) return;
    if (championFilter !== undefined && !loadedOptions.champions.includes(championFilter)) {
      setChampionFilter(undefined);
    }
    if (patchFilter !== undefined && !loadedOptions.patches.includes(patchFilter)) {
      setPatchFilter(undefined);
    }
    if (
      accountFilter !== undefined &&
      !loadedOptions.accounts.some((a) => a.puuid === accountFilter)
    ) {
      setAccountFilter(undefined);
    }
    // Settles rather than loops: clearing a filter sets it to undefined, and
    // the undefined branch does nothing on the re-run.
  }, [
    loadedOptions,
    championFilter,
    patchFilter,
    queueFilter,
    accountFilter,
    setChampionFilter,
    setPatchFilter,
    setQueueFilter,
    setAccountFilter,
  ]);

  // Unfavoriting the last game takes the toggle button away with it, so the
  // filter can't be left on with no way to turn it off.
  const hasFavorites = loadedOptions?.hasFavorites;
  useEffect(() => {
    if (hasFavorites === false) setFavoritesOnly(false);
  }, [hasFavorites, setFavoritesOnly]);

  const championOptions = useMemo(
    () =>
      filterOptions.champions
        .map((id) => ({ id, name: getChampionName(champData, id) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filterOptions.champions, champData],
  );

  const toggleExpand = useCallback(
    async (gameId: number) => {
      if (expandedId === gameId) {
        setExpandedId(null);
        setDetail(null);
        setRecap(null);
        return;
      }
      setExpandedId(gameId);
      setDetailLoading(true);
      setRecap(null);
      try {
        // Together rather than one after the other: the scoreboard is what
        // the user is waiting for and the recap is a few milliseconds of
        // career rows, so there is no reason to make either queue behind the
        // other.
        const [d, r] = await Promise.all([
          window.api.getMatchDetail(gameId),
          window.api.getGameRecap(gameId),
        ]);
        setDetail(d);
        setRecap(r);
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedId],
  );

  useEffect(() => {
    if (!requestedGame) return;
    const gameId = Number(requestedGame);
    setSearchParams({}, { replace: true });
    if (!Number.isFinite(gameId)) return;
    void toggleExpand(gameId);
    // After the row has rendered with its detail open
    const timer = setTimeout(() => {
      document
        .getElementById(`game-${gameId}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, SCROLL_DELAY_MS);
    return () => clearTimeout(timer);
    // Runs for the parameter alone: toggleExpand changes as rows expand, and
    // depending on it would reopen this game every time another one is closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedGame]);

  const handleToggleFavorite = useCallback(
    async (match: MatchListItem) => {
      setContextMenu(null);
      await window.api.toggleFavorite(match.game_id);
      reload();
      // With the favorites filter on, this changed which games are in the list
      refetchSessions();
      // The first favorite reveals the toggle button, the last one hides it
      fetchOptions();
    },
    [reload, refetchSessions, fetchOptions],
  );

  const avgKills =
    dashboard && dashboard.totalGames > 0
      ? (dashboard.totalKills / dashboard.totalGames).toFixed(1)
      : "0";
  const avgDeaths =
    dashboard && dashboard.totalGames > 0
      ? (dashboard.totalDeaths / dashboard.totalGames).toFixed(1)
      : "0";
  const avgAssists =
    dashboard && dashboard.totalGames > 0
      ? (dashboard.totalAssists / dashboard.totalGames).toFixed(1)
      : "0";
  const kdaValue =
    dashboard && dashboard.totalDeaths > 0
      ? (dashboard.totalKills + dashboard.totalAssists) / dashboard.totalDeaths
      : Infinity;
  // With one account selected, the profile card is about that account — not
  // whichever one played most recently.
  const selectedAccount = accountFilter
    ? filterOptions.accounts.find((a) => a.puuid === accountFilter)
    : undefined;
  const profileShown = selectedAccount
    ? { name: selectedAccount.name, profileIcon: selectedAccount.profileIcon }
    : profile;

  // Session headers only make sense when the list reads in time order; any
  // other sort interleaves sessions, so those render flat.
  const isDateSort = !sort || sort === "date";
  const sessions = useMemo(() => {
    if (!isDateSort || grouping === "none") return null;
    const grouped = groupIntoSessions(matches, grouping, t);
    if (!sessionTotals) return grouped;

    // The rows stay as they are; only the header totals come from the database,
    // so a session that is half-loaded still reports all of itself.
    const byKey = new Map(sessionTotals.map((total) => [total.key, total]));
    return grouped.map((session) => {
      const total = byKey.get(session.key);
      if (!total) return session;
      return {
        ...session,
        games: total.games,
        wins: total.wins,
        losses: total.losses,
        kills: total.kills,
        deaths: total.deaths,
        assists: total.assists,
        avgScore:
          total.scored_games > 0 && total.score_sum != null
            ? total.score_sum / total.scored_games
            : null,
      };
    });
  }, [isDateSort, grouping, matches, sessionTotals, t]);

  const totalMultikills = dashboard
    ? dashboard.multikills.doubles +
      dashboard.multikills.triples +
      dashboard.multikills.quadras +
      dashboard.multikills.pentas
    : 0;

  return (
    <div className="max-w-7xl space-y-4">
      {/* Stat Cards */}
      {dashboard && dashboard.totalGames > 0 && (
        <div
          className={`grid grid-cols-1 items-stretch gap-4 @xl:grid-cols-2 ${
            scored
              ? "@5xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]"
              : "@5xl:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(0,1fr))]"
          }`}
        >
          <ProfileCard profile={profileShown} dashboard={dashboard} />

          {/* An unscored queue used to leave this card standing with a dash in
              it, which is the same empty-column habit the rest of the app has
              been getting rid of. The row closes up instead. */}
          {scored && (
            <StatCard
              label={t("history.avgScore")}
              accent="gold"
              icon={<StarIcon className="w-3 h-3" />}
              value={
                dashboard.avgScore != null ? (
                  <span className={scoreColor(dashboard.avgScore)}>
                    {dashboard.avgScore.toFixed(1)}
                    <span className="text-sm font-semibold text-lol-text/60"> / 10</span>
                  </span>
                ) : (
                  "—"
                )
              }
              subtext={<ScoreMeter score={dashboard.avgScore} />}
            >
              <BadgeCounts
                mvps={dashboard.mvps}
                aces={dashboard.aces}
                scoredWins={dashboard.scoredWins}
                scoredLosses={dashboard.scoredLosses}
              />
            </StatCard>
          )}

          <StatCard
            label={t("history.avgKda")}
            accent="sky"
            icon={<SwordsIcon className="w-3 h-3" />}
            value={
              /* Three numbers where the other cards show one — a notch smaller
                 keeps it on one line in the narrowest column */
              <span className="text-xl">
                <Kda kills={avgKills} deaths={avgDeaths} assists={avgAssists} />
              </span>
            }
            subtext={
              <span className={kdaColor(kdaValue)}>
                {t("recap.kda", {
                  ratio: kdaRatio(
                    dashboard.totalKills,
                    dashboard.totalDeaths,
                    dashboard.totalAssists,
                  ),
                })}
              </span>
            }
          >
            <div className="text-[11px] text-lol-text">
              {t("history.totalKda", {
                kills: dashboard.totalKills,
                deaths: dashboard.totalDeaths,
                assists: dashboard.totalAssists,
              })}
            </div>
          </StatCard>

          <StatCard
            label={t("history.multikills")}
            accent="purple"
            icon={<ZapIcon className="w-3 h-3" />}
            value={totalMultikills}
          >
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  {
                    kind: "doubles",
                    label: "D",
                    name: "history.onlyDouble",
                    value: dashboard.multikills.doubles,
                    color: "text-sky-400",
                  },
                  {
                    kind: "triples",
                    label: "T",
                    name: "history.onlyTriple",
                    value: dashboard.multikills.triples,
                    color: "text-amber-400",
                  },
                  {
                    kind: "quadras",
                    label: "Q",
                    name: "history.onlyQuadra",
                    value: dashboard.multikills.quadras,
                    color: "text-purple-400",
                  },
                  {
                    kind: "pentas",
                    label: "P",
                    name: "history.onlyPenta",
                    value: dashboard.multikills.pentas,
                    color: "text-red-400",
                  },
                ] as {
                  kind: MultikillType;
                  label: string;
                  name: TranslationKey;
                  value: number;
                  color: string;
                }[]
              ).map(({ kind, label, name, value, color }) => {
                const active = multikillFilter.includes(kind);
                return (
                  <button
                    key={label}
                    onClick={() => toggleMultikill(kind)}
                    title={t(name)}
                    className={`text-center rounded-md border px-1 py-0.5 transition-colors ${
                      active
                        ? "border-lol-gold/60 bg-lol-gold/10"
                        : "border-transparent hover:border-lol-border hover:bg-white/5"
                    }`}
                  >
                    <div className={`text-base font-bold ${color}`}>{value}</div>
                    <div className="text-[10px] text-lol-text">{label}</div>
                  </button>
                );
              })}
            </div>
          </StatCard>
        </div>
      )}

      {itemFilter != null && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-lol-gold/40 bg-lol-gold/5 px-3 py-2">
          <ItemIcon itemId={itemFilter} size={26} />
          <span className="text-sm text-lol-text-bright">
            {t("history.filteredByItem", {
              item: itemData[itemFilter]?.name ?? String(itemFilter),
            })}
          </span>
          <button
            type="button"
            onClick={clearItemFilter}
            className="ml-auto rounded border border-lol-border px-2 py-1 text-xs text-lol-text transition-colors hover:text-lol-text-bright"
          >
            {t("history.clearItemFilter")}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-lol-text-bright">{t("history.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {filterOptions.hasFavorites && (
            <button
              onClick={() => setFavoritesOnly((v) => !v)}
              title={favoritesOnly ? t("history.showingFavorites") : t("history.onlyFavorites")}
              className={`flex items-center rounded-lg border px-2 py-1.5 transition-colors ${
                favoritesOnly
                  ? "border-lol-gold/60 bg-lol-gold/10 text-amber-400"
                  : "border-lol-border bg-lol-card text-lol-text hover:border-lol-gold/60 hover:text-lol-text-bright"
              }`}
            >
              {/* h-5 matches the selects' line-height so the boxes end up the same height */}
              <span className="flex h-5 items-center">
                <StarIcon className="h-3.5 w-3.5" fill={favoritesOnly ? "currentColor" : "none"} />
              </span>
            </button>
          )}
          {/* A single-account database doesn't need an account dropdown */}
          {(filterOptions.accounts.length > 1 || accountFilter !== undefined) && (
            <select
              value={accountFilter ?? ""}
              onChange={(e) => setAccountFilter(e.target.value === "" ? undefined : e.target.value)}
              className="select"
            >
              <option value="">{t("history.allAccounts")}</option>
              {filterOptions.accounts.map((a) => (
                <option key={a.puuid} value={a.puuid}>
                  {a.name ?? t("history.unknownAccount")}
                </option>
              ))}
            </select>
          )}
          <select
            value={championFilter ?? ""}
            onChange={(e) =>
              setChampionFilter(e.target.value === "" ? undefined : Number(e.target.value))
            }
            className="select"
          >
            <option value="">{t("history.allChampions")}</option>
            {championOptions.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={patchFilter ?? ""}
            onChange={(e) => setPatchFilter(e.target.value === "" ? undefined : e.target.value)}
            className="select"
          >
            <option value="">{t("history.allPatches")}</option>
            {filterOptions.patches.map((p) => (
              <option key={p} value={p}>
                {t("history.patchLabel", { patch: formatPatch(p) })}
              </option>
            ))}
          </select>
          <QueueSelect value={queueFilter} onChange={setQueueFilter} />
          <div className="flex items-center gap-1">
            <select
              value={sort ?? ""}
              onChange={(e) => {
                setSort(e.target.value === "" ? undefined : (e.target.value as MatchSort));
                setSortDir("desc");
              }}
              className="select"
            >
              <option value="">{t("history.sort")}</option>
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              title={
                !sort || sort === "date"
                  ? sortDir === "desc"
                    ? t("history.newestFirst")
                    : t("history.oldestFirst")
                  : sortDir === "desc"
                    ? t("history.highestFirst")
                    : t("history.lowestFirst")
              }
              className="flex items-center rounded-lg border border-lol-border bg-lol-card px-2 py-1.5 text-lol-text transition-colors hover:border-lol-gold/60 hover:text-lol-text-bright"
            >
              {/* h-5 matches the selects' line-height so the boxes end up the same height */}
              <span className="flex h-5 items-center">
                <ArrowDownIcon
                  className={`h-3.5 w-3.5 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      {matches.length === 0 && !loading && (
        <EmptyState>
          {championFilter !== undefined ||
          patchFilter !== undefined ||
          accountFilter !== undefined ||
          multikillFilter.length > 0 ||
          favoritesOnly ||
          itemFilter != null
            ? t("history.noMatchFilters")
            : emptyStateMessage(t, lcuStatus, backfill)}
        </EmptyState>
      )}

      {(() => {
        const renderMatch = (m: MatchListItem) => (
          <GameRow
            key={m.game_id}
            match={m}
            laneStats={laneStats}
            champData={champData}
            expanded={expandedId === m.game_id}
            detail={expandedId === m.game_id ? detail : null}
            recap={expandedId === m.game_id ? recap : null}
            detailLoading={expandedId === m.game_id && detailLoading}
            puuids={puuids}
            onToggle={() => toggleExpand(m.game_id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, match: m });
            }}
          />
        );
        return sessions ? (
          <div className="space-y-4">
            {sessions.map((s) => (
              <div key={s.key}>
                <SessionHeader session={s} />
                <div className="space-y-1">{s.matches.map(renderMatch)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">{matches.map(renderMatch)}</div>
        );
      })()}

      {hasMore && <div ref={sentinelRef} className="h-1" />}
      {loading && matches.length > 0 && (
        <div className="text-center py-3 text-sm text-lol-text">{t("common.loading")}</div>
      )}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          <button
            onClick={() => handleToggleFavorite(contextMenu.match)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-lol-text-bright hover:bg-white/5 text-left"
          >
            <span className={contextMenu.match.favorite ? "text-amber-400" : "text-lol-text"}>
              {contextMenu.match.favorite ? "★" : "☆"}
            </span>
            {contextMenu.match.favorite ? t("history.removeFavorite") : t("history.addFavorite")}
          </button>
          <button
            onClick={() => {
              const gameId = contextMenu.match.game_id;
              setContextMenu(null);
              void exporting.run(gameId, "copy");
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-lol-text-bright hover:bg-white/5 text-left"
          >
            <CopyIcon className="h-3.5 w-3.5 text-lol-text" />
            {t("history.copyImage")}
          </button>
          <button
            onClick={() => {
              const gameId = contextMenu.match.game_id;
              setContextMenu(null);
              void exporting.run(gameId, "save");
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-lol-text-bright hover:bg-white/5 text-left"
          >
            <ImageIcon className="h-3.5 w-3.5 text-lol-text" />
            {t("history.exportPng")}
          </button>
        </ContextMenu>
      )}

      <ExportImageMessage message={exporting.message} />
    </div>
  );
}

// The identity half of the top row: who we are, how the record stands, and how
// the last handful of games went.
function ProfileCard({
  profile,
  dashboard,
}: {
  profile: { name: string | null; profileIcon: number | null } | null;
  dashboard: DashboardData;
}) {
  const losses = dashboard.totalGames - dashboard.wins;
  // Oldest on the left so the strip reads left-to-right in time
  const pips = dashboard.recentForm.slice().reverse();
  const t = useT();

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden bg-lol-card rounded-xl border border-lol-border/60 p-4">
      <span className="pointer-events-none absolute -top-20 -left-10 h-48 w-64 rounded-full bg-lol-gold/[0.07] blur-3xl" />

      <div className="relative flex items-center gap-3">
        <SummonerIcon
          iconId={profile?.profileIcon ?? null}
          size={40}
          className="ring-2 ring-lol-gold/30"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-lol-text-bright truncate">
            {profile?.name ?? t("history.summoner")}
          </div>
          {/* The totals below pool every tracked account, so say when the name
              above only accounts for part of them */}
          <div className="text-[11px] text-lol-text truncate">
            {gamesLabel(t, dashboard.totalGames)}
            {dashboard.totalDuration > 0 &&
              ` · ${t("recap.played", { time: formatPlaytime(dashboard.totalDuration) })}`}
            {dashboard.accounts > 1 && ` · ${t("history.accounts", { count: dashboard.accounts })}`}
          </div>
        </div>
      </div>

      <div className="relative mt-auto">
        <div className="flex items-end justify-between gap-3 mb-1.5">
          <div className="text-2xl font-bold leading-none">
            <span className="text-lol-win">
              {dashboard.wins}
              {t("common.w")}
            </span>{" "}
            <span className="text-lol-loss/70">
              {losses}
              {t("common.l")}
            </span>
          </div>
          <div
            className="flex items-end gap-[3px]"
            title={
              pips.length === 1
                ? t("history.lastGame")
                : t("history.lastGames", { count: pips.length })
            }
          >
            {pips.map((g) => (
              <span
                key={g.game_id}
                className={`h-4 w-[5px] rounded-full ${g.win ? "bg-lol-win" : "bg-lol-loss/70"}`}
              />
            ))}
          </div>
        </div>
        <WinRateBar wins={dashboard.wins} total={dashboard.totalGames} />
      </div>
    </div>
  );
}

// Muted separators keep the three averages on one line in a narrow card
// 0-10 track for the average score, warming up as the score climbs
function ScoreMeter({ score }: { score: number | null }) {
  return (
    <div className="h-1.5 rounded-full bg-lol-border/60 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-lol-gold transition-all"
        style={{ width: `${Math.min(100, Math.max(0, (score ?? 0) * 10))}%` }}
      />
    </div>
  );
}

// MVP is the best player on the winning team and ACE the best on the losing
// one, so each rate is out of the games that could have produced it.
function BadgeCounts({
  mvps,
  aces,
  scoredWins,
  scoredLosses,
}: {
  mvps: number;
  aces: number;
  scoredWins: number;
  scoredLosses: number;
}) {
  const t = useT();
  const rate = (n: number, of: number) => (of > 0 ? `${((n / of) * 100).toFixed(1)}%` : "—");

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
      <span className="rounded bg-amber-400/20 px-1 text-[9px] font-bold leading-[15px] text-amber-300">
        MVP
      </span>
      <span className="text-xs font-semibold text-lol-text-bright">{mvps}</span>
      <span className="text-[11px] text-lol-text" title={t("history.shareWins")}>
        {rate(mvps, scoredWins)}
      </span>

      <span className="rounded bg-purple-500/20 px-1 text-[9px] font-bold leading-[15px] text-purple-400">
        ACE
      </span>
      <span className="text-xs font-semibold text-lol-text-bright">{aces}</span>
      <span className="text-[11px] text-lol-text" title={t("history.shareLosses")}>
        {rate(aces, scoredLosses)}
      </span>
    </div>
  );
}

function ContextMenu({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("click", onClose);
    window.addEventListener("contextmenu", onClose, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("click", onClose);
      window.removeEventListener("contextmenu", onClose, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  // Keep the menu inside the viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) el.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) el.style.top = `${y - rect.height}px`;
  }, [x, y]);

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 min-w-44 py-1 bg-lol-card border border-lol-border rounded-md shadow-lg shadow-black/40"
    >
      {children}
    </div>
  );
}

// One play session's date and combined record, sitting above its rows. A
// session of nothing but remakes has no record to show, so only the count
// survives there.
function SessionHeader({ session }: { session: Session }) {
  const t = useT();
  const played = session.wins + session.losses;
  const ratio = session.deaths > 0 ? (session.kills + session.assists) / session.deaths : Infinity;

  return (
    <div className="flex items-baseline gap-3 px-1 pb-1.5">
      <span className="text-sm font-semibold text-lol-text-bright">{session.label}</span>
      <span className="text-xs text-lol-text">{gamesLabel(t, session.games)}</span>
      {played > 0 && (
        <>
          <span className="text-xs font-semibold">
            <span className="text-lol-win">
              {session.wins}
              {t("common.w")}
            </span>{" "}
            <span className="text-lol-loss/70">
              {session.losses}
              {t("common.l")}
            </span>
          </span>
          <span
            className={`text-xs ${kdaColor(ratio)}`}
            title={formatKDA(session.kills, session.deaths, session.assists)}
          >
            {t("recap.kda", { ratio: kdaRatio(session.kills, session.deaths, session.assists) })}
          </span>
          {session.avgScore != null && (
            <span className={`text-xs font-semibold ${scoreColor(session.avgScore)}`}>
              {session.avgScore.toFixed(1)}
              <span className="font-normal text-lol-text"> {t("history.score")}</span>
            </span>
          )}
        </>
      )}
      <span className="flex-1 self-center border-t border-lol-border/40" />
    </div>
  );
}
