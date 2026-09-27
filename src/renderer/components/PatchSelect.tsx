import { useEffect } from "react";
import { useFilterOptions } from "../hooks/useFilterOptions";
import { formatPatch } from "../lib/format";
import { useT } from "../lib/i18n";

export default function PatchSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (patch: string | undefined) => void;
}) {
  const { patches } = useFilterOptions();
  const t = useT();

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
      <option value="">{t("history.allPatches")}</option>
      {patches.map((p) => (
        <option key={p} value={p}>
          {t("history.patchLabel", { patch: formatPatch(p) })}
        </option>
      ))}
    </select>
  );
}
