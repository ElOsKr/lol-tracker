import { createRoot } from "react-dom/client";
import { initQueueSelection } from "./hooks/useQueueSelection";
import { initNavLayout } from "./hooks/useNavLayout";
import { initLanguage, t } from "./lib/i18n";
import { LANGUAGE_SETTING } from "../shared/i18n";
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
  window.api.getSetting(LANGUAGE_SETTING),
])
  .then(([remember, queue, navLayout, homePage, language]) => {
    initLanguage(language);
    initQueueSelection(queue);
    initNavLayout(navLayout, homePage);
    initViewState(remember === "true");
    root.render(<App />);
  })
  .catch(() => {
    // Nothing loaded, so the message itself falls back to the system language
    initLanguage(null);
    root.render(
      <div role="alert" className="p-6">
        {t("startup.failed")}{" "}
        <button onClick={() => location.reload()}>{t("startup.retry")}</button>
      </div>,
    );
  });
