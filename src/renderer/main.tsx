import { createRoot } from "react-dom/client";
import { initQueueSelection } from "./hooks/useQueueSelection";
import { initNavLayout } from "./hooks/useNavLayout";
import { HOME_PAGE_SETTING, NAV_LAYOUT_SETTING } from "../shared/navigation";
import App from "./App";
import { initViewState } from "./lib/viewState";
import "./global.css";

const root = createRoot(document.getElementById("root")!);

// Pages read their remembered filters as they mount, so whether to remember at
// all has to be settled before the first render.
Promise.all([
  window.api.getSetting("remember_filters"),
  window.api.getSetting("selected_queue"),
  window.api.getSetting(NAV_LAYOUT_SETTING),
  window.api.getSetting(HOME_PAGE_SETTING),
])
  .then(([remember, queue, navLayout, homePage]) => {
    initQueueSelection(queue);
    initNavLayout(navLayout, homePage);
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
