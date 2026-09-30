import { useMemo, useState, type ReactNode } from "react";
import {
  dotPosition,
  goldSwing,
  ownVersusAverage,
  peakOf,
  worstMoment,
  type MatchTimeline,
} from "../../shared/match-timeline";
import type { TranslationKey } from "../../shared/i18n";
import { LOCALE, formatCompact, formatDuration } from "../lib/format";
import { useT, type Translate } from "../lib/i18n";
import ChampionIcon from "./ChampionIcon";
import HoverCard from "./HoverCard";

/** What the page knows about each player, enough to colour and name a dot. */
export interface TimelinePlayer {
  participantId: number;
  championId: number;
  championName: string;
  name: string;
  teamId: number;
  isSelf: boolean;
}

const num = (value: number) => value.toLocaleString(LOCALE);

// The chart is bars rather than a line: a line between twenty-five points is
// a shape the data does not have — nothing is known about what happened
// between two minutes, and a slope quietly claims otherwise.
const HALF = 118;
const KILL_STRIP = 34;

type ChartView = "swing" | "own" | "kills";

const VIEWS: { view: ChartView; label: TranslationKey }[] = [
  { view: "swing", label: "timeline.viewSwing" },
  { view: "own", label: "timeline.viewOwn" },
  { view: "kills", label: "timeline.viewKills" },
];

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-lol-border/60 bg-lol-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-lol-text-bright">{title}</h2>
        {hint && <span className="text-xs text-lol-text/60">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  t,
}: {
  options: { view: T; label: TranslationKey }[];
  value: T;
  onChange: (next: T) => void;
  t: Translate;
}) {
  return (
    <div className="mb-3 flex w-fit gap-0.5 rounded-md border border-lol-border/60 bg-lol-dark p-0.5">
      {options.map((option) => (
        <button
          key={option.view}
          type="button"
          onClick={() => onChange(option.view)}
          aria-pressed={value === option.view}
          className={`rounded px-3 py-1.5 text-xs transition-colors ${
            value === option.view
              ? "bg-lol-gold font-semibold text-lol-dark"
              : "text-lol-text hover:text-lol-text-bright"
          }`}
        >
          {t(option.label)}
        </button>
      ))}
    </div>
  );
}

/**
 * How the game went, minute by minute.
 *
 * The default view is the gold lead from your side rather than each team's
 * total, because two climbing lines only differ where it matters and the
 * difference is the thing being read.
 */
