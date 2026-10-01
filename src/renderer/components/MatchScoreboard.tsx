import { MAYHEM_QUEUE_IDS, hasScore } from "../../shared/queues";
import { useMemo, useState, type ReactNode } from "react";
import type { ChampionData, MatchDetail } from "../lib/types";
import type { ParsedParticipant } from "../lib/participants";
import { parseParticipants, groupByTeam } from "../lib/participants";
import { getChampionName } from "../hooks/useChampions";
import { formatCompact, kdaHighlight, kdaRatio, scoreColor } from "../lib/format";
import {
  computeMatchScoreBreakdowns,
  rankByRaw,
  type ScoreBreakdown,
  type ScoreComponent,
  type ScoreComponentKey,
} from "../../shared/opScore";
import { summarizeLobbyRanks } from "../../shared/ranks";
import ChampionIcon from "./ChampionIcon";
import RankIcon from "./RankIcon";
import AugmentIcon from "./AugmentIcon";
import ItemIcon from "./ItemIcon";
import SummonerSpellIcon from "./SummonerSpellIcon";
import MultikillBadge from "./MultikillBadge";
import { ScoreBadge } from "./ScoreCell";
import { useT, type Translate } from "../lib/i18n";
import type { TranslationKey } from "../../shared/i18n";
import Kda from "./Kda";

// The two bars give up 18px each and gold/heal/augments a few more, which
// pays for most of the rank column: a proportional bar with a compact number
// inside reads the same at 92px, whereas the columns it would otherwise push
// off the right edge do not.
//
// The rank gets a column of its own rather than a word on the line under the
// player's name. That line is 80px at the app's own window size and already
// truncates, so a rank there swallowed the champion; and read down a column,
// the whole lobby's ranks compare at a glance, which is the point of showing
// them. The table scrolls sideways when it must, as it already did.
const GRID_COLS = "grid-cols-[52px_minmax(80px,1fr)_64px_64px_72px_92px_92px_52px_52px_176px_92px]";
// A twelfth column is only affordable where the rows are laid out wider than
// the app lays them out: at the app's own window size every column above is
// already at its floor, so the extra would come out of the player name.
const GRID_COLS_MULTIKILLS =
  "grid-cols-[52px_minmax(80px,1fr)_64px_64px_76px_110px_110px_56px_56px_176px_100px_92px]";

export default function MatchScoreboard({
  detail,
  champData,
  puuids,
  multikills = false,
}: {
  detail: MatchDetail;
  champData: ChampionData;
  puuids: string[] | null;
  // Off by default: only a caller that knows its rows are wide should ask
  multikills?: boolean;
}) {
  const t = useT();
  const participants = useMemo(
    () =>
      parseParticipants(detail.participants, puuids).map((p) => ({
        ...p,
        augments: MAYHEM_QUEUE_IDS.includes(detail.game.queue_id) ? p.augments : [],
      })),
    [detail, puuids],
  );
  const teams = useMemo(() => groupByTeam(participants), [participants]);
  const scores = useMemo(() => {
    if (detail.game.is_remake || !hasScore(detail.game.queue_id))
      return new Map<number, ScoreBreakdown>();
    const classes: Record<number, string | undefined> = {};
    for (const p of participants) classes[p.championId] = champData[p.championId]?.class;
    return computeMatchScoreBreakdowns(participants, classes, detail.game.queue_id);
  }, [participants, champData, detail.game.queue_id, detail.game.is_remake]);

  // Everyone's place in the game, so a row can say "3.º" and not just "7.3".
  // The same rule the stored placement uses, from the same module, so the
  // history row and this table can never disagree.
  const ranks = useMemo(() => rankByRaw(scores), [scores]);

  const gameMaxStats = useMemo(() => {
    let dmg = 0,
      taken = 0,
      gold = 0,
      heal = 0;
    for (const p of participants) {
      if (p.totalDamageDealtToChampions > dmg) dmg = p.totalDamageDealtToChampions;
      if (p.totalDamageTaken > taken) taken = p.totalDamageTaken;
      if (p.goldEarned > gold) gold = p.goldEarned;
      if (p.totalHeal > heal) heal = p.totalHeal;
    }
    return { dmg: dmg || 1, taken: taken || 1, gold: gold || 1, heal: heal || 1 };
  }, [participants]);

  // What can be said about the lobby's ranks: an average only when more than
  // half of them have one, and always the count it was drawn from.
  const lobby = useMemo(
    () => summarizeLobbyRanks(participants.map((p) => p.rank ?? null)),
    [participants],
  );

  if (participants.length === 0) {
    return <div className="text-sm text-lol-text text-center py-4">{t("scoreboard.noData")}</div>;
  }

  return (
    <div className="space-y-3">
      {lobby.ranked > 0 && <LobbyRankLine lobby={lobby} />}
      {Array.from(teams.entries()).map(([teamId, players]) => (
        <TeamScoreboard
          key={teamId}
          teamId={teamId}
          players={players}
          maxStats={gameMaxStats}
          champData={champData}
          scores={scores}
          ranks={ranks}
          total={scores.size}
          patch={detail.game.game_version}
          multikills={multikills}
        />
      ))}
    </div>
  );
}

