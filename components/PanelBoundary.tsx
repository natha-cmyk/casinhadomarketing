"use client";
// Error boundary de GRANULARIDADE FINA: isola um bloco/widget. Se um card quebra ao renderizar,
// mostra um fallback pequeno NO LUGAR do card — o resto da página segue vivo (não derruba tudo).
// Usado centralmente no WidgetBoard (cobre todos os painéis) e pode envolver qualquer bloco pesado.
import { Component, type ReactNode } from "react";

interface Props { label?: string; children: ReactNode; compact?: boolean }
interface State { err: Error | null }

export class PanelBoundary extends Component<Props, State> {
  state: State = { err: null };
  static getDerivedStateFromError(err: Error): State { return { err }; }
  componentDidCatch(err: Error) {
    // só log técnico no console — nunca vaza detalhe/jargão na tela
    console.error(`[PanelBoundary]${this.props.label ? " " + this.props.label : ""}`, err);
  }
  reset = () => this.setState({ err: null });
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="card pad-lg" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", minHeight: this.props.compact ? undefined : 120, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--atencao) 16%, transparent)", color: "var(--atencao)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
          </span>
          <div style={{ fontSize: 13, fontWeight: 650, color: "var(--label-1)" }}>
            {this.props.label ? `"${this.props.label}" não carregou` : "Este bloco não carregou"}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--label-3)" }}>O resto da página segue funcionando. Tente carregar de novo.</div>
        <button type="button" onClick={this.reset} className="btn-link" style={{ padding: "5px 12px", border: "1px solid var(--hairline)", borderRadius: 999, fontWeight: 650 }}>
          Tentar de novo
        </button>
      </div>
    );
  }
}
