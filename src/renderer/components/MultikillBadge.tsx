interface MultikillBadgeProps {
  doubles: number;
  triples: number;
  quadras: number;
  pentas: number;
  // Initials instead of words, for a row that has a gap rather than a column to
  // spare. A double kill is common enough that spelling it out ten times over
  // would be the loudest thing on a scoreboard.
  compact?: boolean;
}

export default function MultikillBadge({
  doubles,
  triples,
  quadras,
  pentas,
  compact = false,
}: MultikillBadgeProps) {
  const badges: { label: string; count: number; color: string }[] = [];

  if (doubles > 0)
    badges.push({ label: "DOUBLE", count: doubles, color: "bg-sky-500/20 text-sky-400" });
  if (triples > 0)
    badges.push({ label: "TRIPLE", count: triples, color: "bg-amber-500/20 text-amber-400" });
  if (quadras > 0)
    badges.push({ label: "QUADRA", count: quadras, color: "bg-purple-500/20 text-purple-400" });
  if (pentas > 0)
    badges.push({ label: "PENTA", count: pentas, color: "bg-red-500/20 text-red-400" });

  if (badges.length === 0) return null;

  if (compact) {
    return (
      <div className="flex gap-1">
        {badges.map(({ label, count, color }) => (
          <span
            key={label}
            title={`${label[0]}${label.slice(1).toLowerCase()} kill${count > 1 ? `s x${count}` : ""}`}
            className={`text-[10px] font-bold leading-none px-1 py-[3px] rounded tabular-nums ${color}`}
          >
            {label[0]}
            {count > 1 ? count : ""}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {badges.map(({ label, count, color }) => (
        <span key={label} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>
          {label}
          {count > 1 ? ` x${count}` : ""}
        </span>
      ))}
    </div>
  );
}
