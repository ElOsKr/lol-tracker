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
      } text-left font-medium text-lol-text uppercase tracking-wider cursor-pointer hover:text-lol-gold select-none whitespace-nowrap ${className}`}
    >
      {label}
      {/* The arrow occupies a fixed slot on every column in every sort state, so
          moving the sort between columns cannot shift the table's layout. The
          glyph is absolutely positioned because its own advance width varies by
          font, and a slot that changes width would defeat the point. */}
      <span className="relative ml-1 inline-block w-2 align-baseline">
        <span
          className={`absolute inset-x-0 top-0 text-center text-[0.65em] leading-[1.6] ${
            sortKey === field ? "" : "invisible"
          }`}
        >
          {sortDir === "desc" ? "▼" : "▲"}
        </span>
      </span>
    </th>
  );
}
