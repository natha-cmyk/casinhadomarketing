"use client";
// Onboarding de 1º acesso — WIZARD centralizado (desktop + mobile) com animação.
// 0 boas-vindas · 1 empresa (obrig., telefone com máscara, ramo dropdown, estado→cidade IBGE)
// 2 LLM (OBRIGATÓRIO, 4 provedores) · 3 redes (conectar de verdade / pular) · 4 CRM (pular)
// 5 produtos/canais (pular) → botão central animado "Entrar na plataforma".
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ConexoesGrid } from "@/components/ConexoesGrid";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const RAMOS = ["Saúde", "Consultoria", "Imobiliária", "Engenharia", "Direito", "Educação", "Tecnologia", "Comércio / Varejo", "Alimentação", "Beleza & Estética", "Contabilidade", "Marketing & Publicidade", "Coworking / Espaços", "Serviços financeiros", "Turismo & Hotelaria", "Construção civil", "Indústria"];
const PROVIDERS = [
  { v: "openrouter", label: "OpenRouter (recomendado)", url: "https://openrouter.ai/keys" },
  { v: "anthropic", label: "Claude (Anthropic)", url: "https://console.anthropic.com/settings/keys" },
  { v: "openai", label: "OpenAI", url: "https://platform.openai.com/api-keys" },
  { v: "gemini", label: "Gemini (Google)", url: "https://aistudio.google.com/apikey" },
];
const TOTAL = 6;

interface Initial { empresa: string; telefone: string; emailContato: string; ramo: string; cidade: string; estado: string; site: string }

