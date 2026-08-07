"use client";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { AgentDock } from "./AgentDock";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="backdrop" onClick={() => document.body.classList.remove("nav-open")} />
      <Sidebar />
      <main className="main">
        <Toolbar />
        <div className="content">
          <div className="view">{children}</div>
        </div>
      </main>
      <AgentDock />
    </div>
  );
}
