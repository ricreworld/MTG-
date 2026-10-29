import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { SettingsProvider, loadSettings } from "./theme/SettingsContext";
import { applySettings } from "./theme/settings";

// Apply saved settings before the first paint, so there's no flash of the wrong theme or size.
const initial = loadSettings();
applySettings(initial);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <SettingsProvider initial={initial}>
      <App />
    </SettingsProvider>
  </StrictMode>,
);
