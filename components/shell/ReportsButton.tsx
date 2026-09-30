"use client";
// Botão global (na toolbar) que abre a biblioteca/geração de relatórios do painel atual.
import { useState } from "react";
import { usePathname } from "next/navigation";
import { viewForPath } from "@/lib/nav";
import { ReportsModal } from "./ReportsModal";

export function ReportsButton() {
  const [open, setOpen] = useState(false);
  const view = viewForPath(usePathname());
  return (
    <>
      <button className={"tb-toggle tb-reports" + (open ? " on" : "")} onClick={() => setOpen(true)} type="button" title="Relatórios do painel (gerar com assistente + biblioteca)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9.5 12h5M9.5 16h3.5" />
        </svg>
        Relatórios
      </button>
      {open && <ReportsModal view={view} onClose={() => setOpen(false)} />}
    </>
  );
}
