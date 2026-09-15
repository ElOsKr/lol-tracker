import { useEffect } from "react";
import { useFilterOptions } from "../hooks/useFilterOptions";

export default function AccountSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (account: string | undefined) => void;
}) {
  const { accounts } = useFilterOptions();

  // Clear the selection if new data leaves it without any matching games
  useEffect(() => {
    if (value !== undefined && accounts.length > 0 && !accounts.some((a) => a.puuid === value)) {
      onChange(undefined);
    }
  }, [accounts, value, onChange]);

  // A single-account database doesn't need an account dropdown
  if (accounts.length < 2) return null;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      className="select"
    >
      <option value="">All Accounts</option>
      {accounts.map((a) => (
        <option key={a.puuid} value={a.puuid}>
          {a.name ?? "Unknown account"}
        </option>
      ))}
    </select>
  );
}