export function GoldChart({
  timeline,
  players,
  duration,
}: {
  timeline: MatchTimeline;
  players: TimelinePlayer[];
  duration: number;
}) {
  const t = useT();
  const [view, setView] = useState<ChartView>("swing");

  const self = players.find((p) => p.isSelf);
  const teamOf = useMemo(() => {
    const teams = new Map(players.map((p) => [p.participantId, p.teamId]));
    return (id: number) => teams.get(id);
  }, [players]);

  const swing = useMemo(
    () => goldSwing(timeline.frames, teamOf, self?.teamId ?? 100),
    [timeline, teamOf, self],
  );
  const mine = useMemo(
    () => ownVersusAverage(timeline.frames, self?.participantId ?? null),
    [timeline, self],
  );
  const killsPerMinute = useMemo(() => timeline.frames.map((f) => f.kills), [timeline]);

  const worst = useMemo(() => worstMoment(swing), [swing]);
  const lastOwn = mine.own[mine.own.length - 1] ?? 0;
  const lastAvg = mine.average[mine.average.length - 1] ?? 0;

  // Each view has its own scale; sharing one would flatten whichever is smaller
  const peak =
    view === "swing" ? peakOf(swing) : view === "kills" ? peakOf(killsPerMinute) : peakOf(mine.own);

  return (
    <Card
      title={t("timeline.chart")}
      hint={t("timeline.chartHint", { count: timeline.frames.length })}
    >
      <Segmented options={VIEWS} value={view} onChange={setView} t={t} />

      {view === "swing" && (
        <>
          <div className="mb-2 flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-lol-win" />
              {t("timeline.ahead")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-lol-loss" />
              {t("timeline.behind")}
            </span>
          </div>
          <div className="flex items-stretch gap-2.5">
            <div
              className="flex w-12 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-lol-text/60"
              style={{ height: HALF * 2 }}
            >
              <span>+{formatCompact(peak)}</span>
              <span>0</span>
              <span>−{formatCompact(peak)}</span>
            </div>
            <div className="relative min-w-0 flex-1" style={{ height: HALF * 2 }}>
              <span className="absolute inset-x-0 h-px bg-lol-border" style={{ top: HALF }} />
              <div className="absolute inset-0 flex items-stretch gap-1">
                {swing.map((value, minute) => (
                  <ChartBar
                    key={minute}
                    minute={minute}
                    up={value > 0 ? (value / peak) * HALF : 0}
                    down={value < 0 ? (-value / peak) * HALF : 0}
                    label={t("timeline.swingAt", {
                      minute,
                      gold: (value > 0 ? "+" : value < 0 ? "−" : "") + num(Math.abs(value)),
                    })}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {view === "own" && (
        <div className="flex items-stretch gap-2.5">
          <div
            className="flex w-12 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-lol-text/60"
            style={{ height: HALF * 2 }}
          >
            <span>{formatCompact(peak)}</span>
            <span>0</span>
          </div>
          <div className="flex min-w-0 flex-1 items-end gap-1" style={{ height: HALF * 2 }}>
            {mine.own.map((value, minute) => (
              <HoverCard
                key={minute}
                width={200}
                content={
                  <span className="text-[11px] text-lol-text">
                    {t("timeline.ownAt", {
                      minute,
                      gold: num(value),
                      average: num(mine.average[minute] ?? 0),
                    })}
                  </span>
                }
              >
                <span className="relative flex h-full min-w-0 flex-1 cursor-help items-end">
                  <span
                    className="w-full rounded-t-xs bg-lol-gold/80"
                    style={{ height: (value / peak) * HALF * 2 }}
                  />
                  {/* The lobby's average as a line across the same bar, so the
                      gap is read rather than calculated */}
                  <span
                    className="absolute inset-x-0 h-px bg-lol-text-bright"
                    style={{ bottom: ((mine.average[minute] ?? 0) / peak) * HALF * 2 }}
                  />
                </span>
              </HoverCard>
            ))}
          </div>
        </div>
      )}

      {view === "kills" && (
        <div className="flex items-stretch gap-2.5">
          <div
            className="flex w-12 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-lol-text/60"
            style={{ height: HALF * 2 }}
          >
            <span>{peak}</span>
            <span>0</span>
          </div>
          <div className="flex min-w-0 flex-1 items-end gap-1" style={{ height: HALF * 2 }}>
            {killsPerMinute.map((value, minute) => (
              <HoverCard
                key={minute}
                width={180}
                content={
                  <span className="text-[11px] text-lol-text">
                    {t("timeline.killsAt", { minute, count: value })}
                  </span>
                }
              >
                <span className="flex h-full min-w-0 flex-1 cursor-help items-end">
                  <span
                    className="w-full rounded-t-xs bg-sky-400/80"
                    style={{ height: (value / peak) * HALF * 2 }}
                  />
                </span>
              </HoverCard>
            ))}
          </div>
        </div>
      )}

      {/* The kill strip under the gold, on the same axis, so the two read together */}
      {view === "swing" && (
        <div className="mt-2 flex items-stretch gap-2.5">
          <div className="w-12 shrink-0 pt-0.5 text-right text-[10px] text-lol-text/60">
            {t("timeline.killsAxis")}
          </div>
          <div className="flex min-w-0 flex-1 items-end gap-1" style={{ height: KILL_STRIP }}>
            {killsPerMinute.map((value, minute) => (
              <span
                key={minute}
                className="min-w-0 flex-1 rounded-xs bg-lol-text/40"
                style={{ height: (value / peakOf(killsPerMinute)) * KILL_STRIP }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-1 flex items-stretch gap-2.5">
        <div className="w-12 shrink-0" />
        <div className="flex min-w-0 flex-1 gap-1 text-[10px] tabular-nums text-lol-text/60">
          {timeline.frames.map((frame) => (
            <span key={frame.minute} className="min-w-0 flex-1 text-center">
              {frame.minute % 5 === 0 ? frame.minute : ""}
            </span>
          ))}
        </div>
      </div>

      <p className="m-0 mt-3 max-w-[70ch] text-xs leading-relaxed text-lol-text">
        {worst && worst.gap < 0
          ? t("timeline.worst", {
              minute: worst.minute,
              gold: num(-worst.gap),
              duration: formatDuration(duration),
            })
          : t("timeline.neverBehind", { duration: formatDuration(duration) })}{" "}
        {self &&
          (lastOwn >= lastAvg
            ? t("timeline.aboveAverage", { gold: num(lastOwn - lastAvg) })
            : t("timeline.belowAverage", { gold: num(lastAvg - lastOwn) }))}
      </p>
    </Card>
  );
}

function ChartBar({
  minute,
  up,
  down,
  label,
}: {
  minute: number;
  up: number;
  down: number;
  label: string;
}) {
  return (
    <HoverCard width={200} content={<span className="text-[11px] text-lol-text">{label}</span>}>
      <span className="flex min-w-0 flex-1 cursor-help flex-col" data-minute={minute}>
        <span className="flex items-end" style={{ height: HALF }}>
          <span className="w-full rounded-t-xs bg-lol-win" style={{ height: up }} />
        </span>
        <span style={{ height: HALF }}>
          <span className="block w-full rounded-b-xs bg-lol-loss" style={{ height: down }} />
        </span>
      </span>
    </HoverCard>
  );
}

type KillFilter = "all" | "mine" | "deaths";

const FILTERS: { view: KillFilter; label: TranslationKey }[] = [
  { view: "all", label: "timeline.killsAll" },
  { view: "mine", label: "timeline.killsMine" },
  { view: "deaths", label: "timeline.killsDeaths" },
];

/**
 * Where everyone died.
 *
 * The dots are translucent on purpose: where a fight happened over and over
 * the colour saturates, and that pile-up is the thing worth seeing. Colour is
 * by team rather than by player — ten colours on one picture is a legend to
 * decode, not a map to read.
 */
export function KillMap({
  timeline,
  players,
}: {
  timeline: MatchTimeline;
  players: TimelinePlayer[];
}) {
  const t = useT();
  const [filter, setFilter] = useState<KillFilter>("all");

  const byId = useMemo(
    () => new Map(players.map((player) => [player.participantId, player])),
    [players],
  );
  const self = players.find((player) => player.isSelf);

  const shown = useMemo(() => {
    if (filter === "mine") return timeline.kills.filter((k) => k.killerId === self?.participantId);
    if (filter === "deaths")
      return timeline.kills.filter((k) => k.victimId === self?.participantId);
    return timeline.kills;
  }, [timeline, filter, self]);

  const ours = shown.filter((k) => byId.get(k.killerId)?.teamId === self?.teamId).length;

  return (
    <Card title={t("timeline.map")} hint={t("timeline.mapHint")}>
      {self && <Segmented options={FILTERS} value={filter} onChange={setFilter} t={t} />}

      <div className="flex flex-wrap items-start gap-5">
        <div
          className="relative shrink-0 overflow-hidden rounded-md border border-lol-border/60"
          style={{ width: 420, height: 420 }}
        >
          <img
            src={timeline.minimapUrl ?? ""}
            alt=""
            width={420}
            height={420}
            className="block size-full opacity-55"
          />
          {shown.map((kill, index) => {
            const at = dotPosition(kill, timeline.span);
            const killer = byId.get(kill.killerId);
            const victim = byId.get(kill.victimId);
            const mine = killer?.teamId === self?.teamId;
            return (
              <HoverCard
                key={index}
                width={230}
                content={
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-lol-text-bright">
                      <ChampionIcon championId={killer?.championId ?? 0} size={16} />
                      <span>{killer?.championName ?? "?"}</span>
                      <span className="text-lol-text">→</span>
                      <ChampionIcon championId={victim?.championId ?? 0} size={16} />
                      <span>{victim?.championName ?? "?"}</span>
                    </div>
                    <span className="text-[11px] text-lol-text">
                      {formatDuration(kill.second)}
                      {kill.assists.length > 0 &&
                        ` · ${t("timeline.assists", {
                          names: kill.assists
                            .map((id) => byId.get(id)?.championName ?? "?")
                            .join(", "),
                        })}`}
                    </span>
                  </div>
                }
              >
                <span
                  className={`absolute size-[9px] cursor-help rounded-full border ${
                    mine ? "border-lol-win/90 bg-lol-win/60" : "border-lol-loss/90 bg-lol-loss/60"
                  }`}
                  style={{ left: `${at.left}%`, top: `${at.top}%`, margin: "-4.5px 0 0 -4.5px" }}
                />
              </HoverCard>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-lol-win/70" />
            <span className="text-lol-text">{t("timeline.byYourTeam")}</span>
            <span className="ml-auto font-semibold tabular-nums text-lol-text-bright">{ours}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-lol-loss/70" />
            <span className="text-lol-text">{t("timeline.byTheirTeam")}</span>
            <span className="ml-auto font-semibold tabular-nums text-lol-text-bright">
              {shown.length - ours}
            </span>
          </div>
          <p className="m-0 mt-2 text-xs leading-relaxed text-lol-text/70">
            {t("timeline.mapNote")}
          </p>
        </div>
      </div>
    </Card>
  );
}
