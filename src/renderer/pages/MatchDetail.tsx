import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useIpc } from "../hooks/useIpc";
import { useChampionData, getChampionName } from "../hooks/useChampions";
import type {
  ChampionData,
  GameRecap,
  MatchDetail as MatchDetailData,
  MatchParticipantRecord,
} from "../lib/types";
import type { MatchExtras, MatchPlayerExtras, MatchTeamStats } from "../../shared/match-detail";
import {
  barWidth,
  detailSections,
  maxOf,
  perMinute,
  splitTotal,
  type DetailSections,
} from "../../shared/match-detail";
import { hasScore } from "../../shared/queues";
import { queueLabel } from "../components/QueueSelect";
import { EmptyState, PageLoading } from "../components/PageState";
import ChampionIcon from "../components/ChampionIcon";
import VerdictLines from "../components/VerdictLines";
import PerkIcon from "../components/PerkIcon";
import { GoldChart, KillMap, type TimelinePlayer } from "../components/MatchTimeline";
import { hasChart, hasMap, type MatchTimeline } from "../../shared/match-timeline";
import Kda from "../components/Kda";
import { LOCALE, formatDateTime, formatDuration, kdaRatio } from "../lib/format";
import { useT, type Translate } from "../lib/i18n";
import type { TranslationKey } from "../../shared/i18n";

// The bars all share one shape: a track the width of the column, filled from
// the left, on one scale per section so two rows can be compared by eye.
const TRACK = "h-4 rounded-sm bg-lol-dark overflow-hidden flex";

const DEALT_COLORS = ["bg-lol-gold", "bg-sky-400", "bg-lol-text-bright"] as const;
const DEALT_LABELS = ["detail.physical", "detail.magic", "detail.true"] as const;

const num = (value: number) => value.toLocaleString(LOCALE);
const oneDecimal = (value: number) => value.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

/** A player's row on this page: the scoreboard record plus the extra numbers. */
// Extends TimelinePlayer as well as the payload's numbers, so the chart and
// the map can take these rows straight, and a field renamed on either side
// stops compiling rather than quietly emptying a tooltip.
interface Row extends MatchPlayerExtras, TimelinePlayer {}

export default function MatchDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const id = Number(gameId);
  const t = useT();
  const champData = useChampionData();
  const [puuids, setPuuids] = useState<string[] | null>(null);

  useEffect(() => {
    window.api.getAllSummonerPuuids().then(setPuuids);
  }, []);

  const { data: detail, loading: detailLoading } = useIpc<MatchDetailData | null>(
    () => window.api.getMatchDetail(id),
    [id],
  );
  const { data: extras, loading: extrasLoading } = useIpc<MatchExtras | null>(
    () => window.api.getMatchExtras(id),
    [id],
  );
  const { data: recap } = useIpc<GameRecap | null>(() => window.api.getGameRecap(id), [id]);
  // Its own request, not part of the page's loading gate: a game captured
  // before v0.7.9 has no timeline, and the rest of the page should not wait
  // for that answer or vanish because of it.
  const { data: timeline } = useIpc<MatchTimeline | null>(
    () => window.api.getMatchTimeline(id),
    [id],
  );

  const rows = useMemo(
    () => buildRows(detail, extras, champData, puuids),
    [detail, extras, champData, puuids],
  );
  const sections = useMemo(() => (extras ? detailSections(extras) : null), [extras]);

  if (!Number.isSafeInteger(id) || id <= 0)
    return <EmptyState>{t("detail.missingGame")}</EmptyState>;
  if (detailLoading || extrasLoading) return <PageLoading />;
  if (!detail) return <EmptyState>{t("detail.missingGame")}</EmptyState>;

  return (
    <div className="flex flex-col gap-4 p-4">
      <nav className="flex items-center gap-2 text-xs">
        <Link to="/" className="text-lol-gold transition-colors hover:text-lol-gold-light">
          <span aria-hidden>← </span>
          {t("detail.back")}
        </Link>
        <span className="text-lol-border">/</span>
        <span className="text-lol-text">{t("detail.title")}</span>
        <span className="ml-auto tabular-nums text-lol-text/50">{detail.game.game_id}</span>
      </nav>

      <Header detail={detail} champData={champData} t={t} />
      {recap && (
        <div className="rounded-lg border border-lol-gold/25 bg-lol-gold/[0.06] px-4 py-3">
          <VerdictLines recap={recap} />
        </div>
      )}

      {!extras || !sections || rows.length === 0 ? (
        <EmptyState>{t("detail.missingPayload")}</EmptyState>
      ) : (
        <>
          <DamageDealt rows={rows} t={t} />
          <DamageTaken rows={rows} t={t} />
          <div className="grid gap-4 @3xl:grid-cols-2">
            <SecondsCard
              title={t("detail.cc")}
              hint={t("detail.ccHint")}
              rows={rows}
              pick={(r) => r.ccTime}
              render={(value) => t("detail.seconds", { count: num(value) })}
              color="bg-sky-400"
            />
            <SecondsCard
              title={t("detail.alive")}
              hint={t("detail.aliveHint")}
              rows={rows}
              pick={(r) => r.longestAlive}
              render={(value) => formatDuration(value)}
              color="bg-lol-win"
            />
          </div>
          {sections.runes && <Runes rows={rows} patch={detail.game.game_version} t={t} />}
          {sections.bans && <Bans teams={extras.teams} champData={champData} t={t} />}
          <Objectives teams={extras.teams} rows={rows} sections={sections} t={t} />
          {sections.vision && <Vision rows={rows} t={t} />}
          {sections.economy && <Economy rows={rows} duration={detail.game.game_duration} t={t} />}
          {sections.objectiveDamage && <ObjectiveDamage rows={rows} t={t} />}
          {hasChart(timeline) && (
            <GoldChart timeline={timeline!} players={rows} duration={detail.game.game_duration} />
          )}
          {hasMap(timeline) && <KillMap timeline={timeline!} players={rows} />}
          <YourGame detail={detail} rows={rows} t={t} />
          <MissingNote sections={sections} t={t} />
        </>
      )}
    </div>
  );
}

