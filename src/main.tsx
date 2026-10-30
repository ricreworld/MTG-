import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fonts are bundled (not loaded from Google), so the installed app works offline.
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/lexend/400.css";
import "@fontsource/lexend/600.css";
import "@fontsource/opendyslexic/400.css";
import "@fontsource/opendyslexic/700.css";
import "./index.css";
import { App } from "./App";
import { SettingsProvider, loadSettings } from "./theme/SettingsContext";
import { applySettings } from "./theme/settings";

// Apply saved settings before the first paint, so there's no flash of the wrong theme or size.
const initial = loadSettings();
applySettings(initial);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// Offline support for the installed app (production builds only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  });
}

createRoot(root).render(
  <StrictMode>
    <SettingsProvider initial={initial}>
      <App />
    </SettingsProvider>
  </StrictMode>,
);
