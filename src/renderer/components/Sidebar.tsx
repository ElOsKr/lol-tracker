import { useSidebarItems } from "../hooks/useSidebarItems";
import { type NavItemId } from "../../shared/navigation";
import { onSyncRequested } from "../lib/shortcuts";
import { t as translate, useT } from "../lib/i18n";
import { NavLink } from "react-router-dom";
import { useState, useCallback, useEffect, useRef, type ComponentType, type SVGProps } from "react";
import { useLcuStatus } from "../hooks/useLcuStatus";
import { useBackfill } from "../hooks/useBackfill";
import type { LcuStatus, UpdateInfo } from "../lib/types";
import UpdateDialog from "./UpdateDialog";
import {
  LoLeandingIcon,
  HomeIcon,
  ItemsIcon,
  SwordsIcon,
  TrophyIcon,
  CrosshairIcon,
  UsersIcon,
  GlobeIcon,
  TrendingUpIcon,
  MedalIcon,
  SettingsIcon,
  RefreshIcon,
  RadioIcon,
  HourglassIcon,
  AwardIcon,
  RadarIcon,
  PanelLeftIcon,
  XIcon,
} from "./icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Paths and labels live in shared/navigation so Settings can list the same
// pages; only the icons are the sidebar's business.
const icons: Record<NavItemId, IconComponent> = {
  home: HomeIcon,
  history: SwordsIcon,
  live: RadioIcon,
  champions: TrophyIcon,
  augments: CrosshairIcon,
  items: ItemsIcon,
  friends: UsersIcon,
  trends: TrendingUpIcon,
  skills: RadarIcon,
  records: MedalIcon,
  widget: HourglassIcon,
  challenges: AwardIcon,
  global: GlobeIcon,
};

// The app is often left open for days, so a launch-only check would never
// surface a release cut in the meantime.
const UPDATE_POLL_MS = 6 * 60 * 60 * 1000;

const statusColors: Record<LcuStatus, string> = {
  connected: "bg-lol-win",
  ingame: "bg-sky-400",
  connecting: "bg-amber-500",
  disconnected: "bg-lol-loss",
};

const statusLabels = {
  connected: "status.connected",
  ingame: "status.ingame",
  connecting: "status.connecting",
  disconnected: "status.disconnected",
} as const satisfies Record<LcuStatus, string>;

// How the sidebar is shown: the full column, the same column folded down to
// its icons, or a drawer pulled over a narrow window from its menu button.
export type SidebarMode = "expanded" | "collapsed" | "drawer";