function TeamScoreboard({
  teamId,
  players,
  maxStats,
  champData,
  scores,
  ranks,
  total,
  patch,
  multikills,
}: {
  teamId: number;
  players: ParsedParticipant[];
  maxStats: { dmg: number; taken: number; gold: number; heal: number };
  champData: ChampionData;
  scores: Map<number, ScoreBreakdown>;
  ranks: Map<number, number>;
  total: number;
  patch?: string | null;
  multikills: boolean;
}) {
  const t = useT();
  const isWin = players[0]?.win ?? false;
  const totals = useMemo(() => computeTeamTotals(players, scores), [players, scores]);

  // The team panel paints its own background rather than borrowing whatever is
  // behind it: inside the app that's the panel it sits in, but an exported card
  // has the page's gradient back there.
  return (
    <div className="rounded-lg border border-lol-border bg-lol-card overflow-hidden">
      {/* Team header: name on the left, team totals filling the rest of the bar */}
      <div
        className={`px-3 py-1.5 border-b border-lol-border flex flex-wrap items-baseline gap-x-4 gap-y-1 ${isWin ? "bg-lol-win/10" : "bg-lol-loss/10"}`}
      >
        <span className={`text-xs font-bold ${isWin ? "text-lol-win" : "text-lol-loss"}`}>
          {teamId === 100
            ? t("live.teamN", { n: 1 })
            : teamId === 200
              ? t("live.teamN", { n: 2 })
              : teamId > 0
                ? t("live.teamN", { n: teamId })
                : t("live.teamUnknown")}{" "}
          —{" "}
          {players[0]?.placement
            ? t("scoreboard.place", { n: players[0].placement })
            : isWin
              ? t("common.victory")
              : t("common.defeat")}
        </span>
        <div className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <TeamStat label={t("scoreboard.avgScore")}>
            <span
              className={totals.avgScore != null ? scoreColor(totals.avgScore) : "text-lol-text"}
            >
              {totals.avgScore != null ? totals.avgScore.toFixed(1) : "-"}
            </span>
          </TeamStat>
          <TeamStat label={t("live.kda")}>
            <span className="text-lol-text-bright">
              <Kda kills={totals.kills} deaths={totals.deaths} assists={totals.assists} />
            </span>
          </TeamStat>
          <TeamStat label={t("recap.damage")}>
            <span className="text-red-400">{formatCompact(totals.dmg)}</span>
          </TeamStat>
          <TeamStat label={t("recap.taken")}>
            <span className="text-sky-400">{formatCompact(totals.taken)}</span>
          </TeamStat>
          <TeamStat label={t("recap.gold")}>
            <span className="text-lol-gold">{formatCompact(totals.gold)}</span>
          </TeamStat>
          <TeamStat label={t("scoreboard.heal")}>
            <span className="text-emerald-400">{formatCompact(totals.heal)}</span>
          </TeamStat>
        </div>
      </div>

      {/* Column headers */}
      <div
        className={`px-3 py-1 border-b border-lol-border/50 grid ${
          multikills ? GRID_COLS_MULTIKILLS : GRID_COLS
        } gap-2 items-center text-[10px] text-lol-text uppercase tracking-wider`}
      >
        <span></span>
        <span>{t("live.player")}</span>
        <span className="text-center">{t("scoreboard.rank")}</span>
        <span className="text-center">{t("scoreboard.score")}</span>
        <span className="text-center">{t("live.kda")}</span>
        <span className="text-center">{t("recap.damage")}</span>
        <span className="text-center">{t("recap.taken")}</span>
        <span className="text-right">{t("recap.gold")}</span>
        <span className="text-right">{t("scoreboard.heal")}</span>
        <span>{t("live.items")}</span>
        <span>{t("scoreboard.augments")}</span>
        {multikills && <span>{t("scoreboard.multis")}</span>}
      </div>

      {/* Player rows */}
      {players.map((p) => (
        <PlayerRow
          key={p.participantId}
          player={p}
          maxStats={maxStats}
          champData={champData}
          score={scores.get(p.participantId)}
          rank={ranks.get(p.participantId)}
          total={total}
          patch={patch}
          multikills={multikills}
        />
      ))}
    </div>
  );
}

