import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useIpc } from "../hooks/useIpc";
import { useQueueSelection } from "../hooks/useQueueSelection";
import { useChampionData, getChampionName } from "../hooks/useChampions";
import type { SkillAxes } from "../lib/types";
import type { AxisKey } from "../../shared/skill-axes";
import { MIN_CHAMPION_GAMES, TREND_WINDOW } from "../../shared/skill-axes";
import type { TranslationKey } from "../../shared/i18n";
import { EmptyState, PageLoading } from "../components/PageState";
import ChampionIcon from "../components/ChampionIcon";
import HoverCard from "./../components/HoverCard";
import { LOCALE } from "../lib/format";
import { useT, type Translate } from "../lib/i18n";

const AXIS_LABEL: Record<AxisKey, TranslationKey> = {
  aggression: "axes.aggression",
  damage: "axes.damage",
  toughness: "axes.toughness",
  survival: "axes.survival",
  control: "axes.control",
  economy: "axes.economy",
  vision: "axes.vision",
  farm: "axes.farm",
};

const AXIS_WHAT: Record<AxisKey, TranslationKey> = {
  aggression: "axes.aggressionWhat",
  damage: "axes.damageWhat",
  toughness: "axes.toughnessWhat",
  survival: "axes.survivalWhat",
  control: "axes.controlWhat",
  economy: "axes.economyWhat",
  vision: "axes.visionWhat",
  farm: "axes.farmWhat",
};

const pct = (value: number) => `${value.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%`;
const signed = (value: number) =>
  (value > 0 ? "+" : "") + value.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

/**
 * How far from the middle of the lobby a cell sits, as a colour.
 *
 * The number stays next to it always: a colour is a hint, not a figure, and
 * a table that only colours cannot be read out loud.
 */
function cellStyle(value: number): { background: string; color: string } {
  const away = Math.min(1, Math.abs(value - 50) / 40);
  if (away < 0.2) return { background: "#242c3d", color: "#94a0b8" };
  const alpha = (0.18 + away * 0.42).toFixed(2);
  return value > 50
    ? { background: `rgba(62,207,142,${alpha})`, color: "#e8ecf4" }
    : { background: `rgba(229,99,110,${alpha})`, color: "#e8ecf4" };
}

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

function AxisName({ axis, t }: { axis: AxisKey; t: Translate }) {
  return (
    <HoverCard
      width={230}
      content={<span className="text-[11px] text-lol-text">{t(AXIS_WHAT[axis])}</span>}
    >
      <span className="cursor-help border-b border-dotted border-lol-text/40">
        {t(AXIS_LABEL[axis])}
      </span>
    </HoverCard>
  );
}