function NavItem({
  to,
  label,
  icon: Icon,
  iconsOnly,
  shortcut,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: IconComponent;
  iconsOnly: boolean;
  // The number key that opens this page, for the first nine
  shortcut?: number;
  // Drawer only: closes it, even when the page tapped is the one already open
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      title={shortcut ? `${label} · ${shortcut}` : iconsOnly ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md text-[13px] font-medium transition-colors ${
          iconsOnly ? "justify-center px-0 py-2.5" : "px-3 py-2"
        } ${
          isActive
            ? "bg-lol-gold/10 text-lol-gold"
            : "text-lol-text hover:bg-white/5 hover:text-lol-text-bright"
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!iconsOnly && <span>{label}</span>}
    </NavLink>
  );
}

export default function Sidebar({
  mode,
  onToggleCollapse,
  onClose,
}: {
  mode: SidebarMode;
  // Expanded and collapsed only: folds the column or unfolds it
  onToggleCollapse?: () => void;
  // Drawer only: the close button and what a navigation does
  onClose?: () => void;
}) {
  const items = useSidebarItems();
  const t = useT();
  const status = useLcuStatus();
  const { running: backfilling, progress, percent } = useBackfill();
  const [refreshing, setRefreshing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const iconsOnly = mode === "collapsed";

  // Read inside the poll instead of as an effect dep, so opening the dialog
  // doesn't restart the interval
  const dialogOpenRef = useRef(false);
  useEffect(() => {
    dialogOpenRef.current = showUpdateDialog;
  }, [showUpdateDialog]);

  useEffect(() => {
    window.api.getVersion().then(setVersion);

    const check = () =>
      window.api.checkForUpdate().then((info) => {
        // A failed poll shouldn't clear a badge an earlier check earned
        setUpdate((prev) => (info.error && prev ? prev : info));
      });
    check();
    const timer = setInterval(() => {
      // Skip while the dialog is up: swapping the release out from under an
      // in-progress download would invalidate the URL being installed
      if (!dialogOpenRef.current) check();
    }, UPDATE_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lastResult) return;
    const timer = setTimeout(() => setLastResult(null), 10_000);
    return () => clearTimeout(timer);
  }, [lastResult]);

  useEffect(
    () =>
      window.api.onBackfillDone((result) => {
        if ("error" in result) {
          setLastResult(translate("sidebar.importFailed", { error: result.error }));
        } else if (result.cancelled) {
          setLastResult(translate("sidebar.importStopped", { count: result.added }));
        } else if (result.added > 0) {
          setLastResult(translate("sidebar.imported", { count: result.added }));
        }
      }),
    [],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setLastResult(null);
    try {
      const result = await window.api.refreshGames();
      if ("error" in result) {
        setLastResult(translate("sidebar.error", { error: result.error }));
      } else {
        setLastResult(
          result.newGames > 0
            ? translate("sidebar.foundNew", { count: result.newGames })
            : translate("sidebar.noNew"),
        );
      }
    } catch (err: any) {
      // Strip Electron's IPC wrapper so only the underlying message shows
      const message = String(err?.message ?? err).replace(
        /^Error invoking remote method '[^']+': (Error: )?/,
        "",
      );
      setLastResult(translate("sidebar.error", { error: message }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Ctrl+R asks from wherever the user is; the same conditions as the button
  // decide whether there is anything to start.
  useEffect(
    () =>
      onSyncRequested(() => {
        if (!refreshing && !backfilling) void handleRefresh();
      }),
    [handleRefresh, refreshing, backfilling],
  );

  const statusText = t(statusLabels[status]);
  const syncButton = backfilling ? (
    <button
      onClick={() => window.api.cancelBackfill()}
      title={iconsOnly ? t("sidebar.cancel") : undefined}
      className={`flex items-center gap-1.5 text-xs rounded-md border border-lol-border bg-white/5 text-lol-text hover:text-lol-text-bright hover:bg-white/10 transition-colors ${
        iconsOnly ? "h-8 w-8 justify-center" : "px-2.5 py-1"
      }`}
    >
      {iconsOnly ? <XIcon className="w-3 h-3" /> : t("sidebar.cancel")}
    </button>
  ) : (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      title={iconsOnly ? (refreshing ? t("sidebar.syncing") : t("sidebar.sync")) : undefined}
      className={`flex items-center gap-1.5 text-xs rounded-md border border-lol-gold/25 bg-lol-gold/10 text-lol-gold hover:bg-lol-gold/20 disabled:opacity-50 transition-colors ${
        iconsOnly ? "h-8 w-8 justify-center" : "px-2.5 py-1"
      }`}
    >
      <RefreshIcon className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
      {!iconsOnly && (refreshing ? t("sidebar.syncing") : t("sidebar.sync"))}
    </button>
  );

  return (
    <nav
      className={`border-r border-lol-border/60 flex flex-col shrink-0 h-full ${
        mode === "drawer"
          ? // no-drag: the drawer lies over the title bar, whose drag region would
            // otherwise swallow the clicks on its header and close button
            "titlebar-no-drag w-64 bg-lol-dark shadow-xl shadow-black/50"
          : `bg-lol-card/60 ${iconsOnly ? "w-14" : "w-56"}`
      }`}
    >
      <div
        className={`${mode === "drawer" ? "" : "titlebar-drag"} h-14 shrink-0 flex items-center gap-2.5 border-b border-lol-border/40 ${
          iconsOnly ? "justify-center px-0" : "px-4"
        }`}
      >
        <div className="w-7 h-7 rounded-lg border border-lol-gold/40 bg-lol-gold/10 flex items-center justify-center shrink-0">
          <LoLeandingIcon className="w-5 h-5" />
        </div>
        {!iconsOnly && (
          <div className="flex flex-col justify-center leading-none min-w-0">
            <span className="font-bold text-[15px] tracking-[0.02em] text-lol-text-bright">
              LoLeanding
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.35em] text-lol-text/80 mt-1">
              {t("sidebar.tracker")}
            </span>
          </div>
        )}
        {mode === "drawer" && (
          <button
            onClick={onClose}
            title={t("sidebar.closeMenu")}
            aria-label={t("sidebar.closeMenu")}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-lol-text hover:bg-white/5 hover:text-lol-text-bright transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      {mode !== "drawer" && (
        <div
          className={`titlebar-no-drag flex px-3 pt-2 ${iconsOnly ? "justify-center" : "justify-end"}`}
        >
          <button
            onClick={onToggleCollapse}
            title={iconsOnly ? t("sidebar.expand") : t("sidebar.collapse")}
            aria-label={iconsOnly ? t("sidebar.expand") : t("sidebar.collapse")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-lol-text/70 hover:bg-white/5 hover:text-lol-text-bright transition-colors"
          >
            <PanelLeftIcon
              className={`w-4 h-4 transition-transform ${iconsOnly ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      )}
      <div className={`flex flex-col gap-0.5 mt-1 flex-1 ${iconsOnly ? "px-2 py-2" : "p-3"}`}>
        {items.map((item, index) => (
          <NavItem
            key={item.id}
            to={item.path}
            label={t(`nav.${item.id}`)}
            // The first nine pages answer to their number, so the tooltip is
            // where that gets discovered
            shortcut={index < 9 ? index + 1 : undefined}
            icon={icons[item.id]}
            iconsOnly={iconsOnly}
            onNavigate={mode === "drawer" ? onClose : undefined}
          />
        ))}
      </div>
      <div className={`pb-1 ${iconsOnly ? "px-2" : "px-3"}`}>
        <NavItem
          to="/settings"
          label={t("nav.settings")}
          icon={SettingsIcon}
          iconsOnly={iconsOnly}
          onNavigate={mode === "drawer" ? onClose : undefined}
        />
      </div>
      <div
        className={`border-t border-lol-border/60 flex flex-col gap-2 ${
          iconsOnly ? "items-center p-2" : "p-3"
        }`}
      >
        {!iconsOnly && lastResult && !backfilling && (
          <span className="text-xs text-lol-text truncate" title={lastResult}>
            {lastResult}
          </span>
        )}
        {backfilling && (
          <div className="flex flex-col gap-1.5 w-full">
            {!iconsOnly && (
              <span className="text-xs text-lol-text truncate">
                {progress && progress.total > 0
                  ? t("sidebar.importingProgress", {
                      current: progress.current,
                      total: progress.total,
                    })
                  : t("sidebar.importing")}
              </span>
            )}
            <div className="h-1 rounded-full bg-lol-border overflow-hidden">
              <div
                className="h-full bg-lol-gold transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
        {iconsOnly ? (
          <>
            <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} title={statusText} />
            {syncButton}
            {update?.hasUpdate && (
              <button
                onClick={() => setShowUpdateDialog(true)}
                title={t("sidebar.updateAvailable", { version: update.latest ?? "" })}
                className="h-2 w-2 rounded-full bg-lol-gold hover:bg-lol-gold-light transition-colors cursor-pointer"
              />
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                <span className="text-xs text-lol-text">{statusText}</span>
              </div>
              {syncButton}
            </div>
            <div className="flex items-center justify-between mt-1">
              <button
                onClick={() =>
                  window.api.openUrl(
                    `https://github.com/ElOsKr/lol-tracker/releases/tag/v${version}`,
                  )
                }
                className="text-[10px] text-lol-text/50 hover:text-lol-text transition-colors cursor-pointer"
              >
                v{version}
              </button>
              {update?.hasUpdate && (
                <button
                  onClick={() => setShowUpdateDialog(true)}
                  className="text-[10px] text-lol-gold hover:text-lol-gold-light transition-colors cursor-pointer"
                >
                  {t("sidebar.updateAvailable", { version: update.latest ?? "" })}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {showUpdateDialog && update && (
        <UpdateDialog update={update} onClose={() => setShowUpdateDialog(false)} />
      )}
    </nav>
  );
}
