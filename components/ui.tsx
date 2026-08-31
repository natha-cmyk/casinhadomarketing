"use client";
// Primitivas de UI — emitem as MESMAS classes do blueprint (fidelidade 1:1).
import type { ReactNode } from "react";
import type { Delta, StatusTier } from "@/lib/scope";
import { Ic } from "./Ic";

export function Card({
  children,
  padLg,
  className = "",
  style,
}: {
  children: ReactNode;
  padLg?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card${padLg ? " pad-lg" : ""}${className ? " " + className : ""}`} style={style}>
      {children}
    </div>
  );
}

export function CardHead({
  title,
  sub,
  badge,
  right,
}: {
  title: string;
  sub?: string;
  badge?: string;
  right?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div>
        <div className="t">{title}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {badge && <span className="badge">{badge}</span>}
      {right}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function Chip({ kind = "flat", children }: { kind?: "up" | "down" | "flat" | "scn"; children: ReactNode }) {
  return <span className={`chip ${kind}`}>{children}</span>;
}

export function DeltaChip({ delta, label, scn }: { delta: Delta; label?: string; scn?: boolean }) {
  const kind = scn ? "scn" : delta.kind;
  return (
    <span className={`chip ${kind}`}>
      {delta.pctLabel}
      {delta.numLabel ? " · " + delta.numLabel : ""}
      {label ? " " + label : ""}
    </span>
  );
}

export function Pill({ tier, children }: { tier: StatusTier; children: ReactNode }) {
  return <span className={`pill ${tier}`}>{children}</span>;
}

export function PageHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {/* legenda sob o título REMOVIDA de todos os ambientes (decisão de produto).
            `desc` fica na assinatura só por compat; não renderiza mais. */}
      </div>
      {right}
    </div>
  );
}

export function Insight({ color = "var(--cyan)", icon, children }: { color?: string; icon?: string; children: ReactNode }) {
  return (
    <div className="insight">
      <div className="ib" style={{ background: color }}>
        {icon ? <Ic name={icon} /> : null}
      </div>
      <p>{children}</p>
    </div>
  );
}

export function BarRow({ k, v, max, color, formatted }: { k: string; v: number; max: number; color: string; formatted?: string }) {
  return (
    <div className="bar-row">
      <div className="k">{k}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${(v / max) * 100 || 0}%`, background: color }} />
      </div>
      <div className="v tnum">{formatted ?? v.toLocaleString("pt-BR")}</div>
    </div>
  );
}

export function MiniStat({ l, n }: { l: string; n: ReactNode }) {
  return (
    <div className="m">
      <div className="l">{l}</div>
      <div className="n tnum">{n}</div>
    </div>
  );
}

export function KpiCard({
  lbl,
  val,
  foot,
  children,
  tone,
}: {
  lbl: string;
  val: ReactNode;
  foot?: ReactNode;
  children?: ReactNode; // bloco de comparação (cmp)
  tone?: "pos" | "neg"; // realça o valor (ganho = verde, perda = vermelho)
}) {
  const color = tone === "pos" ? "var(--excelente)" : tone === "neg" ? "var(--red)" : undefined;
  return (
    <div className="card kpi">
      <div className="lbl">{lbl}</div>
      <div className="val tnum" style={color ? { color } : undefined}>{val}</div>
      {children && <div className="cmp">{children}</div>}
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

export interface SegOption {
  value: string;
  label: string;
}
export function Segmented({
  options,
  value,
  onChange,
  small,
}: {
  options: SegOption[];
  value: string;
  onChange: (v: string) => void;
  small?: boolean;
}) {
  return (
    <div className={`seg${small ? " small" : ""}`}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" className={`switch${on ? " on" : ""}`} aria-pressed={on} onClick={() => onChange(!on)} />;
}

// Placeholder de seção (usado nas páginas antes do Bloco 3)
export function ScaffoldHero({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="card pad-lg">
      <div className="scaffold-hero">
        <div className="icon">
          <Ic name={icon} />
        </div>
        <div>
          <span className="soon">Em construção · Bloco 3</span>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>{title}</div>
          <p style={{ color: "var(--label-2)", margin: "4px 0 0", fontSize: 13.5 }}>{desc}</p>
        </div>
      </div>
    </div>
  );
}
