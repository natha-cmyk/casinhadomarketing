"use client";
// Menu lateral do Admin — mesmo visual do app (classes .sidebar/.nav-item), nav próprio.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ic } from "@/components/Ic";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: "overview" },
  { href: "/admin/usuarios", label: "Usuários", icon: "leads" },
  { href: "/admin/conexoes", label: "Conexões", icon: "ext" },
  { href: "/admin/comunicacao", label: "Comunicação", icon: "ads" },
];

export function AdminSidebar({ email }: { email?: string | null }) {
  const path = usePathname();
  return (
    <aside className="sidebar" style={{ padding: "16px 12px", gap: 8 }}>
      <div className="brand" style={{ padding: "0 6px 6px" }}>
        <div className="mark" style={{ background: "linear-gradient(150deg,#00BBC5,#0a8a91)", boxShadow: "0 2px 6px rgba(0,187,197,.28)" }}>A</div>
        <div>
          <h1>Admin</h1>
          <p>Saúde da plataforma</p>
        </div>
      </div>
      <nav style={{ flex: 1, overflowY: "auto" }}>
        <div className="nav-group">
          <h2>Administração</h2>
          {NAV.map((n) => {
            const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`nav-item${active ? " active" : ""}`}>
                <span className="ico"><Ic name={n.icon} /></span>
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div style={{ marginTop: "auto" }}>
        {email && <div style={{ fontSize: 11, color: "var(--label-3)", padding: "0 8px 8px", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>}
        <Link href="/" className="nav-item">
          <span className="ico"><Ic name="ext" /></span>
          Voltar ao painel
        </Link>
      </div>
    </aside>
  );
}
