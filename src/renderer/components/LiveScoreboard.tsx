import { Link } from "react-router-dom";
import type { ChampionData, LiveEvent, LivePlayer } from "../lib/types";
import { getChampionName } from "../hooks/useChampions";
import { formatDuration, kdaRatio, winRateColor } from "../lib/format";
import ChampionIcon from "./ChampionIcon";
import ItemIcon from "./ItemIcon";
import SummonerSpellIcon from "./SummonerSpellIcon";
import { useT } from "../lib/i18n";
import PlayerTags from "./PlayerTags";
import { livePlayerTag } from "../../shared/tags";
import Kda from "./Kda";

const GRID_COLS = "grid-cols-[44px_minmax(90px,1fr)_34px_72px_44px_minmax(176px,auto)_108px]";

export default function LiveScoreboard({
  players,
  champData,
}: {
  players: LivePlayer[];
  champData: ChampionData;
}) {
  const teams = [...new Set(players.map((p) => p.teamId))].map((teamId) =>
    players.filter((p) => p.teamId === teamId),
  );

  return (
    <div className="space-y-3">
      {teams.map((team, index) =>
        team.length === 0 ? null : (
          <LiveTeam key={index} teamId={team[0].teamId} players={team} champData={champData} />
        ),
      )}
    </div>
  );
}

function LiveTeam({
  teamId,
  players,
  champData,
}: {
  teamId: number;
  players: LivePlayer[];
  champData: ChampionData;
}) {
  const t = useT();
  const ours = players.some((p) => p.isSelf);
  const kills = players.reduce((sum, p) => sum + p.kills, 0);
  const deaths = players.reduce((sum, p) => sum + p.deaths, 0);
  const assists = players.reduce((sum, p) => sum + p.assists, 0);

  return (
    <div className="rounded-lg border border-lol-border overflow-hidden">
      <div
        className={`px-3 py-1.5 border-b border-lol-border flex flex-wrap items-baseline gap-x-4 ${
          ours ? "bg-lol-win/10" : "bg-lol-loss/10"
        }`}
      >
        <span className={`text-xs font-bold ${ours ? "text-lol-win" : "text-lol-loss"}`}>
          {teamId === 100
            ? t("live.blueTeam")
            : teamId === 200
              ? t("live.redTeam")
              : teamId > 0
                ? t("live.teamN", { n: teamId })
                : t("live.teamUnknown")}
          {ours && <span className="text-lol-text font-normal">{t("live.yours")}</span>}
        </span>
        <span className="ml-auto text-[11px] text-lol-text">
          <span className="text-lol-text-bright font-medium">
            <Kda kills={kills} deaths={deaths} assists={assists} />
          </span>{" "}
          {t("live.teamKda")}
        </span>
      </div>

      <div
        className={`px-3 py-1 border-b border-lol-border/50 grid ${GRID_COLS} gap-2 items-center text-[10px] text-lol-text uppercase tracking-wider`}
      >
        <span />
        <span>{t("live.player")}</span>
        <span className="text-right">{t("live.lvl")}</span>
        <span className="text-center">{t("live.kda")}</span>
        <span className="text-right">{t("live.cs")}</span>
        <span>{t("live.items")}</span>
        <span className="text-right">{t("live.onThisChamp")}</span>
      </div>

      {players.map((player) => (
        <LivePlayerRow key={player.key} player={player} champData={champData} />
      ))}
    </div>
  );
}

