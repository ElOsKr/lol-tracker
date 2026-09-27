import QueueTotals from "./QueueTotals";
import { useEffect, useState } from "react";
import { useQueueSelection } from "../hooks/useQueueSelection";
import QueueSelect from "./QueueSelect";
import { hasAugments } from "../../shared/queues";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useHomePath } from "../hooks/useNavLayout";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";
import RecoveryBanner from "./RecoveryBanner";

// Only the very first mount of the app jumps to the chosen start page; a
// re-mount later (hot reload, recovery) must not yank the user off a page.
let openedHome = false;

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const homePath = useHomePath();
  useEffect(() => {
    if (openedHome) return;
    openedHome = true;
    if (homePath !== "/" && location.pathname === "/") navigate(homePath, { replace: true });
    // Runs once on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [queue, setQueue] = useQueueSelection();
  const [error, setError] = useState("");
  return (
    <div className="flex w-full h-full">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <StatusBar />
        <RecoveryBanner />
        <div className="flex items-center gap-3 px-6 py-2 border-b border-lol-border">
          <span>Cola</span>
          <QueueSelect
            value={queue}
            onChange={(value) => {
              void setQueue(value).catch(() => setError("No se pudo guardar la cola"));
            }}
          />
          {error && <span role="alert">{error}</span>}
        </div>
        <QueueTotals />
        <main className="scrollbar-edge flex-1 overflow-y-auto p-6">
          {!hasAugments(queue) && location.pathname === "/augments" ? (
            <p>
              Esta cola no utiliza los aumentos de Mayhem. Elige ARAM Caos para consultar sus
              estadísticas.
            </p>
          ) : (
            <Outlet key={queue} />
          )}
        </main>
      </div>
    </div>
  );
}