/**
 * Joins the scoreboard's rows to the payload's, by participant id.
 *
 * The two come from different queries and either may be missing, so a player
 * the scoreboard knows but the payload doesn't is simply left out rather than
 * drawn with zeroes.
 */
function buildRows(
  detail: MatchDetailData | null,
  extras: MatchExtras | null,
  champData: ChampionData,
  puuids: string[] | null,
): Row[] {
  if (!detail || !extras) return [];
  const byId = new Map<number, MatchParticipantRecord>();
  for (const p of detail.participants) byId.set(p.participantId, p);

  return extras.players.map((player) => {
    const record = byId.get(player.participantId);
    return {
      ...player,
      name: record?.gameName || `Player ${player.participantId}`,
      championName: getChampionName(champData, player.championId),
      isSelf: puuids != null && record?.puuid != null && puuids.includes(record.puuid),
    };
  });
}

function Card({
  title,
  hint,
  legend,
  children,
}: {
  title: string;
  hint?: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-lol-border/60 bg-lol-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-lol-text-bright">{title}</h2>
        {hint && <span className="text-xs text-lol-text/60">{hint}</span>}
        {legend && <div className="ml-auto flex items-center gap-4 text-[11px]">{legend}</div>}
      </div>
      {children}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-xs ${color}`} />
      {label}
    </span>
  );
}

/** One player's line. The gold tint is the only thing marking your own row. */
function PlayerRow({ row, children }: { row: Row; children: ReactNode }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-sm px-2 py-1 ${
        row.isSelf ? "border-l-2 border-lol-gold bg-lol-gold/10" : "border-l-2 border-transparent"
      }`}
    >
      <ChampionIcon championId={row.championId} size={22} />
      <span
        className={`w-24 shrink-0 truncate text-xs ${
          row.isSelf ? "font-semibold text-lol-gold-light" : "text-lol-text-bright"
        }`}
        title={row.championName}
      >
        {row.championName}
      </span>
      <span
        className="hidden w-28 shrink-0 truncate text-xs text-lol-text @2xl:block"
        title={row.name}
      >
        {row.name}
      </span>
      {children}
    </div>
  );
}

