import type {
  WidgetMatch as Match,
  WidgetSnapshot as Snapshot,
  WidgetControls,
} from "../shared/widget.js";
declare global {
  interface Window {
    widgetControls?: WidgetControls;
  }
}
let version = "14.10.1";
const CDRAGON =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/";
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function image(
  url: string | null,
  className: string,
  alt: string,
  fallback?: string,
): HTMLImageElement {
  const img = element("img", className);
  img.alt = alt;
  // Los datos remotos se insertan con DOM/textContent, nunca como HTML.
  const allowed = (value: string): boolean => {
    try {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        ["raw.communitydragon.org", "ddragon.leagueoflegends.com"].includes(u.hostname)
      );
    } catch {
      return false;
    }
  };
  if (url && allowed(url)) img.src = url;
  else img.style.visibility = "hidden";
  img.addEventListener("error", () => {
    if (fallback && allowed(fallback)) {
      img.src = fallback;
      fallback = undefined;
    } else img.style.visibility = "hidden";
  });
  return img;
}
function renderMatchCard(match: Match): HTMLElement {
  const card = element("div", `match-card ${match.win ? "win" : "loss"}`);
  const champion = element("div", "champion-container");
  const fallback = `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/29.png`;
  champion.append(
    image(
      match.championId ? `${CDRAGON}v1/champion-icons/${match.championId}.png` : fallback,
      "champ-icon",
      "Campeón",
      fallback,
    ),
  );
  const stats = element("div", "stats-container");
  stats.append(
    element(
      "div",
      "kda",
      match.kills === undefined
        ? "Detalles no disponibles"
        : `${match.kills} / ${match.deaths ?? 0} / ${match.assists ?? 0}`,
    ),
  );
  const augments = element("div", "augments-list");
  for (const aug of match.augments || []) {
    const rarity = String(aug.rarity).toLowerCase();
    const tier =
      rarity.includes("gold") || rarity === "2"
        ? "gold"
        : rarity.includes("prismatic") || rarity.includes("epic") || rarity === "3"
          ? "prismatic"
          : "silver";
    const row = element("div", "augment-row");
    row.append(
      image(
        aug.url,
        `augment-icon rarity-${tier}`,
        aug.nameTRA,
        aug.url?.includes("/ux/cherry/") ? aug.url.replace("/ux/cherry/", "/ux/kiwi/") : undefined,
      ),
    );
    const name = element("span", `augment-name text-rarity-${tier}`, aug.nameTRA);
    name.title = aug.nameTRA;
    row.append(name);
    augments.append(row);
  }
  const items = element("div", "items-list");
  for (const [index, id] of (match.items || []).entries()) {
    if (!Number.isInteger(id) || id <= 0) continue;
    items.append(
      image(
        match.itemIcons[index] ||
          `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`,
        "item-icon",
        `Objeto ${id}`,
        id === 2501 ? `${CDRAGON}assets/items/icons2d/overlordsbloodmail.png` : undefined,
      ),
    );
  }
  stats.append(augments, items);
  card.append(
    champion,
    stats,
    element(
      "div",
      `badge badge-${match.win ? "win" : "loss"}`,
      match.remake ? "REMAKE" : match.win ? "VICTORIA" : "DERROTA",
    ),
  );
  return card;
}
function setText(id: string, value: string, className?: string): void {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
    if (className) node.className = className;
  }
}
let lastCards = "";
async function updateWidget(): Promise<void> {
  let interval = 15000;
  try {
    const data: Snapshot = window.widgetControls
      ? await window.widgetControls.snapshot()
      : await fetch("/api/matches", { cache: "no-store", signal: AbortSignal.timeout(10000) }).then(
          (response) => {
            if (!response.ok) throw new Error("Aplicación no disponible");
            return response.json();
          },
        );
    if (!Array.isArray(data.matches)) throw new Error("Respuesta del servidor inválida.");
    interval = Math.max(1000, Math.min(data.pollIntervalMs || 15000, 3600000));
    if (/^\d+\.\d+\.\d+$/.test(data.assetVersion)) version = data.assetVersion;
    setText("summoner-name", data.summonerName);
    setText(
      "winrate-count",
      `${data.totalWinrate}%`,
      data.totalWinrate >= 50 ? "text-rarity-gold" : "text-rarity-silver",
    );
    setText("record-wins", `${data.totalWins}W`);
    setText("record-losses", `${data.totalLosses}L`);
    setText("total-matches-count", `${data.totalMatches} part.`);
    setText(
      "streak-count",
      (data.streak > 0 ? `+${data.streak}` : String(data.streak)) + (data.streakLimited ? "…" : ""),
      `streak-val streak-${data.streak > 0 ? "win" : data.streak < 0 ? "loss" : "neutral"}`,
    );
    setText("connection-status", data.connected ? "" : data.error || "Conectando con LoL...");
    const container = document.getElementById("matches-container");
    const cards = JSON.stringify([version, data.matches]);
    if (container && cards !== lastCards) {
      container.replaceChildren(
        ...(data.matches.length
          ? data.matches.map(renderMatchCard)
          : [element("div", "no-matches", "Esperando partidas...")]),
      );
      lastCards = cards;
    }
  } catch (error) {
    setText(
      "connection-status",
      error instanceof Error ? error.message : "Servidor no disponible.",
    );
  } finally {
    setTimeout(() => {
      void updateWidget();
    }, interval);
  }
}
const controls = document.getElementById("window-controls");
if (!window.widgetControls && controls) controls.hidden = true;
document
  .getElementById("minimize-btn")
  ?.addEventListener("click", () => window.widgetControls?.minimize());
document
  .getElementById("close-btn")
  ?.addEventListener("click", () => window.widgetControls?.close());
void updateWidget();
