import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useIpc } from "../hooks/useIpc";
import { useQueueSelection } from "../hooks/useQueueSelection";
import { useViewState } from "../hooks/useViewState";
import { useSort } from "../hooks/useSort";
import { useChampionData, getChampionName } from "../hooks/useChampions";
import type { ExploreRow, ExploreTable } from "../lib/types";
import {
  DEFAULT_GROUP,
  DEFAULT_METRIC,
  DEFAULT_MIN_GAMES,
  GROUPS,
  METRICS,
  MIN_GAMES_CHOICES,
  gap,
  gapCarries,
  metricByKey,
  metricsFor,
  type GroupKey,
  type Metric,
  type MetricKey,
} from "../../shared/explore";
import type { TranslationKey } from "../../shared/i18n";
import { EmptyState, PageLoading } from "../components/PageState";
import ChampionIcon from "../components/ChampionIcon";
import SortHeader from "../components/SortHeader";
import { queueLabel } from "../components/QueueSelect";
import { LOCALE, formatPatch } from "../lib/format";
import { useT, type Translate } from "../lib/i18n";

type SortField = "name" | "games" | "value" | "gap";

const METRIC_LABEL = (key: MetricKey) => `explore.metric.${key}` as TranslationKey;
const METRIC_WHAT = (key: MetricKey) => `explore.what.${key}` as TranslationKey;
const GROUP_LABEL = (key: GroupKey) => `explore.group.${key}` as TranslationKey;

// Sunday first, the way strftime('%w') numbers the days, taken from a week
// whose 7th is a Sunday so the names come from the reader's own locale.
const WEEKDAY_NAMES = Array.from({ length: 7 }, (_, index) =>
  new Date(2024, 0, 7 + index).toLocaleDateString(LOCALE, { weekday: "long" }),
);

// La clave es el lunes de esa semana en formato ISO, que es lo que la
// consulta agrupa; aquí se imprime como una fecha corta del idioma del lector.
function weekLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return new Date(year, month - 1, day).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
  });
}

function monthName(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString(LOCALE, {
    month: "long",
    year: "numeric",
  });
}

function formatValue(value: number | null, metric: Metric, t: Translate): string {
  if (value == null) return "—";
  const number = value.toLocaleString(LOCALE, {
    minimumFractionDigits: metric.decimals,
    maximumFractionDigits: metric.decimals,
  });
  if (metric.unit === "percent") return `${number}%`;
  if (metric.unit === "perMinute") return t("explore.perMinute", { value: number });
  if (metric.unit === "minutes") return t("explore.minutes", { value: number });
  return number;
}

function formatGap(value: number, metric: Metric): string {
  const sign = value > 0 ? "+" : "";
  return (
    sign +
    value.toLocaleString(LOCALE, {
      minimumFractionDigits: metric.decimals,
      maximumFractionDigits: metric.decimals,
    })
  );
}

/**
 * The colour a gap gets, which depends on whether the metric has a good
 * direction at all.
 *
 * Damage taken and game length have none, so a real difference there is marked
 * as a difference and nothing more. Saying otherwise would be the page having
 * an opinion it cannot support.
 */
function gapClass(value: number, metric: Metric): string {
  if (metric.higherIsBetter == null) return "text-lol-gold";
  const good = metric.higherIsBetter ? value > 0 : value < 0;
  return good ? "text-lol-win" : "text-lol-loss";
}

/**
 * The bar as a distance from your average rather than from zero.
 *
 * Nine scores between 6.50 and 7.20 drawn from zero are nine identical full
 * bars that say nothing. Drawn from your average, the same column is the shape
 * of the table at a glance: the midline is your figure, and each bar is the
 * gap the last column prints as a number.
 */
function bar(difference: number | null, spread: number): { left: string; width: string } {
  if (difference == null || spread <= 0) return { left: "50%", width: "0%" };
  const half = (Math.abs(difference) / spread) * 50;
  return { left: difference >= 0 ? "50%" : `${50 - half}%`, width: `${half}%` };
}

