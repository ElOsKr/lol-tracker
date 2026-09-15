import { useEffect } from "react";
import { useFilterOptions } from "../hooks/useFilterOptions";
import { formatPatch } from "../lib/format";

export default function PatchSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (patch: string | undefined) => void;
}) {
  const { patches } = useFilterOptions();

  // Clear the selection if new data leaves it without any matching games
  useEffect(() => {
    if (value !== undefined && patches.length > 0 && !patches.includes(value)) {
      onChange(undefined);
    }
  }, [patches, value, onChange]);

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      className="select"
    >
      <option value="">All Patches</option>
      {patches.map((p) => (
        <option key={p} value={p}>
          Patch {formatPatch(p)}
        </option>
      ))}
    </select>
  );
}
