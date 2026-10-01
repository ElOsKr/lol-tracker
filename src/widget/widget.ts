import type {
  WidgetMatch as Match,
  WidgetSnapshot as Snapshot,
  WidgetControls,
} from "../shared/widget.js";
import type { GameNotice } from "../shared/notice.js";
import { applyWidgetAppearance, parseWidgetAppearance } from "../shared/widget-theme.js";
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
      match.placement
        ? `PUESTO ${match.placement}`
        : match.remake
          ? "REMAKE"
          : match.win
            ? "VICTORIA"
            : "DERROTA",
    ),
  );
  return card;
}
// ---- Aviso de fin de partida ----------------------------------------------
//
// Se dibuja sobre la cabecera cuando la aplicación acaba de guardar una
// partida. La cuenta atrás es la animación de la barra inferior y su final es
// lo que lo retira, así que la pausa al pasar el ratón por encima, que es una
// regla de CSS, pausa también la retirada sin nada que sincronizar aquí.
let noticeShown: number | null = null;

function scoreClass(score: number): string {
  if (score >= 9) return "score-high";
  if (score >= 7) return "score-good";
  if (score >= 5) return "score-ok";
  return "score-low";
}

function hideNotice(): void {
  const slot = document.getElementById("notice-slot");
  if (!slot) return;
  slot.replaceChildren();
  slot.hidden = true;
}

function renderNotice(notice: GameNotice): void {
  const slot = document.getElementById("notice-slot");
  if (!slot) return;

  const card = element("div", `notice-card ${notice.win ? "win" : "loss"}`);

  const open = element("button", "notice-open");
  open.type = "button";
  open.title = "Ver el resumen de la partida";
  const head = element("div", "notice-head");
  const fallback = `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/29.png`;
  head.append(
    image(
      notice.championId ? `${CDRAGON}v1/champion-icons/${notice.championId}.png` : fallback,
      "notice-icon",
      "Campeón",
      fallback,
    ),
  );
  const lines = element("div", "notice-lines");
  lines.append(
    element("div", "notice-result", notice.win ? "VICTORIA" : "DERROTA"),
    element("div", "notice-kda", `${notice.kills} / ${notice.deaths} / ${notice.assists}`),
  );
  head.append(lines);
  if (notice.score !== null) {
    head.append(
      element("div", `notice-score ${scoreClass(notice.score)}`, notice.score.toFixed(1)),
    );
  }
  open.append(head);
  if (notice.highlight) open.append(element("div", "notice-highlight", notice.highlight));
  open.addEventListener("click", () => {
    hideNotice();
    window.widgetControls?.openRecap();
  });

  const close = element("button", "notice-close", "×");
  close.type = "button";
  close.title = "Cerrar el aviso";
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    hideNotice();
  });

  const bar = element("div", "notice-bar");
  bar.addEventListener("animationend", hideNotice);

  card.append(open, close, bar);
  slot.replaceChildren(card);
  slot.hidden = false;
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
    // Una sola vez por partida: la instantánea sigue trayendo el mismo aviso
    // durante unos segundos y no debe reaparecer después de cerrarlo.
    if (data.notice && data.notice.gameId !== noticeShown) {
      noticeShown = data.notice.gameId;
      renderNotice(data.notice);
    }
    const container = document.getElementById("matches-container");
    // El recorte va aquí y no en el servidor: la misma instantánea alimenta a
    // la ventana del escritorio y a cuantas fuentes de OBS haya, y cada una
    // puede pedir un número distinto.
    const visible =
      appearance.matches == null ? data.matches : data.matches.slice(0, appearance.matches);
    const cards = JSON.stringify([version, visible]);
    if (container && cards !== lastCards) {
      container.replaceChildren(
        ...(visible.length
          ? visible.map(renderMatchCard)
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
// El aspecto se decide antes del primer dibujo, para que la fuente de OBS no
// parpadee del tema por defecto al elegido.
const appearance = parseWidgetAppearance(location.search);
applyWidgetAppearance(document.documentElement, appearance);

const controls = document.getElementById("window-controls");
if (!window.widgetControls && controls) controls.hidden = true;
document
  .getElementById("minimize-btn")
  ?.addEventListener("click", () => window.widgetControls?.minimize());
document
  .getElementById("close-btn")
  ?.addEventListener("click", () => window.widgetControls?.close());
void updateWidget();