function DamageDealt({ rows, t }: { rows: Row[]; t: Translate }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => splitTotal(b.dealt) - splitTotal(a.dealt)),
    [rows],
  );
  const max = maxOf(sorted, (r) => splitTotal(r.dealt));
  return (
    <Card
      title={t("detail.damage")}
      hint={t("detail.damageHint")}
      legend={DEALT_LABELS.map((label, i) => (
        <LegendDot key={label} color={DEALT_COLORS[i]} label={t(label)} />
      ))}
    >
      <div className="flex flex-col gap-1 tabular-nums">
        {sorted.map((row) => {
          const parts = [row.dealt.physical, row.dealt.magic, row.dealt.trueDamage];
          return (
            <PlayerRow key={row.participantId} row={row}>
              <span className={`min-w-0 flex-1 ${TRACK}`}>
                {parts.map((value, i) => (
                  <span
                    key={i}
                    className={DEALT_COLORS[i]}
                    style={{ width: `${barWidth(value, max)}%` }}
                  />
                ))}
              </span>
              <span className="w-16 shrink-0 text-right text-xs font-semibold text-lol-text-bright">
                {num(splitTotal(row.dealt))}
              </span>
            </PlayerRow>
          );
        })}
      </div>
    </Card>
  );
}

function DamageTaken({ rows, t }: { rows: Row[]; t: Translate }) {
  const total = (row: Row) => splitTotal(row.taken) + row.selfMitigated;
  const sorted = useMemo(() => [...rows].sort((a, b) => total(b) - total(a)), [rows]);
  const max = maxOf(sorted, total);
  return (
    <Card
      title={t("detail.taken")}
      hint={t("detail.takenHint")}
      legend={
        <>
          <LegendDot color="bg-lol-loss" label={t("detail.takenLegend")} />
          <LegendDot color="bg-lol-text/40" label={t("detail.mitigated")} />
        </>
      }
    >
      <div className="flex flex-col gap-1 tabular-nums">
        {sorted.map((row) => (
          <PlayerRow key={row.participantId} row={row}>
            <span className={`min-w-0 flex-1 ${TRACK}`}>
              <span
                className="bg-lol-loss"
                style={{ width: `${barWidth(splitTotal(row.taken), max)}%` }}
              />
              <span
                className="bg-lol-text/40"
                style={{ width: `${barWidth(row.selfMitigated, max)}%` }}
              />
            </span>
            <span className="w-14 shrink-0 text-right text-xs text-lol-text-bright">
              {num(splitTotal(row.taken))}
            </span>
            <span className="w-14 shrink-0 text-right text-xs text-lol-text">
              {num(row.selfMitigated)}
            </span>
          </PlayerRow>
        ))}
      </div>
    </Card>
  );
}

