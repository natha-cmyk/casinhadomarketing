"use client";
// Onboarding de 1º acesso — boas-vindas + dados obrigatórios da empresa. Pré-preenchido.
// Obrigatórios: nome, telefone, e-mail, ramo. Recomendado: cidade + UF. Passos de conexão = depois.
import { useState } from "react";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

interface Initial {
  empresa: string; telefone: string; emailContato: string; ramo: string;
  cidade: string; estado: string; site: string;
}

export function OnboardingForm({ initial, redes }: { initial: Initial; redes: string[] }) {
  const [f, setF] = useState<Initial>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upd = (p: Partial<Initial>) => setF((prev) => ({ ...prev, ...p }));

  const faltando = !f.empresa.trim() || !f.telefone.trim() || !f.emailContato.trim() || !f.ramo.trim();

  const submit = async () => {
    if (busy || faltando) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setErr(j?.error || "Não foi possível salvar. Tente de novo."); setBusy(false); return; }
      window.location.href = "/"; // reload → o gate reavalia com onboarded=true
    } catch {
      setErr("Erro de rede. Tente de novo.");
      setBusy(false);
    }
  };

  const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--label-2)", textTransform: "uppercase", letterSpacing: ".4px", display: "block", marginBottom: 5 };
  const inp: React.CSSProperties = { width: "100%", border: "1px solid var(--hairline)", borderRadius: 10, padding: "10px 12px", font: "inherit", fontSize: 14, outline: "none", background: "#fff" };

  return (
    <div style={{ minHeight: "100dvh", overflowY: "auto", background: "var(--surface)", display: "flex", justifyContent: "center", padding: "40px 20px 80px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Boas-vindas */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(150deg,var(--red),#c60018)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 19 }}>C</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--cyan)", textTransform: "uppercase", letterSpacing: ".6px" }}>Bem-vindo 🎉</div>
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: "-.5px", margin: "0 0 8px", lineHeight: 1.2 }}>
          Bem-vindo à Casinha do Marketing, a plataforma de gestão de relatórios e produção de conteúdo do seu marketing.
        </h1>
        <p style={{ fontSize: 14, color: "var(--label-2)", margin: "0 0 24px" }}>
          Vamos configurar agora o seu ambiente em alguns passos. Bora lá?
        </p>

        {redes.length > 0 && (
          <div style={{ background: "color-mix(in srgb, var(--cyan) 8%, #fff)", border: "1px solid color-mix(in srgb, var(--cyan) 22%, transparent)", borderRadius: 12, padding: "10px 14px", marginBottom: 18, fontSize: 12.5, color: "var(--label-2)" }}>
            <b>Redes detectadas:</b> {redes.join(" · ")}
          </div>
        )}

        {/* Passo obrigatório */}
        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Sua empresa</div>
          <div style={{ fontSize: 12.5, color: "var(--label-3)", marginBottom: 16 }}>Campos obrigatórios pra começar (você edita depois na Personalização).</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>Nome da empresa *</label>
              <input style={inp} value={f.empresa} onChange={(e) => upd({ empresa: e.target.value })} placeholder="Ex.: Seahub Coworking" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Telefone principal *</label>
                <input style={inp} value={f.telefone} onChange={(e) => upd({ telefone: e.target.value })} placeholder="(84) 90000-0000" />
              </div>
              <div>
                <label style={lbl}>E-mail de contato *</label>
                <input style={inp} value={f.emailContato} onChange={(e) => upd({ emailContato: e.target.value })} placeholder="contato@empresa.com" />
              </div>
            </div>
            <div>
              <label style={lbl}>Ramo de atividade *</label>
              <input style={inp} value={f.ramo} onChange={(e) => upd({ ramo: e.target.value })} placeholder="Ex.: Coworking / espaços compartilhados" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Cidade</label>
                <input style={inp} value={f.cidade} onChange={(e) => upd({ cidade: e.target.value })} placeholder="Ex.: Natal" />
              </div>
              <div>
                <label style={lbl}>Estado</label>
                <select style={inp} value={f.estado} onChange={(e) => upd({ estado: e.target.value })}>
                  <option value="">UF</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
          </div>

          {err && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 12 }}>{err}</div>}

          <button
            onClick={submit}
            disabled={busy || faltando}
            style={{ marginTop: 20, width: "100%", border: 0, borderRadius: 11, padding: "12px 16px", fontWeight: 700, fontSize: 14, cursor: busy || faltando ? "default" : "pointer", background: faltando ? "var(--hairline)" : "var(--ink)", color: faltando ? "var(--label-3)" : "#fff", transition: "background .15s" }}
          >
            {busy ? "Salvando…" : "Entrar na plataforma →"}
          </button>
        </div>

        {/* Passos opcionais (depois) */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--label-3)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Depois, dentro da plataforma</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Conectar redes sociais", "Conectar CRM", "Conectar sua LLM (agentes)", "Produtos & canais"].map((s) => (
              <span key={s} style={{ fontSize: 12.5, padding: "7px 12px", borderRadius: 999, background: "#fff", border: "1px solid var(--hairline)", color: "var(--label-2)" }}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