export default function Skills() {
  const t = useT();
  const [queue] = useQueueSelection();
  const champData = useChampionData();
  const { data, loading } = useIpc<SkillAxes | null>(() => window.api.getSkillAxes(queue), [queue]);

  // Biggest movers first: a list of eight sorted by anything else buries the
  // one row worth reading.
  const trend = useMemo(
    () =>
      data?.trend
        ? [...data.trend].sort(
            (a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before),
          )
        : null,
    [data],
  );

  if (loading) return <PageLoading />;
  if (!data || data.games === 0) return <EmptyState>{t("axes.empty")}</EmptyState>;

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-lg font-bold text-lol-text-bright">{t("axes.title")}</h1>
        <span className="text-xs text-lol-text/60">
          {t("axes.subtitle", { count: data.games })}
        </span>
      </header>

      <Card title={t("axes.profile")} hint={t("axes.profileHint")}>
        <div className="flex flex-col gap-2 tabular-nums">
          {data.profile.map((entry) => {
            const away = entry.percentile - 50;
            return (
              <div key={entry.axis} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-lol-text-bright">
                  <AxisName axis={entry.axis} t={t} />
                </span>
                <span className="relative h-5 min-w-0 flex-1 rounded-sm bg-lol-dark">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-lol-text/40" />
                  <span
                    className={`absolute inset-y-1 rounded-xs ${away >= 0 ? "bg-lol-win" : "bg-lol-loss"}`}
                    style={{
                      left: `${Math.min(50, entry.percentile)}%`,
                      width: `${Math.abs(away)}%`,
                    }}
                  />
                </span>
                <span className="w-14 shrink-0 text-right text-xs font-semibold text-lol-text-bright">
                  {pct(entry.percentile)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="m-0 mt-3 max-w-[75ch] text-xs leading-relaxed text-lol-text/70">
          {t("axes.profileNote")}
        </p>
      </Card>

      {trend && (
        <Card title={t("axes.trend")} hint={t("axes.trendHint", { count: TREND_WINDOW })}>
          <div className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
            {trend.map((entry) => {
              const delta = entry.after - entry.before;
              return (
                <div
                  key={entry.axis}
                  className={`flex flex-col gap-1.5 rounded-md border border-lol-border/60 bg-lol-dark p-3 ${
                    entry.meaningful
                      ? delta >= 0
                        ? "border-l-2 border-l-lol-win"
                        : "border-l-2 border-l-lol-loss"
                      : "border-l-2 border-l-lol-border"
                  }`}
                >
                  <span className="text-xs text-lol-text">
                    <AxisName axis={entry.axis} t={t} />
                  </span>
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-xs text-lol-text/60">{pct(entry.before)}</span>
                    <span aria-hidden className="text-xs text-lol-text/60">
                      →
                    </span>
                    <span className="text-lg font-semibold text-lol-text-bright">
                      {pct(entry.after)}
                    </span>
                    <span
                      className={`ml-auto text-xs font-semibold ${
                        !entry.meaningful
                          ? "text-lol-text/50"
                          : delta >= 0
                            ? "text-lol-win"
                            : "text-lol-loss"
                      }`}
                    >
                      {entry.meaningful ? signed(delta) : t("axes.flat")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="m-0 mt-3 max-w-[80ch] text-xs leading-relaxed text-lol-text/70">
            {t("axes.trendNote")}
          </p>
        </Card>
      )}

      <Card
        title={t("axes.byChampion")}
        hint={t("axes.byChampionHint", { count: MIN_CHAMPION_GAMES })}
      >
        {data.champions.length === 0 ? (
          <p className="m-0 text-xs text-lol-text">
            {t("axes.noChampions", { count: MIN_CHAMPION_GAMES })}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs tabular-nums">
              <thead>
                <tr className="text-[10px] tracking-wider text-lol-text/60 uppercase">
                  <th className="pb-2 text-left font-normal">{t("axes.champion")}</th>
                  <th className="pb-2 pr-3 text-right font-normal">{t("axes.games")}</th>
                  {data.axes.map((axis) => (
                    <th key={axis} className="pb-2 text-center font-normal">
                      <AxisName axis={axis} t={t} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.champions.map((champion) => (
                  <tr key={champion.championId}>
                    <td className="py-0.5 pr-3">
                      <Link
                        to={`/champion/${champion.championId}`}
                        className="flex items-center gap-2 text-lol-text-bright transition-colors hover:text-lol-gold"
                      >
                        <ChampionIcon championId={champion.championId} size={20} />
                        {getChampionName(champData, champion.championId)}
                      </Link>
                    </td>
                    <td className="py-0.5 pr-3 text-right text-lol-text/60">{champion.games}</td>
                    {data.axes.map((axis) => {
                      const value = champion.values[axis];
                      return (
                        <td key={axis} className="p-0.5">
                          {value == null ? (
                            <div className="rounded-sm py-1.5 text-center text-lol-text/30">—</div>
                          ) : (
                            <div
                              className="rounded-sm py-1.5 text-center font-semibold"
                              style={cellStyle(value)}
                            >
                              {Math.round(value)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-lol-text/60">
          <span>{t("axes.worse")}</span>
          <span className="flex h-2.5 w-44 overflow-hidden rounded-xs">
            <span className="flex-1 bg-lol-loss/55" />
            <span className="flex-1 bg-lol-loss/25" />
            <span className="flex-1 bg-lol-border" />
            <span className="flex-1 bg-lol-win/25" />
            <span className="flex-1 bg-lol-win/55" />
          </span>
          <span>{t("axes.better")}</span>
        </div>
      </Card>
    </div>
  );
}
