import { Link } from "react-router-dom";
import type { ChampionData, GameRecap, MatchDetail, MatchListItem } from "../lib/types";
import { hasAugments, hasScore } from "../../shared/queues";
import { MATCH_DETAIL_PATH } from "../../shared/match-detail";
import { getChampionName } from "../hooks/useChampions";
import {
  formatDateTime,
  formatDuration,
  formatTimeAgo,
  kdaHighlight,
  kdaRatio,
} from "../lib/format";
import { useT } from "../lib/i18n";
import { useInView } from "../hooks/useInView";
import AugmentIcon from "./AugmentIcon";
import ChampionIcon from "./ChampionIcon";
import ItemIcon from "./ItemIcon";
import Kda from "./Kda";
import MatchScoreboard from "./MatchScoreboard";
import MultikillBadge from "./MultikillBadge";
import { PageLoading } from "./PageState";
import ScoreCell from "./ScoreCell";
import StatBars from "./StatBars";
import SummonerSpellIcon from "./SummonerSpellIcon";
import VerdictLines from "./VerdictLines";

/**
 * One game in the history, and the panel it opens.
 *
 * Pulled out of the page at 1,249 lines: this is the part that changes most
 * often — every queue-aware column, every new link — and it was the hardest
 * to find in there.
 */
interface GameRowProps {
  match: MatchListItem;
  /** Decided once for the whole list, so every row keeps the same columns. */
  laneStats: boolean;
  champData: ChampionData;
  expanded: boolean;
  detail: MatchDetail | null;
  recap: GameRecap | null;
  detailLoading: boolean;
  puuids: string[] | null;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/** One of the two numbers the Rift rows carry where the score would be. */
function LaneStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="w-10 shrink-0 text-center">
      <div className="text-sm font-semibold tabular-nums text-lol-text-bright">{value}</div>
      <div className="text-[10px] tracking-wider text-lol-text uppercase">{label}</div>
    </div>
  );
}

function parseAugmentIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw.split(",").map(Number).filter(Boolean);
}

/**
 * What an icon leaves behind when its row is off screen.
 *
 * Exactly the size of the picture it stands in for, so a row keeps its height
 * and nothing below it moves when the pictures come and go.
 */
function IconSlot({ size, round = true }: { size: number; round?: boolean }) {
  return (
    <span
      aria-hidden
      className={`block shrink-0 bg-white/5 ${round ? "rounded-full" : "rounded"}`}
      style={{ width: size, height: size }}
    />
  );
}

function AugmentGrid({
  augmentIds,
  patch,
  draw,
}: {
  augmentIds: number[];
  patch?: string | null;
  draw: boolean;
}) {
  if (augmentIds.length === 0) return null;
  // Classic can grant bonus augments; spill past 4 into a third column so the
  // grid stays two rows tall and rows keep a uniform height.
  const cols = augmentIds.length > 4 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={`grid ${cols} gap-0.5 w-fit`}>
      {augmentIds.map((id, i) =>
        draw ? (
          <AugmentIcon key={i} augmentId={id} size={22} patch={patch} />
        ) : (
          <IconSlot key={i} size={22} round={false} />
        ),
      )}
    </div>
  );
}