/** The row's name, and where it leads when there is somewhere to go. */
function RowName({
  row,
  group,
  championName,
  t,
}: {
  row: ExploreRow;
  group: GroupKey;
  championName: (id: number) => string;
  t: Translate;
}) {
  if (group === "champion") {
    const id = Number(row.key);
    return (
      <Link
        to={`/champion/${id}`}
        className="flex items-center gap-2 text-lol-text-bright transition-colors hover:text-lol-gold"
      >
        <ChampionIcon championId={id} size={20} />
        {championName(id)}
      </Link>
    );
  }
  if (group === "teammate") {
    return (
      <Link
        to={`/friends/${encodeURIComponent(row.key)}`}
        className="text-lol-text-bright transition-colors hover:text-lol-gold"
      >
        {row.label ?? row.key}
      </Link>
    );
  }
  const text =
    group === "patch"
      ? formatPatch(row.key)
      : group === "week"
        ? t("explore.weekOf", { date: weekLabel(row.key) })
        : group === "month"
          ? monthName(row.key)
          : group === "weekday"
            ? (WEEKDAY_NAMES[Number(row.key)] ?? row.key)
            : group === "hour"
              ? t("explore.hour", { hour: row.key })
              : group === "duration"
                ? t("explore.fromMinutes", { minutes: row.key })
                : queueLabel(Number(row.key));
  return <span className="text-lol-text-bright">{text}</span>;
}