function computeTeamTotals(players: ParsedParticipant[], scores: Map<number, ScoreBreakdown>) {
  const t = {
    kills: 0,
    deaths: 0,
    assists: 0,
    dmg: 0,
    taken: 0,
    gold: 0,
    heal: 0,
    avgScore: null as number | null,
  };
  let scoreSum = 0,
    scored = 0;

  for (const p of players) {
    t.kills += p.kills;
    t.deaths += p.deaths;
    t.assists += p.assists;
    t.dmg += p.totalDamageDealtToChampions;
    t.taken += p.totalDamageTaken;
    t.gold += p.goldEarned;
    t.heal += p.totalHeal;
    const s = scores.get(p.participantId);
    if (s) {
      scoreSum += s.score;
      scored++;
    }
  }
  if (scored > 0) t.avgScore = scoreSum / scored;
  return t;
}

function TeamStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[9px] uppercase tracking-wider text-lol-text">{label}</span>
      <span className="text-[11px] font-medium tabular-nums">{children}</span>
    </div>
  );
}

function ScoreboardBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-4 bg-white/5 rounded-sm overflow-hidden relative">
      <div className={`h-full rounded-sm ${color}`} style={{ width: `${pct}%` }} />
      <span className="absolute inset-0 flex items-center justify-end pr-1 text-[10px] font-medium text-white/90 leading-none tabular-nums">
        {formatCompact(value)}
      </span>
    </div>
  );
}

function PlayerRow({
  player: p,
  maxStats,
  champData,
  score,
  rank,
  total,
  patch,
  multikills,
}: {
  player: ParsedParticipant;
  maxStats: { dmg: number; taken: number; gold: number; heal: number };
  champData: ChampionData;
  score?: ScoreBreakdown;
  rank?: number;
  total: number;
  patch?: string | null;
  multikills: boolean;
}) {
  const t = useT();
  const kda = kdaRatio(p.kills, p.deaths, p.assists);

  return (
    <div
      className={`px-3 py-1.5 border-b border-lol-border/30 last:border-b-0 grid ${
        multikills ? GRID_COLS_MULTIKILLS : GRID_COLS
      } gap-2 items-center ${p.isSelf ? "border-l-2 border-l-lol-gold bg-lol-gold/5" : ""}`}
    >
      {/* Champion + spells; two 15px spells and the 2px gap match the 32px portrait */}
      <div className="flex items-center gap-0.5">
        <ChampionIcon championId={p.championId} size={32} />
        <div className="flex flex-col gap-0.5">
          <SummonerSpellIcon spellId={p.spell1Id} size={15} />
          <SummonerSpellIcon spellId={p.spell2Id} size={15} />
        </div>
      </div>

      {/* Player name */}
      <div className="min-w-0">
        <div
          className={`text-xs truncate ${p.isSelf ? "text-lol-gold font-semibold" : "text-lol-text-bright"}`}
        >
          {p.summonerName}
        </div>
        <div className="text-[10px] text-lol-text truncate">
          {getChampionName(champData, p.championId)}
          {p.cs != null && ` · ${p.cs} CS`}
          {p.vision != null && ` · ${t("scoreboard.vision", { count: p.vision })}`}
          {p.position && ` · ${p.position}`}
        </div>
      </div>

      {/* Rank when the game is one the app was there for; see shared/ranks */}
      <div className="flex justify-center leading-tight">
        {p.rank ? (
          <RankIcon rank={p.rank} />
        ) : (
          <span className="text-[10px] text-lol-text/50">—</span>
        )}
      </div>

      {/* Score, with where this player placed among the ten */}
      <ScoreCell score={score} rank={rank} total={total} />

      {/* KDA */}
      <div className="text-center">
        <div className="text-[11px] text-lol-text-bright">
          <Kda kills={p.kills} deaths={p.deaths} assists={p.assists} />
        </div>
        <div className={`text-[10px] ${kdaHighlight(kda)}`}>{kda}</div>
      </div>

      {/* Damage dealt */}
      <ScoreboardBar
        value={p.totalDamageDealtToChampions}
        max={maxStats.dmg}
        color="bg-red-400/50"
      />

      {/* Damage taken */}
      <ScoreboardBar value={p.totalDamageTaken} max={maxStats.taken} color="bg-sky-400/50" />

      {/* Gold */}
      <div className="text-right text-[11px] text-lol-gold tabular-nums">
        {formatCompact(p.goldEarned)}
      </div>

      {/* Heal */}
      <div className="text-right text-[11px] text-emerald-400 tabular-nums">
        {formatCompact(p.totalHeal)}
      </div>

      {/* Items */}
      <div className="flex gap-0.5">
        {p.items.slice(0, 6).map((itemId, i) => (
          <ItemIcon key={i} itemId={itemId} size={22} patch={patch} />
        ))}
        <div className="ml-0.5">
          <ItemIcon itemId={p.items[6] ?? 0} size={22} patch={patch} />
        </div>
      </div>

      {/* Augments */}
      <div className="flex gap-0.5">
        {p.augments.map((augId, i) => (
          <AugmentIcon key={i} augmentId={augId} size={22} patch={patch} />
        ))}
      </div>

      {/* Multikills */}
      {multikills && (
        <div className="flex">
          <MultikillBadge
            compact
            doubles={p.doubleKills}
            triples={p.tripleKills}
            quadras={p.quadraKills}
            pentas={p.pentaKills}
          />
        </div>
      )}
    </div>
  );
}

