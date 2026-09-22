import type { SortDir } from "../hooks/useSort";

// A clickable column header carrying the sort arrow. Spread what useSort
// returns to wire one up: <SortHeader {...sort} label="Games" field="games" />.
export default function SortHeader<K extends string>({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
  compact = false,
  className = "",
}: {
  label: string;
  field: K;
  sortKey: K;
  sortDir: SortDir;
  onSort: (field: K) => void;
  // Tighter for the two narrow tables that sit side by side on a champion page
  compact?: boolean;
  className?: string;
}) {
  return (
    <th
      onClick={() => onSort(field)}
      className={`${
        compact ? "px-2 py-2 text-[11px]" : "px-3 py-2 text-xs"
      } text-left font-medium text-lol-text uppercase tracking-wider cursor-pointer hover:text-lol-gold select-none ${className}`}
    >
      {label} {sortKey === field ? (sortDir === "desc" ? "▼" : "▲") : ""}
    </th>
  );
}