export default function Explore() {
  const t = useT();
  const [queue] = useQueueSelection();
  const champData = useChampionData();
  const [metric, setMetric] = useViewState<MetricKey>("explore.metric", DEFAULT_METRIC);
  const [group, setGroup] = useViewState<GroupKey>("explore.group", DEFAULT_GROUP);
  const [minGames, setMinGames] = useViewState<number>("explore.minGames", DEFAULT_MIN_GAMES);
  const sort = useSort<SortField>("explore", "value");

  const { data, loading } = useIpc<ExploreTable | null>(
    () => window.api.getExploreTable({ metric, group, queue, minGames }),
    [metric, group, queue, minGames],
  );

  // The answer decides the metric, not the selector: a queue with no score
  // cannot be asked for one, and the page follows rather than arguing.
  const shown = data ? metricByKey(data.metric) : metricByKey(metric);
  const offered = data ? metricsFor(data.group, data.available) : METRICS.map((m) => m.key);

  const rows = useMemo(() => {
    if (!data) return [];
    const direction = sort.sortDir === "asc" ? 1 : -1;
    const copy = [...data.rows];
    copy.sort((a, b) => {
      if (sort.sortKey === "games") return (a.games - b.games) * direction;
      if (sort.sortKey === "value")
        return ((a.value ?? -Infinity) - (b.value ?? -Infinity)) * direction;
      if (sort.sortKey === "gap") {
        return ((gap(a, data.overall) ?? 0) - (gap(b, data.overall) ?? 0)) * direction;
      }
      // By name: the groups that are really numbers sort as numbers, because
      // hour 9 belongs before hour 10 and not after hour 1.
      const numeric = ["champion", "weekday", "hour", "duration", "queue"].includes(data.group);
      if (numeric && data.group !== "champion") {
        return (Number(a.key) - Number(b.key)) * direction;
      }
      const left = a.label ?? a.key;
      const right = b.label ?? b.key;
      return left.localeCompare(right, LOCALE) * direction;
    });
    return copy;
  }, [data, sort.sortKey, sort.sortDir]);

  // How far the furthest row sits from your average, which is the width the
  // bars are drawn against. A tally has no average to sit away from, so there
  // the bar goes against the largest value instead.
  const spread = useMemo(() => {
    if (!data) return 0;
    return rows.reduce((top, row) => {
      const difference = gap(row, data.overall);
      return difference == null ? top : Math.max(top, Math.abs(difference));
    }, 0);
  }, [rows, data]);
  const widest = useMemo(() => rows.reduce((top, row) => Math.max(top, row.value ?? 0), 0), [rows]);

  if (loading && !data) return <PageLoading />;
  if (!data || data.overall.games === 0) return <EmptyState>{t("explore.empty")}</EmptyState>;

  const overallValue = formatValue(data.overall.value, shown, t);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-lg font-bold text-lol-text-bright">{t("explore.title")}</h1>
        <span className="text-xs text-lol-text/60">
          {t("explore.subtitle", { games: data.overall.games, groups: data.rows.length })}
        </span>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-lol-border/60 bg-lol-card p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wider text-lol-text/60 uppercase">
            {t("explore.measure")}
          </span>
          <select
            className="select"
            value={shown.key}
            onChange={(event) => setMetric(event.target.value as MetricKey)}
          >
            {METRICS.filter((entry) => offered.includes(entry.key)).map((entry) => (
              <option key={entry.key} value={entry.key}>
                {t(METRIC_LABEL(entry.key))}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wider text-lol-text/60 uppercase">
            {t("explore.cutBy")}
          </span>
          <select
            className="select"
            value={group}
            onChange={(event) => setGroup(event.target.value as GroupKey)}
          >
            {GROUPS.map((entry) => (
              <option key={entry} value={entry}>
                {t(GROUP_LABEL(entry))}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wider text-lol-text/60 uppercase">
            {t("explore.atLeast")}
          </span>
          <select
            className="select"
            value={minGames}
            onChange={(event) => setMinGames(Number(event.target.value))}
          >
            {MIN_GAMES_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {t("explore.gamesCount", { count: choice })}
              </option>
            ))}
          </select>
        </label>

        <p className="m-0 max-w-[48ch] text-xs leading-relaxed text-lol-text/70">
          {t(METRIC_WHAT(shown.key))}
        </p>
      </section>

      {group === "queue" && (
        <p className="m-0 rounded-md border border-lol-gold/30 bg-lol-gold/[0.06] px-3 py-2 text-xs text-lol-text">
          {t("explore.acrossQueues")}
        </p>
      )}

      <section className="rounded-lg border border-lol-border/60 bg-lol-card">
        {rows.length === 0 ? (
          <p className="m-0 p-4 text-xs text-lol-text">
            {t("explore.nothingLeft", { hidden: data.hidden, min: minGames })}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-lol-border/60">
                  <SortHeader {...sort} field="name" label={t(GROUP_LABEL(data.group))} />
                  <SortHeader {...sort} field="games" label={t("explore.games")} numeric />
                  <SortHeader {...sort} field="value" label={t(METRIC_LABEL(shown.key))} numeric />
                  <SortHeader {...sort} field="gap" label={t("explore.versus")} numeric />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const difference = gap(row, data.overall);
                  const carries = gapCarries(row, data.overall, shown);
                  return (
                    <tr
                      key={row.key}
                      className="border-b border-lol-border/20 last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-1.5">
                        <RowName
                          row={row}
                          group={data.group}
                          championName={(id) => getChampionName(champData, id)}
                          t={t}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right text-lol-text/60">{row.games}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-2">
                          <span className="relative hidden h-3 min-w-0 flex-1 rounded-xs bg-lol-dark @md:block">
                            {shown.kind === "count" ? (
                              <span
                                className="absolute inset-y-0 left-0 rounded-xs bg-lol-border"
                                style={{
                                  width: `${widest > 0 ? ((row.value ?? 0) / widest) * 100 : 0}%`,
                                }}
                              />
                            ) : (
                              <>
                                <span
                                  aria-hidden
                                  className="absolute inset-y-0 left-1/2 w-px bg-lol-text/40"
                                />
                                <span
                                  className={`absolute inset-y-0 rounded-xs ${
                                    carries ? "bg-lol-gold/70" : "bg-lol-border"
                                  }`}
                                  style={bar(difference, spread)}
                                />
                              </>
                            )}
                          </span>
                          <span className="w-20 shrink-0 text-right font-semibold text-lol-text-bright">
                            {formatValue(row.value, shown, t)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {difference == null || shown.kind === "count" ? (
                          <span className="text-lol-text/30">—</span>
                        ) : carries ? (
                          <span className={`font-semibold ${gapClass(difference, shown)}`}>
                            {formatGap(difference, shown)}
                          </span>
                        ) : (
                          <span className="text-lol-text/40">{formatGap(difference, shown)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="m-0 max-w-[90ch] text-xs leading-relaxed text-lol-text/70">
        {shown.kind === "count"
          ? t("explore.countNote")
          : t("explore.note", { overall: overallValue })}
        {data.hidden > 0 && ` ${t("explore.hiddenNote", { hidden: data.hidden, min: minGames })}`}
      </p>
    </div>
  );
}