// The score, and under it where this player placed in the game. The badge
// shares that second line rather than replacing the place: MVP is the best of
// a team, which is not the same thing as being first of the ten.
function ScoreCell({
  score,
  rank,
  total,
}: {
  score?: ScoreBreakdown;
  rank?: number;
  total: number;
}) {
  const t = useT();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  return (
    <div
      className={`text-center ${score ? "cursor-help" : ""}`}
      onMouseEnter={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setAnchor(null)}
    >
      <div
        className={`text-[11px] font-semibold tabular-nums ${score ? scoreColor(score.score) : "text-lol-text"}`}
      >
        {score ? score.score.toFixed(1) : "-"}
      </div>
      {score && (rank != null || score.badge) && (
        // Three tracks so the place sits dead centre on every row, badge or
        // no badge, and the column of places reads straight down. The two
        // outer tracks are minmax(0,1fr) so a badge cannot widen its own
        // track and push the place off centre; it just hangs to the right,
        // spilling a few pixels into the column gap, which is empty anyway.
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center leading-none">
          <span />
          {rank != null ? (
            <span
              className={`text-[10px] tabular-nums ${rank === 1 ? "text-lol-gold" : "text-lol-text"}`}
            >
              {t("history.placeShort", { rank })}
            </span>
          ) : (
            <span />
          )}
          <span className="justify-self-start pl-1">
            {score.badge && <ScoreBadge badge={score.badge} inline />}
          </span>
        </div>
      )}
      {score && anchor && (
        <ScoreBreakdownTooltip breakdown={score} rank={rank} total={total} anchor={anchor} />
      )}
    </div>
  );
}

const COMPONENT_LABELS: Record<ScoreComponentKey, TranslationKey> = {
  kda: "score.kda",
  kp: "score.kp",
  dmg: "score.dmg",
  taken: "score.taken",
  heal: "score.heal",
  gold: "score.gold",
};

// How the player's stat and its full-credit reference read in the tooltip:
// kda/kp are graded against fixed caps, the rest against the lobby's best.
function componentValue(c: ScoreComponent, t: Translate): string {
  if (c.key === "kda") return t("score.fullAt", { value: c.value.toFixed(1), cap: "8" });
  if (c.key === "kp") {
    return t("score.fullAt", { value: `${Math.round(c.value * 100)}%`, cap: "90%" });
  }
  return `${formatCompact(c.value)} / ${formatCompact(c.reference)}`;
}

