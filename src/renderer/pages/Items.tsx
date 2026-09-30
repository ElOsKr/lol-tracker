import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useIpc } from "../hooks/useIpc";
import { useItemData } from "../hooks/useChampions";
import { useQueueSelection } from "../hooks/useQueueSelection";
import type { ItemUsage } from "../lib/types";
import ItemIcon from "../components/ItemIcon";
import RiotText from "../components/RiotText";
import SearchInput from "../components/SearchInput";
import WinRateBar from "../components/WinRateBar";
import { EmptyState, PageLoading } from "../components/PageState";
import { LOCALE } from "../lib/format";
import { gamesLabel, useT } from "../lib/i18n";
import {
  buildCatalog,
  catalogCategories,
  filterItems,
  formatCategory,
  mergeByName,
  sortItems,
  type CatalogItem,
  type ItemSort,
} from "../lib/items";

const SORTS: ItemSort[] = ["games", "cost", "name"];

function Gold({ amount }: { amount: number }) {
  return <span className="tabular-nums text-lol-gold">{amount.toLocaleString(LOCALE)}</span>;
}

// One row of the catalogue. A button rather than a div: the whole row opens the
// item, and that has to be reachable from the keyboard like any other control.
function ItemRow({
  item,
  selected,
  onSelect,
}: {
  item: CatalogItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
        selected
          ? "border-lol-gold/50 bg-lol-card-hover"
          : "border-lol-border/60 bg-lol-card hover:bg-lol-card-hover"
      }`}
    >
      <ItemIcon itemId={item.id} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-lol-text-bright">{item.name}</span>
        <span className="block truncate text-xs text-lol-text">
          {item.categories.slice(0, 2).map(formatCategory).join(" · ") || t("items.noCategory")}
        </span>
      </span>
      <span className="hidden shrink-0 text-xs @2xl:block">
        <Gold amount={item.priceTotal} />
      </span>
      <span className="w-24 shrink-0 text-right text-xs text-lol-text">
        {item.games > 0 ? gamesLabel(t, item.games) : "—"}
      </span>
    </button>
  );
}

function ItemDetail({ item, onSelect }: { item: CatalogItem; onSelect: (id: number) => void }) {
  const t = useT();
  const items = useItemData();
  const data = items[item.id];

  const recipe = (ids: number[], label: string) =>
    ids.length > 0 && (
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-lol-text">{label}</span>
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id, index) => (
            <button
              key={`${id}-${index}`}
              type="button"
              onClick={() => onSelect(id)}
              title={items[id]?.name}
              className="rounded transition-transform hover:scale-110"
            >
              <ItemIcon itemId={id} size={32} />
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-lol-border/60 bg-lol-card p-4">
      <div className="flex items-start gap-3">
        <ItemIcon itemId={item.id} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-lol-text-bright">{item.name}</h2>
          <p className="text-xs text-lol-text">
            {item.priceTotal > 0 ? (
              <>
                <Gold amount={item.priceTotal} /> {t("items.total")}
                {item.price > 0 && item.price !== item.priceTotal && (
                  <>
                    {" · "}
                    <Gold amount={item.price} /> {t("items.combine")}
                  </>
                )}
              </>
            ) : (
              t("items.free")
            )}
          </p>
        </div>
      </div>

      {data?.description && (
        <div className="text-xs leading-relaxed text-lol-text">
          <RiotText markup={data.description} />
        </div>
      )}

      {recipe(item.from, t("items.buildsFrom"))}
      {recipe(item.to, t("items.buildsInto"))}

      <div className="flex flex-col gap-1.5 border-t border-lol-border/60 pt-3">
        <span className="text-[11px] uppercase tracking-wider text-lol-text">
          {t("items.yourGames")}
        </span>
        {item.games > 0 ? (
          <>
            {/* The count used to be a dead end: it said how many games and
                gave no way to reach them. */}
            <Link
              to={`/?item=${item.id}`}
              className="text-sm text-lol-gold transition-colors hover:text-lol-gold-light"
            >
              {t("items.openGames", { games: gamesLabel(t, item.games) })}
              <span aria-hidden> →</span>
            </Link>
            <WinRateBar wins={item.wins} total={item.games} />
          </>
        ) : (
          <span className="text-sm text-lol-text">{t("items.neverUsed")}</span>
        )}
      </div>
    </div>
  );
}

export default function Items() {
  const t = useT();
  const [queue] = useQueueSelection();
  const items = useItemData();
  const { data: usage } = useIpc<ItemUsage[]>(() => window.api.getItemUsage(queue), [queue]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [sort, setSort] = useState<ItemSort>("games");
  const [selected, setSelected] = useState<number | null>(null);

  const catalog = useMemo(() => buildCatalog(items, usage ?? []), [items, usage]);
  const categories = useMemo(() => catalogCategories(catalog), [catalog]);
  const mergedTotal = useMemo(() => mergeByName(catalog).length, [catalog]);
  const shown = useMemo(
    () => sortItems(mergeByName(filterItems(catalog, { search, category, mineOnly })), sort),
    [catalog, search, category, mineOnly, sort],
  );

  // The catalogue arrives with the item data, which loads separately from the
  // usage; either one missing means there is nothing to draw yet.
  if (!usage || catalog.length === 0) return <PageLoading />;

  // Looked up in the whole catalogue, not in what is on screen: a recipe icon
  // opens its item even when the current search would have hidden it.
  const chosen = catalog.find((item) => item.id === selected) ?? shown[0];

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold text-lol-text-bright">{t("items.title")}</h1>
        <span className="text-xs text-lol-text">
          {t("items.count", { shown: shown.length, total: mergedTotal })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder={t("items.search")} />
        <select
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label={t("items.category")}
        >
          <option value="">{t("items.allCategories")}</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {formatCategory(name)}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={sort}
          onChange={(e) => setSort(e.target.value as ItemSort)}
          aria-label={t("items.sort")}
        >
          {SORTS.map((key) => (
            <option key={key} value={key}>
              {t(`items.sort.${key}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setMineOnly((value) => !value)}
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
            mineOnly
              ? "border-lol-gold/50 bg-lol-gold/10 text-lol-gold"
              : "border-lol-border bg-lol-card text-lol-text hover:text-lol-text-bright"
          }`}
        >
          {t("items.mineOnly")}
        </button>
      </div>

      {shown.length === 0 ? (
        <EmptyState>{t("items.noMatch")}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-1">
            {shown.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                selected={chosen?.id === item.id}
                onSelect={() => setSelected(item.id)}
              />
            ))}
          </div>
          {chosen && (
            <div className="@3xl:sticky @3xl:top-0 @3xl:self-start">
              <ItemDetail item={chosen} onSelect={setSelected} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
