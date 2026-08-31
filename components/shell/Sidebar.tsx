"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV, SOCIAL_IDS, pathForView, viewForPath } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { Ic } from "../Ic";
import { AccountFooter } from "../AccountFooter";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const redes = useStore((s) => s.redes);
  const empresa = useStore((s) => s.perfil.empresa);
  const logoUrl = useStore((s) => s.perfil.logoUrl);
  const [q, setQ] = useState("");
  const view = viewForPath(pathname);
  const query = q.trim().toLowerCase();

  const go = (id: string) => {
    router.push(pathForView(id));
    if (typeof document !== "undefined") document.body.classList.remove("nav-open");
  };

  return (
    <aside className="sidebar">
      <div className="sb-top">
        <div className="traffic">
          <i />
          <i />
          <i />
        </div>
        <div className="brand">
          <div className="mark">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
            ) : (
              (empresa?.trim()?.[0] || "C").toUpperCase()
            )}
          </div>
          <div>
            <h1>Casinha do Marketing</h1>
            <p>{(empresa?.trim() || "Sua empresa")} · 2026</p>
          </div>
        </div>
      </div>
      <div className="search">
        <div className="field">
          <Ic name="ext" />
          <input
            placeholder="Buscar seção…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar seção"
          />
        </div>
      </div>
      <nav className="nav">
        {NAV.map((g) => {
          const items = g.items.filter((it) => {
            // redes sociais só aparecem se ligadas em Personalização
            if (SOCIAL_IDS.includes(it.id) && !redes[it.id]) return false;
            if (query && !(it.label.toLowerCase().includes(query) || g.group.toLowerCase().includes(query)))
              return false;
            return true;
          });
          if (!items.length) return null;
          return (
            <div className="nav-group" key={g.group}>
              <h2>{g.group}</h2>
              {items.map((it) => (
                <button
                  key={it.id}
                  className={`nav-item${it.id === view ? " active" : ""}`}
                  onClick={() => go(it.id)}
                  type="button"
                >
                  <span className="ico">
                    <Ic name={it.icon} />
                  </span>
                  {it.label}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
      <AccountFooter />
    </aside>
  );
}