function SecondsCard({
  title,
  hint,
  rows,
  pick,
  render,
  color,
}: {
  title: string;
  hint: string;
  rows: Row[];
  pick: (row: Row) => number;
  render: (value: number) => string;
  color: string;
}) {
  const sorted = useMemo(() => [...rows].sort((a, b) => pick(b) - pick(a)), [rows, pick]);
  const max = maxOf(sorted, pick);
  return (
    <Card title={title} hint={hint}>
      <div className="flex flex-col gap-1 tabular-nums">
        {sorted.map((row) => (
          <PlayerRow key={row.participantId} row={row}>
            <span className="min-w-0 flex-1 h-3 rounded-sm bg-lol-dark overflow-hidden flex">
              <span
                className={row.isSelf ? "bg-lol-gold" : color}
                style={{ width: `${barWidth(pick(row), max)}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-xs text-lol-text">
              {render(pick(row))}
            </span>
          </PlayerRow>
        ))}
      </div>
    </Card>
  );
}

function ObjectiveDamage({ rows, t }: { rows: Row[]; t: Translate }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.toObjectives - a.toObjectives), [rows]);
  const max = maxOf(sorted, (r) => r.toObjectives);
  return (
    <Card title={t("detail.objectiveDamage")} hint={t("detail.objectiveDamageHint")}>
      <div className="flex flex-col gap-1 tabular-nums">
        {sorted.map((row) => (
          <PlayerRow key={row.participantId} row={row}>
            <span className="min-w-0 flex-1 h-3 rounded-sm bg-lol-dark overflow-hidden flex">
              <span
                className={row.isSelf ? "bg-lol-gold" : "bg-lol-text/40"}
                style={{ width: `${barWidth(row.toObjectives, max)}%` }}
              />
            </span>
            <span className="w-16 shrink-0 text-right text-xs text-lol-text-bright">
              {num(row.toObjectives)}
            </span>
          </PlayerRow>
        ))}
      </div>
    </Card>
  );
}

function Vision({ rows, t }: { rows: Row[]; t: Translate }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.visionScore - a.visionScore), [rows]);
  const max = maxOf(sorted, (r) => r.visionScore);
  return (
    <Card title={t("detail.vision")} hint={t("detail.visionHint")}>
      <div className="flex flex-col gap-1 tabular-nums">
        {sorted.map((row) => (
          <PlayerRow key={row.participantId} row={row}>
            <span className="min-w-0 flex-1 h-3 rounded-sm bg-lol-dark overflow-hidden flex">
              <span
                className={row.isSelf ? "bg-lol-gold" : "bg-sky-400"}
                style={{ width: `${barWidth(row.visionScore, max)}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right text-xs text-lol-text-bright">
              {num(row.visionScore)}
            </span>
            <span className="w-16 shrink-0 text-right text-xs text-lol-text">
              {t("detail.wardsOf", { placed: num(row.wardsPlaced), killed: num(row.wardsKilled) })}
            </span>
          </PlayerRow>
        ))}
      </div>
    </Card>
  );
}

function Economy({ rows, duration, t }: { rows: Row[]; duration: number; t: Translate }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.cs - a.cs), [rows]);
  const max = maxOf(sorted, (r) => r.cs);
  return (
    <Card
      title={t("detail.economy")}
      hint={t("detail.economyHint", { duration: formatDuration(duration) })}
    >
      <div className="flex flex-col gap-1 tabular-nums">
        {sorted.map((row) => (
          <PlayerRow key={row.participantId} row={row}>
            <span className="min-w-0 flex-1 h-3 rounded-sm bg-lol-dark overflow-hidden flex">
              <span
                className={row.isSelf ? "bg-lol-gold" : "bg-lol-win"}
                style={{ width: `${barWidth(row.cs, max)}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-xs text-lol-text-bright">
              {oneDecimal(perMinute(row.cs, duration))}
            </span>
            <span className="w-20 shrink-0 text-right text-xs text-lol-text">
              {t("detail.goldPerMin", {
                value: num(Math.round(perMinute(row.goldEarned, duration))),
              })}
            </span>
          </PlayerRow>
        ))}
      </div>
    </Card>
  );
}

function Bans({
  teams,
  champData,
  t,
}: {
  teams: MatchTeamStats[];
  champData: ChampionData;
  t: Translate;
}) {
  return (
    <Card title={t("detail.bans")}>
      <div className="flex flex-col gap-2">
        {teams.map((team) => (
          <div key={team.teamId} className="flex flex-wrap items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${teamDot(team.teamId)}`} />
            <span className="w-24 shrink-0 text-xs text-lol-text">{teamLabel(team.teamId, t)}</span>
            {team.bans.map((championId, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-sm border border-lol-border/60 bg-lol-dark px-2 py-1 text-xs text-lol-text"
              >
                <ChampionIcon championId={championId} size={18} />
                {getChampionName(champData, championId)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Everyone's runes, one row each.
 *
 * The keystone is drawn bigger than the three minor runes of its tree, and
 * the secondary pair sits after a divider, which is the shape the client
 * uses and the only thing that makes six circles readable at a glance.
 */
function Runes({ rows, patch, t }: { rows: Row[]; patch?: string | null; t: Translate }) {
  return (
    <Card title={t("detail.runes")} hint={t("detail.runesHint")}>
      <div className="flex flex-col gap-1">
        {rows.map((row) => {
          const [keystone, ...rest] = row.perks.selected;
          const primary = rest.slice(0, 3);
          const secondary = rest.slice(3);
          return (
            <PlayerRow key={row.participantId} row={row}>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <PerkIcon perkId={keystone ?? 0} size={26} patch={patch} />
                {primary.map((id, i) => (
                  <PerkIcon key={i} perkId={id} size={19} patch={patch} />
                ))}
                <span aria-hidden className="mx-1 h-4 w-px bg-lol-border" />
                <PerkIcon perkId={row.perks.subStyle} size={16} patch={patch} />
                {secondary.map((id, i) => (
                  <PerkIcon key={i} perkId={id} size={19} patch={patch} />
                ))}
              </span>
            </PlayerRow>
          );
        })}
      </div>
    </Card>
  );
}

function teamDot(teamId: number): string {
  if (teamId === 100) return "bg-sky-400";
  if (teamId === 200) return "bg-lol-loss";
  return "bg-lol-text/50";
}

function teamLabel(teamId: number, t: Translate): string {
  if (teamId === 100) return t("detail.teamBlue");
  if (teamId === 200) return t("detail.teamRed");
  return t("detail.teamOther", { id: teamId });
}

/**
 * Structures for every queue, epic monsters only where the map has them.
 *
 * Arena has neither and no teams to speak of, so with nothing to count the
 * whole card stays away rather than drawing empty cards per squad.
 */
function Objectives({
  teams,
  rows,
  sections,
  t,
}: {
  teams: MatchTeamStats[];
  rows: Row[];
  sections: DetailSections;
  t: Translate;
}) {
  const selfTeam = rows.find((row) => row.isSelf)?.teamId;
  const shown = teams.filter(
    (team) => team.towers + team.inhibitors + team.dragons + team.barons + team.heralds > 0,
  );
  if (shown.length === 0) return null;

  const counters = (team: MatchTeamStats) => {
    const base: { value: number; label: TranslationKey }[] = [
      { value: team.towers, label: "detail.towers" },
      { value: team.inhibitors, label: "detail.inhibitors" },
    ];
    if (!sections.epics) return base;
    return [
      ...base,
      { value: team.dragons, label: "detail.dragons" as TranslationKey },
      { value: team.barons, label: "detail.barons" as TranslationKey },
      { value: team.heralds, label: "detail.heralds" as TranslationKey },
    ];
  };

  return (
    <Card
      title={sections.epics ? t("detail.objectives") : t("detail.structures")}
      hint={sections.epics ? t("detail.objectivesHint") : undefined}
    >
      <div className="grid gap-3 @2xl:grid-cols-2">
        {shown.map((team) => (
          <div
            key={team.teamId}
            className={`rounded-md border p-3 ${
              team.teamId === selfTeam
                ? "border-lol-gold/30 bg-lol-gold/[0.06]"
                : "border-lol-border/60 bg-lol-dark"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className={`size-2 rounded-full ${teamDot(team.teamId)}`} />
              <span className="text-xs font-semibold text-lol-text-bright">
                {teamLabel(team.teamId, t)}
              </span>
              {team.teamId === selfTeam && (
                <span className="text-[10px] text-lol-gold">{t("detail.yourTeam")}</span>
              )}
              {team.win && (
                <span className="ml-auto text-[11px] font-bold text-lol-win">
                  {t("detail.teamWins")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 tabular-nums">
              {counters(team).map(({ value, label }) => (
                <div key={label} className="flex flex-col">
                  <span
                    className={`text-lg font-semibold ${value > 0 ? "text-lol-text-bright" : "text-lol-text/40"}`}
                  >
                    {value}
                  </span>
                  <span className="text-[10px] text-lol-text/60">{t(label)}</span>
                </div>
              ))}
            </div>
            <FirstTags team={team} sections={sections} t={t} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function FirstTags({
  team,
  sections,
  t,
}: {
  team: MatchTeamStats;
  sections: DetailSections;
  t: Translate;
}) {
  const tags: TranslationKey[] = [];
  if (team.firstBlood) tags.push("detail.firstBlood");
  if (team.firstTower) tags.push("detail.firstTower");
  if (team.firstInhibitor) tags.push("detail.firstInhibitor");
  if (sections.epics && team.firstDragon) tags.push("detail.firstDragon");
  if (sections.epics && team.firstBaron) tags.push("detail.firstBaron");
  if (tags.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-sm border border-lol-gold/40 px-1.5 py-0.5 text-[10px] text-lol-gold"
        >
          {t(tag)}
        </span>
      ))}
    </div>
  );
}

function YourGame({ detail, rows, t }: { detail: MatchDetailData; rows: Row[]; t: Translate }) {
  const self = rows.find((row) => row.isSelf);
  if (!self) return null;
  const stats = detail.stats;
  const cells: { value: string; label: TranslationKey }[] = [
    { value: num(self.champLevel), label: "detail.level" },
    { value: num(self.goldEarned), label: "detail.goldEarned" },
    { value: num(Math.max(0, self.goldEarned - self.goldSpent)), label: "detail.goldUnspent" },
    { value: num(self.largestCrit), label: "detail.largestCrit" },
    { value: num(stats.largest_killing_spree), label: "detail.longestSpree" },
    { value: num(stats.double_kills), label: "detail.doubles" },
    { value: num(self.totalHeal), label: "detail.heal" },
    { value: num(self.cs), label: "detail.cs" },
  ];
  return (
    <Card title={t("detail.yours")}>
      <div className="grid grid-cols-2 gap-4 tabular-nums @xl:grid-cols-4 @4xl:grid-cols-8">
        {cells.map(({ value, label }) => (
          <div key={label} className="flex flex-col">
            <span className="text-lg font-semibold text-lol-text-bright">{value}</span>
            <span className="text-[10px] text-lol-text/60">{t(label)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * What the queue does not have, said out loud.
 *
 * The alternative is drawing ten zeroes and letting the reader work out
 * whether nobody warded or the mode has no wards.
 */
function MissingNote({ sections, t }: { sections: DetailSections; t: Translate }) {
  const missing: TranslationKey[] = [];
  if (!sections.bans) missing.push("detail.missingBans");
  if (!sections.epics) missing.push("detail.missingEpics");
  if (!sections.vision) missing.push("detail.missingVision");
  if (!sections.economy) missing.push("detail.missingEconomy");
  if (!sections.runes) missing.push("detail.missingRunes");
  if (missing.length === 0) return null;
  const list = missing.map((key) => t(key)).join(t("detail.listJoin"));
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-dashed border-lol-border/60 bg-lol-card px-4 py-3">
      <span className="text-[10px] font-semibold tracking-wider text-lol-text/60 uppercase">
        {t("detail.missingTitle")}
      </span>
      <p className="m-0 max-w-[70ch] text-xs leading-relaxed text-lol-text">
        {t("detail.missingIntro", { list })}
      </p>
    </div>
  );
}

function Header({
  detail,
  champData,
  t,
}: {
  detail: MatchDetailData;
  champData: ChampionData;
  t: Translate;
}) {
  const { game, stats } = detail;
  const isRemake = !!game.is_remake;
  const isWin = !!stats.win;
  const outcome = isRemake ? "recap.remake" : isWin ? "recap.victory" : "recap.defeat";
  const accent = isRemake
    ? "border-l-lol-text/40"
    : isWin
      ? "border-l-lol-win"
      : "border-l-lol-loss";
  const outcomeColor = isRemake ? "text-lol-text" : isWin ? "text-lol-win" : "text-lol-loss";
  const scored = !isRemake && hasScore(game.queue_id) && stats.score != null;

  return (
    <header
      className={`flex flex-wrap items-center gap-4 rounded-lg border border-l-[3px] border-lol-border/60 bg-lol-card p-4 ${accent}`}
    >
      <ChampionIcon championId={stats.champion_id} size={56} />
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2.5">
          <span className="text-xl font-bold text-lol-text-bright">
            {getChampionName(champData, stats.champion_id)}
          </span>
          <span className={`text-sm font-bold tracking-wide ${outcomeColor}`}>{t(outcome)}</span>
        </div>
        <div className="text-xs text-lol-text">
          {queueLabel(game.queue_id)} · {formatDuration(game.game_duration)} ·{" "}
          {formatDateTime(game.game_creation)}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-6">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] tracking-wider text-lol-text/60">KDA</span>
          <span className="text-lg font-semibold text-lol-text-bright">
            <Kda kills={stats.kills} deaths={stats.deaths} assists={stats.assists} />
          </span>
          <span className="text-[11px] tabular-nums text-lol-text">
            {t("recap.kda", { ratio: kdaRatio(stats.kills, stats.deaths, stats.assists) })}
          </span>
        </div>
        {scored && (
          <>
            <span className="h-12 w-px bg-lol-border" />
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] tracking-wider text-lol-text/60">
                {t("history.score")}
              </span>
              <span className="text-lg font-semibold tabular-nums text-lol-gold">
                {stats.score!.toFixed(1)}
              </span>
              {stats.score_rank != null && stats.score_rank_total != null && (
                <span className="text-[11px] text-lol-text">
                  {t("recap.ordinalOf", {
                    ordinal: `${stats.score_rank}.º`,
                    total: stats.score_rank_total,
                  })}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
