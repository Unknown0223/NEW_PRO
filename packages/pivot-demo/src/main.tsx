import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setPivotLocale } from "@salec/pivot-engine";
import { App } from "./App";
import "./index.css";

setPivotLocale("uz");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
