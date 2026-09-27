import QueueTotals from "./QueueTotals";
import { useEffect, useState } from "react";
import { useQueueSelection } from "../hooks/useQueueSelection";
import QueueSelect from "./QueueSelect";
import { hasAugments } from "../../shared/queues";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useHomePath } from "../hooks/useNavLayout";
import { useViewport } from "../hooks/useViewport";
import { useT } from "../lib/i18n";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";
import RecoveryBanner from "./RecoveryBanner";
import { LoLeandingIcon, MenuIcon } from "./icons";

// Only the very first mount of the app jumps to the chosen start page; a
// re-mount later (hot reload, recovery) must not yank the user off a page.
let openedHome = false;

// Whether the sidebar is folded down to its icons. Kept in settings so the
// choice survives a restart, like the rest of the sidebar's configuration.
const SIDEBAR_COLLAPSED_SETTING = "sidebar_collapsed";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const homePath = useHomePath();
  const viewport = useViewport();
  const t = useT();
  useEffect(() => {
    if (openedHome) return;
    openedHome = true;
    if (homePath !== "/" && location.pathname === "/") navigate(homePath, { replace: true });
    // Runs once on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [queue, setQueue] = useQueueSelection();
  const [error, setError] = useState("");

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    window.api.getSetting(SIDEBAR_COLLAPSED_SETTING).then((value) => {
      if (value === "true") setCollapsed(true);
    });
  }, []);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    void window.api.setSetting(SIDEBAR_COLLAPSED_SETTING, String(next));
  };

  // The mobile menu closes itself whenever the page changes, and never stays
  // open across a switch back to a wider layout.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, viewport]);

  const mobile = viewport === "mobile";
  const mainPadding = mobile ? "p-3" : viewport === "compact" ? "p-4" : "p-6";

  return (
    <div className="flex w-full h-full">
      {!mobile && (
        <Sidebar mode={collapsed ? "collapsed" : "expanded"} onToggleCollapse={toggleCollapsed} />
      )}
      <div className="flex flex-col flex-1 min-w-0">
        <StatusBar />
        <RecoveryBanner />
        <div
          className={`flex items-center gap-3 border-b border-lol-border ${
            mobile ? "px-3 py-2" : "px-6 py-2"
          }`}
        >
          {mobile ? (
            <>
              <button
                onClick={() => setMenuOpen(true)}
                title={t("sidebar.menu")}
                aria-label={t("sidebar.menu")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lol-text hover:bg-white/5 hover:text-lol-text-bright transition-colors"
              >
                <MenuIcon className="w-4 h-4" />
              </button>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-lol-gold/40 bg-lol-gold/10">
                <LoLeandingIcon className="w-4 h-4" />
              </div>
            </>
          ) : (
            <span>{t("queue.label")}</span>
          )}
          <QueueSelect
            value={queue}
            onChange={(value) => {
              void setQueue(value).catch(() => setError(t("queue.saveFailed")));
            }}
          />
          {error && <span role="alert">{error}</span>}
        </div>
        <QueueTotals />
        {/* @container lets every page size itself by the room it actually has,
            which is the window minus the sidebar, not the window. */}
        <main className={`scrollbar-edge @container flex-1 overflow-y-auto ${mainPadding}`}>
          {!hasAugments(queue) && location.pathname === "/augments" ? (
            <p>{t("queue.noAugments")}</p>
          ) : (
            <Outlet key={queue} />
          )}
        </main>
      </div>
      {mobile && menuOpen && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setMenuOpen(false)}>
          <div className="h-full" onClick={(e) => e.stopPropagation()}>
            <Sidebar mode="drawer" onClose={() => setMenuOpen(false)} />
          </div>
          <div className="flex-1 bg-black/60" />
        </div>
      )}
    </div>
  );
}