const inp: React.CSSProperties = { width: "100%", border: "1px solid var(--hairline)", borderRadius: 10, padding: "10px 12px", font: "inherit", fontSize: 14, outline: "none", background: "#fff" };
const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--label-2)", textTransform: "uppercase", letterSpacing: ".4px", display: "block", marginBottom: 5 };

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function OnboardingForm({ initial, redes }: { initial: Initial; redes: string[] }) {
  const [step, setStep] = useState(0);
  const ramoInicialCustom = initial.ramo && !RAMOS.includes(initial.ramo);
  const [f, setF] = useState<Initial>({ ...initial, telefone: maskPhone(initial.telefone) });
  const [ramoSel, setRamoSel] = useState(ramoInicialCustom ? "__outro__" : initial.ramo);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upd = (p: Partial<Initial>) => setF((prev) => ({ ...prev, ...p }));

  // cidades por estado (IBGE)
  const [cidades, setCidades] = useState<string[]>([]);
  const [loadingCid, setLoadingCid] = useState(false);
  useEffect(() => {
    if (!f.estado) { setCidades([]); return; }
    setLoadingCid(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${f.estado}/municipios?orderBy=nome`)
      .then((r) => r.json())
      .then((arr: { nome: string }[]) => setCidades(Array.isArray(arr) ? arr.map((m) => m.nome) : []))
      .catch(() => setCidades([]))
      .finally(() => setLoadingCid(false));
  }, [f.estado]);

  // store: carrega contas conectadas p/ o passo de redes refletir o estado atual
  const setZernioAccounts = useStore((s) => s.setZernioAccounts);
  useEffect(() => {
    fetch("/api/zernio/accounts").then((r) => r.json()).then((d) => { if (d?.accounts) setZernioAccounts(d.accounts); }).catch(() => {});
  }, [setZernioAccounts]);

  // LLM (obrigatório)
  const [llmConnected, setLlmConnected] = useState(false);
  const [provider, setProvider] = useState("openrouter");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  useEffect(() => { fetch("/api/agents/llm").then((r) => r.json()).then((s) => { if (s?.connected) setLlmConnected(true); }).catch(() => {}); }, []);

  // CRM (opcional) — ClickUp nativo (token + listId)
  const [crmToken, setCrmToken] = useState("");
  const [crmList, setCrmList] = useState("");
  const [crmConnected, setCrmConnected] = useState(false);
  const saveCrm = async () => {
    if (!crmToken.trim() || !crmList.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/crm/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: "clickup", clickupToken: crmToken, clickupListId: crmList }) });
      const j = await r.json().catch(() => null); setBusy(false);
      if (r.ok && j?.config) setCrmConnected(true); else setErr("Falha ao conectar o CRM.");
    } catch { setBusy(false); setErr("Erro de rede."); }
  };

  // Produtos (opcional) — chips
  const [produtos, setProdutos] = useState<string[]>([]);
  const [prodInput, setProdInput] = useState("");
  const addProd = () => { const v = prodInput.trim(); if (v && !produtos.includes(v)) { setProdutos((p) => [...p, v]); setProdInput(""); } };

  const empresaOk = !!f.empresa.trim() && f.telefone.replace(/\D/g, "").length >= 10 && !!f.emailContato.trim() && !!f.ramo.trim();

  const saveLlm = async () => {
    if (!key.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/agents/llm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, apiKey: key, model }) });
      const j = await r.json().catch(() => null);
      setBusy(false);
      if (r.ok && j?.ok) { setLlmConnected(true); setKey(""); } else setErr(j?.error || "Falha ao conectar a LLM.");
    } catch { setBusy(false); setErr("Erro de rede."); }
  };
  const finish = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, produtos }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { window.location.href = "/"; return; }
      setErr(j?.error || "Não foi possível concluir."); setBusy(false);
    } catch { setErr("Erro de rede."); setBusy(false); }
  };
  const next = () => { setErr(null); setStep((s) => Math.min(s + 1, TOTAL - 1)); };
  const back = () => { setErr(null); setStep((s) => Math.max(s - 1, 0)); };

  return (
    <div style={{ minHeight: "100dvh", overflowY: "auto", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <style>{`@keyframes obUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes obPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}@keyframes obPop{0%{opacity:0;transform:scale(.85)}60%{transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}`}</style>
      <div key={step} style={{ width: "100%", maxWidth: 560, margin: "auto", animation: "obUp .45s cubic-bezier(.22,.61,.36,1)" }}>
        {step > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
            {Array.from({ length: TOTAL - 1 }).map((_, i) => (
              <span key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < step ? "var(--cyan)" : "var(--hairline)", transition: "background .3s" }} />
            ))}
          </div>
        )}

        {/* 0 — BOAS-VINDAS */}
        {step === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px", background: "linear-gradient(150deg,var(--red),#c60018)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 26, animation: "obPulse 2.4s ease-in-out infinite" }}>C</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10 }}>Bem-vindo 🎉</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.5px", margin: "0 0 14px", lineHeight: 1.25 }}>Bem-vindo à Casinha do Marketing, a plataforma de gestão de relatórios e produção de conteúdo do seu marketing.</h1>
            <p style={{ fontSize: 14.5, color: "var(--label-2)", margin: "0 0 28px" }}>Vamos configurar agora o seu ambiente em alguns passos. Bora lá?</p>
            <button onClick={next} style={{ border: 0, borderRadius: 999, width: 54, height: 54, cursor: "pointer", background: "var(--ink)", color: "#fff", fontSize: 22 }} aria-label="Começar">→</button>
          </div>
        )}

        {/* 1 — EMPRESA */}
        {step === 1 && (
          <Card title="Sua empresa" sub="Dados básicos pra começar (você edita depois na Personalização).">
            {redes.length > 0 && (
              <div style={{ background: "color-mix(in srgb, var(--cyan) 8%, #fff)", border: "1px solid color-mix(in srgb, var(--cyan) 22%, transparent)", borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: "var(--label-2)" }}><b>Redes detectadas:</b> {redes.join(" · ")}</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Nome da empresa *"><input style={inp} value={f.empresa} onChange={(e) => upd({ empresa: e.target.value })} placeholder="Ex.: Seahub Coworking" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Telefone *"><input style={inp} value={f.telefone} onChange={(e) => upd({ telefone: maskPhone(e.target.value) })} placeholder="(84) 90000-0000" inputMode="numeric" /></Field>
                <Field label="E-mail de contato *"><input style={inp} value={f.emailContato} onChange={(e) => upd({ emailContato: e.target.value })} placeholder="contato@empresa.com" /></Field>
              </div>
              <Field label="Ramo de atividade *">
                <select style={inp} value={ramoSel} onChange={(e) => { const v = e.target.value; setRamoSel(v); upd({ ramo: v === "__outro__" ? "" : v }); }}>
                  <option value="">Selecione…</option>
                  {RAMOS.map((r) => <option key={r} value={r}>{r}</option>)}
                  <option value="__outro__">Outro (especificar)</option>
                </select>
                {ramoSel === "__outro__" && <input style={{ ...inp, marginTop: 8 }} value={f.ramo} onChange={(e) => upd({ ramo: e.target.value })} placeholder="Digite o ramo de atividade" />}
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <Field label="Estado">
                  <select style={inp} value={f.estado} onChange={(e) => upd({ estado: e.target.value, cidade: "" })}>
                    <option value="">UF</option>{UFS.map((uf) => <option key={uf}>{uf}</option>)}
                  </select>
                </Field>
                <Field label="Cidade">
                  <select style={inp} value={f.cidade} onChange={(e) => upd({ cidade: e.target.value })} disabled={!f.estado || loadingCid}>
                    <option value="">{!f.estado ? "escolha o estado" : loadingCid ? "carregando…" : "Selecione…"}</option>
                    {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
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
                    {PROVIDERS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="API key"><input type="password" style={inp} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole sua chave" autoComplete="off" /></Field>
                <Field label="Modelo (opcional)"><input style={inp} value={model} onChange={(e) => setModel(e.target.value)} placeholder="deixe em branco pro padrão" /></Field>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={saveLlm} disabled={busy || !key.trim()} style={btn(!!key.trim())}>{busy ? "Conectando…" : "Conectar LLM"}</button>
                  <a href={PROVIDERS.find((p) => p.v === provider)?.url} target="_blank" rel="noopener" style={{ fontSize: 12, color: "var(--label-3)" }}>onde pego a chave?</a>
                </div>
              </div>
            )}
            {err && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 12 }}>{err}</div>}
            <Nav onBack={back} onNext={next} nextDisabled={!llmConnected} nextLabel="Continuar →" />
          </Card>
        )}

        {/* 3 — REDES (conectar de verdade / pular) */}
        {step === 3 && (
          <Card title="Conectar redes sociais" sub="Conecte agora pra já entrar com os painéis populados — ou deixe pra configurar dentro da plataforma.">
            <div style={{ maxHeight: "48vh", overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
              <ConexoesGrid grupos={["social", "conversas"]} />
            </div>
            <Nav onBack={back} onNext={next} nextLabel="Deixar pra depois →" />
          </Card>
        )}

        {/* 4 — CRM (ClickUp / pular) */}
        {step === 4 && (
          <Card title="Conectar CRM (ClickUp)" sub="Traga seus leads e oportunidades. Cole o token e o ID da lista do ClickUp — ou deixe pra configurar depois, em Geração por canais.">
            {crmConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "color-mix(in srgb, var(--excelente,#2FB457) 10%, #fff)", border: "1px solid color-mix(in srgb, var(--excelente,#2FB457) 30%, transparent)", fontSize: 13, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--excelente,#2FB457)" }} /> CRM conectado.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="Token do ClickUp"><input type="password" style={inp} value={crmToken} onChange={(e) => setCrmToken(e.target.value)} placeholder="pk_..." autoComplete="off" /></Field>
                <Field label="ID da lista (List ID)"><input style={inp} value={crmList} onChange={(e) => setCrmList(e.target.value)} placeholder="Ex.: 901234567" /></Field>
                <div>
                  <button onClick={saveCrm} disabled={busy || !crmToken.trim() || !crmList.trim()} style={btn(!!crmToken.trim() && !!crmList.trim())}>{busy ? "Conectando…" : "Conectar CRM"}</button>
                </div>
              </div>
            )}
            {err && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 12 }}>{err}</div>}
            <Nav onBack={back} onNext={next} nextLabel={crmConnected ? "Continuar →" : "Deixar pra configurar dentro da plataforma →"} />
          </Card>
        )}

        {/* 5 — PRODUTOS & CANAIS (pular) → finaliza */}
        {step === 5 && (
          <div style={{ textAlign: "center" }}>
            <div className="card" style={{ padding: "22px 24px", textAlign: "left" }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Produtos & serviços</div>
              <div style={{ fontSize: 13, color: "var(--label-2)", marginBottom: 16, lineHeight: 1.5 }}>Adicione seus produtos/serviços (você refina os detalhes depois, na Personalização). Opcional.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={inp} value={prodInput} onChange={(e) => setProdInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addProd())} placeholder="Ex.: Escritório virtual" />
                <button onClick={addProd} disabled={!prodInput.trim()} style={btn(!!prodInput.trim())}>Adicionar</button>
              </div>
              {produtos.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {produtos.map((p) => (
                    <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "5px 10px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
                      {p}<button onClick={() => setProdutos((arr) => arr.filter((x) => x !== p))} style={{ border: 0, background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <button onClick={back} style={{ border: 0, background: "transparent", color: "var(--label-3)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← voltar</button>
              </div>
            </div>
            <button onClick={finish} disabled={busy} style={{ ...btn(!busy), marginTop: 22, padding: "13px 26px", fontSize: 15, borderRadius: 999, animation: "obPop .5s ease-out" }}>
              {busy ? "Entrando…" : "Entrar na plataforma 🚀"}
            </button>
            {err && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 10 }}>{err}</div>}
          </div>
        )}
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
function btn(enabled: boolean): React.CSSProperties {
  return { border: 0, borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: enabled ? "pointer" : "default", background: enabled ? "var(--ink)" : "var(--hairline)", color: enabled ? "#fff" : "var(--label-3)", transition: "background .15s" };
}