function LivePlayerRow({ player, champData }: { player: LivePlayer; champData: ChampionData }) {
  const t = useT();
  const liveTag = player.shared ? livePlayerTag(player.shared) : null;
  const championName =
    player.championId > 0 ? getChampionName(champData, player.championId) : player.championName;

  return (
    <div
      className={`px-3 py-1.5 border-b border-lol-border/30 last:border-b-0 grid ${GRID_COLS} gap-2 items-center ${
        player.isSelf ? "border-l-2 border-l-lol-gold bg-lol-gold/5" : ""
      }`}
    >
      {/* Champion and spells, dimmed while they wait to respawn */}
      <div className={`flex items-center gap-0.5 ${player.isDead ? "opacity-40" : ""}`}>
        <div className="relative">
          <ChampionIcon championId={player.championId} size={32} />
          {player.isDead && player.respawnTimer > 0 && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-lol-loss tabular-nums">
              {player.respawnTimer}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <SummonerSpellIcon spellId={player.spell1Id} size={15} />
          <SummonerSpellIcon spellId={player.spell2Id} size={15} />
        </div>
      </div>

      <div className="min-w-0">
        <div
          className={`text-xs truncate ${
            player.isSelf ? "text-lol-gold font-semibold" : "text-lol-text-bright"
          }`}
        >
          {player.friendKey ? (
            <Link
              to={`/friends/${encodeURIComponent(player.friendKey)}`}
              className="hover:text-lol-gold transition-colors"
              title={t("live.gamesOnTeam", { count: player.gamesWithUs })}
            >
              {player.name}
            </Link>
          ) : (
            player.name
          )}
        </div>
        <div className="text-[10px] text-lol-text truncate">{championName}</div>
        {/* Only for someone familiar: on nine rows out of ten this is a
            stranger and there is nothing true to say about them. */}
        {liveTag && <PlayerTags className="mt-0.5" tags={[liveTag]} />}
      </div>

      <div className="text-right text-[11px] text-lol-text-bright tabular-nums">
        {player.level || "-"}
      </div>

      <div className="text-center tabular-nums">
        <div className="text-[11px] text-lol-text-bright">
          <Kda kills={player.kills} deaths={player.deaths} assists={player.assists} />
        </div>
        <div className="text-[10px] text-lol-text">
          {kdaRatio(player.kills, player.deaths, player.assists)}
        </div>
      </div>

      <div className="text-right text-[11px] text-lol-text tabular-nums">{player.creepScore}</div>

      <div className="flex gap-0.5">
        {player.items.slice(0, 6).map((itemId, i) => (
          <ItemIcon key={i} itemId={itemId} size={22} />
        ))}
        <div className="ml-0.5">
          <ItemIcon itemId={player.items[6] ?? 0} size={22} />
        </div>
      </div>

      <ChampionRecordCell player={player} />
    </div>
  );
}

// Everyone in a random lobby is a stranger, so this is a dash far more often
// than it is a record. It earns its column on the handful of rows where the
// person on the other side of the bridge is someone we have notes on.
function ChampionRecordCell({ player }: { player: LivePlayer }) {
  const t = useT();
  const record = player.championRecord;

  if (!record || record.games === 0) {
    return (
      <div className="text-right text-[11px] text-lol-text/40" title={t("live.noRecord")}>
        -
      </div>
    );
  }

  const losses = record.games - record.wins;
  const seen = player.overallRecord;

  return (
    <div
      className="text-right"
      title={
        seen
          ? t("live.seen", { count: seen.games }) +
            (player.gamesWithUs > 0 ? t("live.seenWithUs", { count: player.gamesWithUs }) : "")
          : undefined
      }
    >
      <div className={`text-[11px] font-medium ${winRateColor(record.wins, record.games)}`}>
        {record.wins}
        {t("common.w")} {losses}
        {t("common.l")}
      </div>
      <div className="text-[10px] text-lol-text">
        {t("recap.kda", { ratio: kdaRatio(record.kills, record.deaths, record.assists) })}
      </div>
    </div>
  );
}

const EVENT_TONES: Record<LiveEvent["tone"], string> = {
  kill: "text-lol-text-bright",
  objective: "text-sky-400",
  special: "text-lol-gold",
};

// Newest at the top, because the interesting one is always the one that just
// happened.
export function LiveEventFeed({ events }: { events: LiveEvent[] }) {
  const t = useT();
  if (events.length === 0) {
    return <div className="text-[11px] text-lol-text text-center py-6">{t("live.nothingYet")}</div>;
  }

  return (
    <div className="flex flex-col gap-1">
      {events
        .slice()
        .reverse()
        .map((event) => (
          <div key={event.id} className="flex items-baseline gap-2 text-[11px]">
            <span className="text-lol-text/60 tabular-nums shrink-0">
              {formatDuration(Math.floor(event.time))}
            </span>
            <span className={`truncate ${EVENT_TONES[event.tone]}`}>{event.text}</span>
          </div>
        ))}
    </div>
  );
}