function ScoreBreakdownTooltip({
  breakdown,
  rank,
  total,
  anchor,
}: {
  breakdown: ScoreBreakdown;
  rank?: number;
  total: number;
  anchor: DOMRect;
}) {
  const t = useT();
  const rows =
    breakdown.components.length +
    (breakdown.multikill ? 1 : 0) +
    (breakdown.carry ? 1 : 0) +
    (breakdown.win > 0 ? 1 : 0) +
    (rank != null ? 1 : 0);
  const width = 288;
  const height = 74 + rows * 20;
  // Fixed positioning escapes the team card's overflow-hidden; clamp to the
  // viewport so rows near the window edges stay readable.
  const left = Math.min(anchor.right + 10, window.innerWidth - width - 8);
  const top = Math.min(
    Math.max(anchor.top + anchor.height / 2 - height / 2, 8),
    window.innerHeight - height - 8,
  );
  const clamped = breakdown.raw !== breakdown.score && (breakdown.raw > 10 || breakdown.raw < 1);

  return (
    <div
      className="fixed z-50 pointer-events-none bg-lol-dark border border-lol-border rounded-lg px-3 py-2 shadow-lg text-left"
      style={{ left, top, width }}
    >
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-lol-text-bright">{t("score.breakdown")}</span>
        <span className="text-[10px] text-lol-text">
          {breakdown.cls
            ? t("score.classWeights", { cls: breakdown.cls })
            : t("score.standardWeights")}
        </span>
      </div>
      {breakdown.components.map((c) => (
        <div key={c.key} className="grid grid-cols-[1fr_auto] gap-2 items-baseline leading-5">
          <span className="text-[11px] text-lol-text truncate">
            {t(COMPONENT_LABELS[c.key])}
            <span className="ml-1.5 text-[10px] text-lol-text/70">{componentValue(c, t)}</span>
          </span>
          <span className="text-[11px] tabular-nums text-lol-text-bright">
            {c.points.toFixed(1)}
            <span className="text-[10px] text-lol-text/70"> / {c.weight.toFixed(1)}</span>
          </span>
        </div>
      ))}
      {breakdown.multikill && (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-baseline leading-5">
          <span className="text-[11px] text-lol-text">
            {t("score.multikillBonus", { label: breakdown.multikill.label })}
          </span>
          <span className="text-[11px] tabular-nums text-lol-text-bright">
            +{breakdown.multikill.points.toFixed(1)}
          </span>
        </div>
      )}
      {breakdown.carry && (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-baseline leading-5">
          <span className="text-[11px] text-lol-text">
            {t("score.carryBonus")}
            <span className="ml-1.5 text-[10px] text-lol-text/70">
              {t("score.nextBest", { lead: breakdown.carry.lead.toFixed(2) })}
            </span>
          </span>
          <span className="text-[11px] tabular-nums text-lol-text-bright">
            +{breakdown.carry.points.toFixed(1)}
          </span>
        </div>
      )}
      {breakdown.win > 0 && (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-baseline leading-5">
          <span className="text-[11px] text-lol-text">{t("score.victoryBonus")}</span>
          <span className="text-[11px] tabular-nums text-lol-text-bright">
            +{breakdown.win.toFixed(1)}
          </span>
        </div>
      )}
      {rank != null && (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-baseline leading-5">
          <span className="text-[11px] text-lol-text">{t("score.place")}</span>
          <span className="text-[11px] tabular-nums text-lol-text-bright">
            {t("history.placeOf", { rank, total })}
          </span>
        </div>
      )}
      <div className="mt-1 pt-1 border-t border-lol-border/50 grid grid-cols-[1fr_auto] gap-2 items-baseline">
        <span className="text-[11px] font-medium text-lol-text-bright">
          {t("score.total")}
          {clamped
            ? t(breakdown.raw > 10 ? "score.capped" : "score.floored", {
                raw: breakdown.raw.toFixed(2),
              })
            : ""}
        </span>
        <span className={`text-xs font-semibold tabular-nums ${scoreColor(breakdown.score)}`}>
          {breakdown.score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

/**
 * One line above the two teams with what the lobby was ranked.
 *
 * The count is always there and the average only sometimes, which is the
 * point: in ARAM two ranked players out of ten is normal, and an "average"
 * drawn from two would read as a fact about the game when it is a fact about
 * two people. Above half it is still an approximation, so it says out loud
 * how many it came from.
 */
function LobbyRankLine({ lobby }: { lobby: ReturnType<typeof summarizeLobbyRanks> }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 px-1 text-[11px]">
      {lobby.average ? (
        <>
          <span className="flex items-center gap-1.5 text-lol-text-bright">
            {t("rank.lobbyAverageLabel")}
            <RankIcon rank={lobby.average} size={16} />
          </span>
          <span className="text-[10px] text-lol-text">
            {t("rank.lobbyOf", { ranked: lobby.ranked, total: lobby.total })}
          </span>
        </>
      ) : (
        <span className="text-[10px] text-lol-text">
          {t("rank.lobbyFew", { ranked: lobby.ranked, total: lobby.total })}
        </span>
      )}
    </div>
  );
}
