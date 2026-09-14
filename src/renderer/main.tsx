import { createRoot } from "react-dom/client";
import { initQueueSelection } from "./hooks/useQueueSelection";
import App from "./App";
import { initViewState } from "./lib/viewState";
import "./global.css";

const root = createRoot(document.getElementById("root")!);

// Pages read their remembered filters as they mount, so whether to remember at
// all has to be settled before the first render.
Promise.all([window.api.getSetting("remember_filters"), window.api.getSetting("selected_queue")])
  .then(([remember, queue]) => {
    initQueueSelection(queue);
    initViewState(remember === "true");
    root.render(<App />);
  })
  .catch(() => {
    root.render(
      <div role="alert" className="p-6">
        No se pudo cargar la selección de cola.{" "}
        <button onClick={() => location.reload()}>Reintentar</button>
      </div>,
    );
  });
