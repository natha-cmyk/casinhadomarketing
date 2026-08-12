"use client";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { AgentDock } from "./AgentDock";
import { ChartTooltips } from "../ChartTooltips";
import { Hydrator } from "../Hydrator";
import { Spinner } from "../Spinner";
import { useStore } from "@/lib/store";

export function Shell({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  return (
    <div className="app">
      <div className="backdrop" onClick={() => document.body.classList.remove("nav-open")} />
      <Sidebar />
      <main className="main">
        <Toolbar />
        <div className="content">
          <div className="view">{hydrated ? children : <Spinner texto="Carregando seu ambiente…" />}</div>
        </div>
      </main>
      <AgentDock />
      <ChartTooltips />
      <Hydrator />
    </div>
  );
}
