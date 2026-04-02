import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AutoRefreshProvider, TzProvider } from "./hooks.js";
import { App } from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AutoRefreshProvider>
      <TzProvider>
        <App />
      </TzProvider>
    </AutoRefreshProvider>
  </StrictMode>,
);