export default function GameRow({
  match,
  laneStats,
  champData,
  expanded,
  detail,
  recap,
  detailLoading,
  puuids,
  onToggle,
  onContextMenu,
}: GameRowProps) {
  const t = useT();
  // Las imagenes de una fila fuera de pantalla no se dibujan: son la mayor
  // parte de los 270 MB que costaba recorrer el historial entero. La fila
  // sigue montada y con su altura, asi que nada se mueve.
  const [ref, draw] = useInView<HTMLDivElement>();
  const isRemake = !!match.is_remake;
  const isWin = !!match.win;
  const isFavorite = !!match.favorite;
  const kda = kdaRatio(match.kills, match.deaths, match.assists);
  const augmentIds = hasAugments(match.queue_id) ? parseAugmentIds(match.augment_ids) : [];

  const accent = isFavorite
    ? "bg-amber-400"
    : isRemake
      ? "bg-white/25"
      : isWin
        ? "bg-lol-win"
        : "bg-lol-loss";
  const tint = isRemake
    ? "from-white/[0.03] to-white/[0.01]"
    : isWin
      ? "from-lol-win/12 to-lol-win/[0.04]"
      : "from-lol-loss/12 to-lol-loss/[0.04]";

  return (
    <div id={`game-${match.game_id}`} ref={ref}>
      <button
        onClick={onToggle}
        onContextMenu={onContextMenu}
        className={`relative overflow-hidden w-full flex items-center gap-3 pl-4 pr-3 py-2.5 border border-lol-border/60 bg-lol-card hover:bg-lol-card-hover transition-colors text-left ${
          expanded ? "rounded-t-lg" : "rounded-lg"
        }`}
      >
        <span className={`absolute left-0 inset-y-0 w-[3px] ${accent}`} />
        <span className={`absolute inset-0 pointer-events-none bg-gradient-to-r ${tint}`} />
        <div
          className={`text-xs font-bold shrink-0 ${isRemake ? "text-gray-500 w-8" : isWin ? "text-lol-win w-8" : "text-lol-loss w-8"}`}
        >
          {match.placement
            ? `#${match.placement}`
            : isRemake
              ? t("history.rmk")
              : isWin
                ? t("history.win")
                : t("history.loss")}
        </div>
        {draw ? <ChampionIcon championId={match.champion_id} size={36} /> : <IconSlot size={36} />}
        {/* Two 17px spells + the 2px gap match the portrait's 36px height */}
        <div className="flex flex-col gap-0.5 shrink-0">
          {draw ? (
            <>
              <SummonerSpellIcon spellId={match.spell1} size={17} />
              <SummonerSpellIcon spellId={match.spell2} size={17} />
            </>
          ) : (
            <>
              <IconSlot size={17} round={false} />
              <IconSlot size={17} round={false} />
            </>
          )}
        </div>
        <div className="w-20 shrink-0 @lg:w-24">
          <div className="text-sm text-lol-text-bright truncate">
            {getChampionName(champData, match.champion_id)}
          </div>
        </div>
        <div className="w-20 shrink-0 @lg:w-24">
          <div className="text-sm text-lol-text-bright">
            <Kda kills={match.kills} deaths={match.deaths} assists={match.assists} />
          </div>
          <div className={`text-xs ${kdaHighlight(kda)}`}>{t("recap.kda", { ratio: kda })}</div>
        </div>

        {/* The score is only ever ARAM Caos's; everywhere else the column
            would be a permanent blank, so the Rift's two numbers take the
            space instead of being squeezed in beside it. */}
        {hasScore(match.queue_id) ? (
          <ScoreCell score={isRemake ? null : match.score} badge={match.score_badge} />
        ) : laneStats ? (
          <div className="flex shrink-0 gap-3">
            <LaneStat value={match.cs} label={t("history.cs")} />
            <LaneStat value={match.vision} label={t("history.vision")} />
          </div>
        ) : null}

        {/* Stat bars: only with room to spare; the row keeps what identifies the game */}
        <div className="hidden @4xl:block">
          <StatBars
            damage={match.total_damage_dealt}
            taken={match.total_damage_taken}
            heal={match.total_heal}
            max={{
              dmg: match.game_max_dmg,
              taken: match.game_max_taken,
              heal: match.game_max_heal,
            }}
            className="w-40"
          />
        </div>

        {/* Augments – reserve 3 columns so mixed-queue lists stay aligned */}
        <div className="hidden w-[70px] shrink-0 @3xl:block">
          <AugmentGrid augmentIds={augmentIds} patch={match.game_version} draw={draw} />
        </div>

        {/* Items – 3x2 grid, no trinket (slot 6) */}
        <div className="hidden shrink-0 grid-cols-3 gap-0.5 @2xl:grid">
          {[match.item0, match.item1, match.item2, match.item3, match.item4, match.item5].map(
            (itemId, i) =>
              draw ? (
                <ItemIcon key={i} itemId={itemId ?? 0} size={22} patch={match.game_version} />
              ) : (
                <IconSlot key={i} size={22} round={false} />
              ),
          )}
        </div>

        {/* Initials while the row is tight, words once the bars are back; the
            gap can never be narrower than a badge, so nothing spills over the time */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="hidden @lg:block @4xl:hidden">
            <MultikillBadge
              compact
              doubles={match.double_kills}
              triples={match.triple_kills}
              quadras={match.quadra_kills}
              pentas={match.penta_kills}
            />
          </div>
          <div className="hidden @4xl:block">
            <MultikillBadge
              doubles={match.double_kills}
              triples={match.triple_kills}
              quadras={match.quadra_kills}
              pentas={match.penta_kills}
            />
          </div>
        </div>
        <div className="text-xs text-lol-text text-right shrink-0">
          <div className="tabular-nums">{formatDuration(match.game_duration)}</div>
          <div className="w-fit ml-auto" title={formatDateTime(match.game_creation)}>
            {formatTimeAgo(match.game_creation)}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mb-1 bg-lol-card rounded-b-lg border border-t-0 border-lol-border/60 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              to={`/champion/${match.champion_id}`}
              className="inline-flex items-center gap-1.5 text-xs text-lol-gold transition-colors hover:text-lol-gold-light"
            >
              {t("champions.sheetOf", { champion: getChampionName(champData, match.champion_id) })}
              <span aria-hidden>→</span>
            </Link>
            <Link
              to={`${MATCH_DETAIL_PATH}/${match.game_id}`}
              className="inline-flex items-center gap-1.5 text-xs text-lol-gold transition-colors hover:text-lol-gold-light"
            >
              {t("detail.open")}
              <span aria-hidden>→</span>
            </Link>
          </div>
          {recap && <VerdictLines recap={recap} />}
          {detailLoading ? (
            <PageLoading compact />
          ) : detail ? (
            <div className="overflow-x-auto">
              <MatchScoreboard detail={detail} champData={champData} puuids={puuids} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
