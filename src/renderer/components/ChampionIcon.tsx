import { CHAMPION_ICON_URL } from "../lib/constants";

interface ChampionIconProps {
  championId: number;
  size?: number;
  // Square art instead of the usual round portrait, for grids that read as a
  // collection rather than as a player in a row
  rounded?: boolean;
  title?: string;
  className?: string;
}

export default function ChampionIcon({
  championId,
  size = 32,
  rounded = true,
  title,
  className = "",
}: ChampionIconProps) {
  return (
    <img
      src={CHAMPION_ICON_URL(championId)}
      alt=""
      title={title}
      width={size}
      height={size}
      className={`${rounded ? "rounded-full" : "rounded-sm"} ${className}`}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
