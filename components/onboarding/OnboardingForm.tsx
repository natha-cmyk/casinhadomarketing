"use client";
// Onboarding de 1º acesso — WIZARD multi-passo com animação.
// Passos: 0 boas-vindas (animada) · 1 empresa (obrig.) · 2 LLM (OBRIGATÓRIO) ·
//         3 redes (pular) · 4 CRM (pular) · 5 produtos/canais (pular) → entra.
import { useEffect, useState } from "react";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const TOTAL = 6;

interface Initial { empresa: string; telefone: string; emailContato: string; ramo: string; cidade: string; estado: string; site: string }

const inp: React.CSSProperties = { width: "100%", border: "1px solid var(--hairline)", borderRadius: 10, padding: "10px 12px", font: "inherit", fontSize: 14, outline: "none", background: "#fff" };
const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--label-2)", textTransform: "uppercase", letterSpacing: ".4px", display: "block", marginBottom: 5 };

export function OnboardingForm({ initial, redes }: { initial: Initial; redes: string[] }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Initial>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upd = (p: Partial<Initial>) => setF((prev) => ({ ...prev, ...p }));

  // LLM (passo obrigatório)
  const [llmConnected, setLlmConnected] = useState(false);
  const [provider, setProvider] = useState("openrouter");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  useEffect(() => {
    fetch("/api/agents/llm").then((r) => r.json()).then((s) => { if (s?.connected) setLlmConnected(true); }).catch(() => {});
  }, []);

  const empresaOk = !!f.empresa.trim() && !!f.telefone.trim() && !!f.emailContato.trim() && !!f.ramo.trim();

  const saveLlm = async () => {
    if (!key.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/agents/llm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, apiKey: key, model }) });
      const j = await r.json().catch(() => null);
      setBusy(false);
      if (r.ok && j?.ok) { setLlmConnected(true); setKey(""); }
      else setErr(j?.error || "Falha ao conectar a LLM.");
    } catch { setBusy(false); setErr("Erro de rede."); }
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { window.location.href = "/"; return; }
      setErr(j?.error || "Não foi possível concluir."); setBusy(false);
    } catch { setErr("Erro de rede."); setBusy(false); }
  };

  const next = () => { setErr(null); setStep((s) => Math.min(s + 1, TOTAL - 1)); };
  const back = () => { setErr(null); setStep((s) => Math.max(s - 1, 0)); };

  return (
    <div style={{ minHeight: "100dvh", overflowY: "auto", background: "var(--surface)", display: "flex", justifyContent: "center", padding: "40px 20px 80px" }}>
      <style>{`@keyframes obUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes obPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
      <div key={step} style={{ width: "100%", maxWidth: 560, animation: "obUp .45s cubic-bezier(.22,.61,.36,1)" }}>
        {/* progresso (some na boas-vindas) */}
        {step > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
            {Array.from({ length: TOTAL - 1 }).map((_, i) => (
              <span key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < step ? "var(--cyan)" : "var(--hairline)", transition: "background .3s" }} />
            ))}
          </div>
        )}

        {/* 0 — BOAS-VINDAS */}
        {step === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px", background: "linear-gradient(150deg,var(--red),#c60018)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 26, animation: "obPulse 2.4s ease-in-out infinite" }}>C</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10 }}>Bem-vindo 🎉</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.5px", margin: "0 0 14px", lineHeight: 1.25 }}>
              Bem-vindo à Casinha do Marketing, a plataforma de gestão de relatórios e produção de conteúdo do seu marketing.
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--label-2)", margin: "0 0 28px" }}>Vamos configurar agora o seu ambiente em alguns passos. Bora lá?</p>
            <button onClick={next} style={{ border: 0, borderRadius: 999, width: 54, height: 54, cursor: "pointer", background: "var(--ink)", color: "#fff", fontSize: 22 }} aria-label="Começar">→</button>
          </div>
        )}

        {/* 1 — EMPRESA */}
        {step === 1 && (
          <Card title="Sua empresa" sub="Dados básicos pra começar (você edita depois na Personalização).">
            {redes.length > 0 && (
              <div style={{ background: "color-mix(in srgb, var(--cyan) 8%, #fff)", border: "1px solid color-mix(in srgb, var(--cyan) 22%, transparent)", borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: "var(--label-2)" }}>
                <b>Redes detectadas:</b> {redes.join(" · ")}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Nome da empresa *"><input style={inp} value={f.empresa} onChange={(e) => upd({ empresa: e.target.value })} placeholder="Ex.: Seahub Coworking" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Telefone *"><input style={inp} value={f.telefone} onChange={(e) => upd({ telefone: e.target.value })} placeholder="(84) 90000-0000" /></Field>
                <Field label="E-mail de contato *"><input style={inp} value={f.emailContato} onChange={(e) => upd({ emailContato: e.target.value })} placeholder="contato@empresa.com" /></Field>
              </div>
              <Field label="Ramo de atividade *"><input style={inp} value={f.ramo} onChange={(e) => upd({ ramo: e.target.value })} placeholder="Ex.: Coworking / espaços compartilhados" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <Field label="Cidade"><input style={inp} value={f.cidade} onChange={(e) => upd({ cidade: e.target.value })} placeholder="Ex.: Natal" /></Field>
                <Field label="Estado">
                  <select style={inp} value={f.estado} onChange={(e) => upd({ estado: e.target.value })}>
                    <option value="">UF</option>{UFS.map((uf) => <option key={uf}>{uf}</option>)}
                  </select>
                </Field>
              </div>
            </div>
            <Nav onBack={back} onNext={next} nextDisabled={!empresaOk} nextLabel="Continuar →" />
          </Card>
        )}

        {/* 2 — LLM (OBRIGATÓRIO) */}
        {step === 2 && (
          <Card title="Conecte sua LLM" sub="Obrigatório: é a inteligência que roda os assistentes (Athena, Apollo, Poseidon, Dionísio). Sem ela, eles não analisam seus dados.">
            {llmConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "color-mix(in srgb, var(--excelente,#2FB457) 10%, #fff)", border: "1px solid color-mix(in srgb, var(--excelente,#2FB457) 30%, transparent)", fontSize: 13, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--excelente,#2FB457)" }} /> LLM conectada. Pode seguir.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="Provedor">
                  <select style={inp} value={provider} onChange={(e) => setProvider(e.target.value)}>
                    <option value="openrouter">OpenRouter (recomendado)</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </Field>
                <Field label="API key"><input type="password" style={inp} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole sua chave" autoComplete="off" /></Field>
                <Field label="Modelo (opcional)"><input style={inp} value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === "openrouter" ? "ex. anthropic/claude-sonnet-4.5" : "ex. claude-opus-5"} /></Field>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={saveLlm} disabled={busy || !key.trim()} style={btn(!!key.trim())}>{busy ? "Conectando…" : "Conectar LLM"}</button>
                  <a href={provider === "openrouter" ? "https://openrouter.ai/keys" : "https://console.anthropic.com/settings/keys"} target="_blank" rel="noopener" style={{ fontSize: 12, color: "var(--label-3)" }}>onde pego a chave?</a>
                </div>
              </div>
            )}
            {err && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 12 }}>{err}</div>}
            <Nav onBack={back} onNext={next} nextDisabled={!llmConnected} nextLabel="Continuar →" />
          </Card>
        )}

        {/* 3 — REDES (pular) */}
        {step === 3 && (
          <StepOptional title="Conectar redes sociais" sub="Conecte Instagram, Facebook, TikTok, YouTube e mais pra popular os painéis com dados reais." onBack={back} onSkip={next} />
        )}
        {/* 4 — CRM (pular) */}
        {step === 4 && (
          <StepOptional title="Conectar CRM" sub="Traga seus leads e oportunidades (ClickUp/webhook) pra aba Geração." onBack={back} onSkip={next} />
        )}
        {/* 5 — PRODUTOS & CANAIS (pular) → finaliza */}
        {step === 5 && (
          <StepOptional
            title="Produtos & canais" sub="Cadastre seus produtos/serviços e canais de conteúdo. Dá pra fazer depois, dentro da plataforma."
            onBack={back} onSkip={finish} skipLabel={busy ? "Entrando…" : "Entrar na plataforma →"} skipPrimary
          />
        )}
        {step === 5 && err && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 10, textAlign: "center" }}>{err}</div>}
      </div>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "22px 24px" }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--label-3)", marginBottom: 18 }}>{sub}</div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}
function Nav({ onBack, onNext, nextDisabled, nextLabel }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
      <button onClick={onBack} style={{ border: 0, background: "transparent", color: "var(--label-3)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← voltar</button>
      <button onClick={onNext} disabled={nextDisabled} style={btn(!nextDisabled)}>{nextLabel}</button>
    </div>
  );
}
function StepOptional({ title, sub, onBack, onSkip, skipLabel = "Deixar pra configurar dentro da plataforma", skipPrimary }: { title: string; sub: string; onBack: () => void; onSkip: () => void; skipLabel?: string; skipPrimary?: boolean }) {
  return (
    <div className="card" style={{ padding: "22px 24px" }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--label-2)", marginBottom: 20, lineHeight: 1.5 }}>{sub}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ border: 0, background: "transparent", color: "var(--label-3)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← voltar</button>
        <button onClick={onSkip} style={skipPrimary ? btn(true) : { border: "1px solid var(--hairline)", background: "#fff", color: "var(--label)", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{skipLabel}</button>
      </div>
    </div>
  );
}
function btn(enabled: boolean): React.CSSProperties {
  return { border: 0, borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: enabled ? "pointer" : "default", background: enabled ? "var(--ink)" : "var(--hairline)", color: enabled ? "#fff" : "var(--label-3)", transition: "background .15s" };
}
