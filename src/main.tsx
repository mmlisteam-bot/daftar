import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/app-shell";
import "./styles.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
