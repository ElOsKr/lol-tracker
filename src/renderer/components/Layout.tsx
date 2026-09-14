import { useState } from "react";
import { useQueueSelection } from "../hooks/useQueueSelection";
import QueueSelect from "./QueueSelect";
import { QUEUE_ID_ARAM } from "../../shared/queues";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";
import RecoveryBanner from "./RecoveryBanner";

export default function Layout() {
  const location = useLocation();
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
        <main className="scrollbar-edge flex-1 overflow-y-auto p-6">
          {queue === QUEUE_ID_ARAM && location.pathname === "/augments" ? (
            <p>ARAM normal no utiliza aumentos. Elige ARAM Caos para consultar sus estadísticas.</p>
          ) : (
            <Outlet key={queue} />
          )}
        </main>
      </div>
    </div>
  );
}
