"use client";
// Geração por Canais — CRM do cliente (vive no ClickUp, fora da integração social).
// Conecta via ClickUp nativo (API REST) ou webhook genérico e mostra leads/oportunidades
// por canal, categoria, produto, qualificação, status/etapa e motivo de perda, respeitando
// o período da toolbar. O usuário mapeia os campos personalizados do ClickUp por dimensão.
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { PageHead, BarRow } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import { Ic } from "@/components/Ic";
import { fmt, money } from "@/lib/format";
import { daysInMonth, type Period } from "@/lib/scope";
import { WidgetBoard } from "@/components/WidgetBoard";

// ── tipos ──
interface CrmConfig {
  provider: string;
  clickupToken: string | null;
  clickupListId: string | null;
  fieldMap: Record<string, string>;
  webhookSecret: string | null;
  lastSyncAt?: string | null;
}
interface CrmField {
  name: string;
  type: string;
  options: string[];
}
interface Row {
  key: string;
  count: number;
  value: number;
}
interface LeadRow {
  id: string;
  title: string | null;
  channel: string | null;
  category: string | null;
  product: string | null;
  qualification: string | null;
  stage: string | null;
  status: string | null;
  value: number;
  lossReason: string | null;
  outcome: "won" | "lost" | "open";
  createdAt: string;
}
interface LeadsData {
  ok: boolean;
  total: number;
  totalValue: number;
  pipelineValue: number;
  wonValue: number;
  won: number;
  lost: number;
  open: number;
  convRate: number;
  byChannel: Row[];
  byCategory: Row[];
  byProduct: Row[];
  byQualification: Row[];
  byStage: Row[];
  byStatus: Row[];
  lossReasons: Row[];
  leads: LeadRow[];
  mapping?: Record<string, string | null>; // dimensão → campo do ClickUp que alimentou (transparência)
  availableFields?: { name: string; type: string; filled: number; sample: string | null }[];
  channelHealth?: { key: string; total: number; won: number; lost: number; open: number; value: number; conv: number }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function dateRange(scope: { period: Period; year: number; month: number; quarter: number }) {
  const { period, year, month, quarter } = scope;
  let since: Date, until: Date;
  if (period === "trimestre") {
    since = new Date(year, quarter * 3, 1);
    until = new Date(year, quarter * 3 + 2, daysInMonth(year, quarter * 3 + 2));
  } else if (period === "ano") {
    since = new Date(year, 0, 1);
    until = new Date(year, 11, 31);
  } else {
    since = new Date(year, month, 1);
    until = new Date(year, month, daysInMonth(year, month));
  }
  return { since: iso(since), until: iso(until) };
}

// dimensões que o sync sabe interpretar (mesmas chaves do fieldMap no backend).
const FIELD_KEYS: { k: string; lbl: string; hint: string }[] = [
  { k: "channel", lbl: "Canal / origem", hint: "de onde veio o lead" },
  { k: "category", lbl: "Categoria de produto", hint: "família / linha" },
  { k: "product", lbl: "Tipo de produto", hint: "produto específico" },
  { k: "qualification", lbl: "Qualificação", hint: "estrelas / lead score" },
  { k: "stage", lbl: "Funil / etapa", hint: "estágio no pipeline" },
  { k: "status", lbl: "Status", hint: "situação do lead" },
  { k: "value", lbl: "Valor (R$)", hint: "ticket / receita" },
  { k: "lossReason", lbl: "Motivo de perda", hint: "quando perdido" },
];

// rótulo "última sincronização" a partir do carimbo ISO da config.
function lastSyncLabel(iso?: string | null): string {
  if (!iso) return "nunca sincronizado";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return "sincronizado " + d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const CHANNEL_COLORS = ["var(--cyan)", "var(--red)", "var(--excelente)", "var(--atencao)", "var(--ink)"];
const OUTCOME = {
  won: { lbl: "Ganho", color: "var(--excelente)" },
  lost: { lbl: "Perdido", color: "var(--red)" },
  open: { lbl: "Em aberto", color: "var(--cyan)" },
} as const;

export function GeracaoView() {
  const s = useStore();
  const range = useMemo(() => dateRange(s), [s.period, s.year, s.month, s.quarter]); // eslint-disable-line react-hooks/exhaustive-deps

  const [config, setConfig] = useState<CrmConfig | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [editing, setEditing] = useState(false);

  const [data, setData] = useState<LeadsData | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // carrega config
  useEffect(() => {
    let alive = true;
    fetch("/api/crm/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setConfig(d?.config ?? null);
        setWorkspaceId(d?.workspaceId ?? "");
        if (!d?.config) setEditing(true);
      })
      .catch(() => alive && setEditing(true))
      .finally(() => alive && setLoadingCfg(false));
    return () => {
      alive = false;
    };
  }, []);

  const connected = !!config && !editing;

  // carrega leads (quando conectado + no período)
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    setLoadingLeads(true);
    setErr(null);
    fetch(`/api/crm/leads?since=${range.since}&until=${range.until}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.ok) setData(d);
        else setErr(d?.error || "Falha ao carregar os leads.");
      })
      .catch((e) => alive && setErr(String(e)))
      .finally(() => alive && setLoadingLeads(false));
    return () => {
      alive = false;
    };
  }, [connected, range.since, range.until]);

  async function saveConfig(patch: Partial<CrmConfig>) {
    setErr(null);
    setMsg(null);
    const r = await fetch("/api/crm/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await r.json();
    if (!r.ok) {
      setErr(d?.error || "Não foi possível salvar.");
      return null;
    }
    setConfig(d.config);
    setWorkspaceId(d.workspaceId);
    return d.config as CrmConfig;
  }

  // full=true força re-sync completo; padrão é incremental. silent=true não mostra mensagem
  // (usado no auto-sync ao abrir a tela).
  async function sync(full = false, silent = false) {
    setSyncing(true);
    setErr(null);
    if (!silent) setMsg(null);
    try {
      const r = await fetch(`/api/crm/sync${full ? "?full=1" : ""}`, { method: "POST" });
      const d = await r.json();
      if (!d?.ok) {
        if (!silent) setErr(d?.error || "Falha na sincronização.");
        return;
      }
      if (!silent) {
        const tipo = d.incremental ? "atualizados" : "importados";
        setMsg(
          d.imported === 0
            ? "Tudo em dia — nenhuma mudança desde o último sync."
            : `${d.imported} ${d.imported === 1 ? "lead" : "leads"} ${tipo} do ClickUp.`
        );
      }
      // atualiza carimbo de última sync na config local
      setConfig((c) => (c ? { ...c, lastSyncAt: new Date().toISOString() } : c));
      // recarrega leads
      const lr = await fetch(`/api/crm/leads?since=${range.since}&until=${range.until}`, { cache: "no-store" });
      const ld = await lr.json();
      if (ld?.ok) setData(ld);
    } catch (e) {
      if (!silent) setErr(String(e));
    } finally {
      setSyncing(false);
    }
  }

  // O aviso de sync some sozinho depois de 5s (não fica fixo na tela).
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  // Auto-sync ao abrir a tela conectada (incremental, silencioso) — 1x por montagem.
  const [autoSynced, setAutoSynced] = useState(false);
  useEffect(() => {
    if (connected && config?.provider === "clickup" && !autoSynced) {
      setAutoSynced(true);
      sync(false, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, config?.provider, autoSynced]);

  return (
    <>
      <PageHead
        eyebrow="COMERCIAL · FUNIL"
        title="Geração por Canais"
        desc="De onde vêm os leads — por canal, produto, qualificação, etapa e motivo de perda."
        right={
          connected ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {config?.provider === "clickup" && (
                <>
                  <span style={{ fontSize: 11.5, color: "var(--label-3)" }}>{lastSyncLabel(config?.lastSyncAt)}</span>
                  <button className="btn-link ig" onClick={() => sync(false)} disabled={syncing} type="button" title="Rápido: puxa só os leads que mudaram desde o último sync.">
                    <Ic name="leads" /> {syncing ? "Sincronizando…" : "Sincronizar (rápido)"}
                  </button>
                  <button className="btn-link" onClick={() => sync(true)} disabled={syncing} type="button" title="Completo: reprocessa TODOS os leads do zero e remove os arquivados. Use quando arquivar/mudar campos no ClickUp.">
                    Ressincronizar tudo
                  </button>
                </>
              )}
              <button className="btn-link" onClick={() => setEditing(true)} type="button">
                Reconfigurar
              </button>
            </div>
          ) : undefined
        }
      />

      {loadingCfg && <Spinner texto="Carregando conexão…" />}

      {msg && <div className="insight" style={{ marginBottom: 12 }}><p>{msg}</p></div>}
      {err && <div className="auth-err" style={{ marginBottom: 12 }}>{err}</div>}

      {!loadingCfg && !connected && (
        <ConnectCard
          config={config}
          workspaceId={workspaceId}
          onSave={saveConfig}
          onDone={() => setEditing(false)}
          mapping={data?.mapping}
          fields={data?.availableFields}
        />
      )}

      {connected && (
        <>
          {loadingLeads && <Spinner texto="Carregando leads…" />}
          {!loadingLeads && data && <Dashboard data={data} />}
        </>
      )}
    </>
  );
}

// ── Conectar CRM ──
function ConnectCard({
  config,
  workspaceId,
  onSave,
  onDone,
  mapping,
  fields: liveFields,
}: {
  config: CrmConfig | null;
  workspaceId: string;
  onSave: (p: Partial<CrmConfig>) => Promise<CrmConfig | null>;
  onDone: () => void;
  mapping?: Record<string, string | null>;
  fields?: LeadsData["availableFields"];
}) {
  const [mode, setMode] = useState<string>(config?.provider === "webhook" ? "webhook" : "clickup");
  const [token, setToken] = useState(config?.clickupToken ?? "");
  const [listId, setListId] = useState(config?.clickupListId ?? "");
  const [fieldMap, setFieldMap] = useState<Record<string, string>>(config?.fieldMap ?? {});
  const [saving, setSaving] = useState(false);
  const [webhook, setWebhook] = useState<CrmConfig | null>(
    config?.provider === "webhook" ? config : null
  );

  // detecção dos campos personalizados da lista do ClickUp
  const [fields, setFields] = useState<CrmField[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectErr, setDetectErr] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = webhook && workspaceId ? `${origin}/api/crm/webhook/${workspaceId}` : "";

  // nomes de campos disponíveis p/ os selects (une detectados + o que já estiver mapeado)
  const fieldNames = useMemo(() => {
    const set = new Set<string>();
    (fields ?? []).forEach((f) => f.name && set.add(f.name));
    Object.values(fieldMap).forEach((v) => v && set.add(v));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [fields, fieldMap]);

  async function detectFields() {
    if (!token.trim() || !listId.trim()) return;
    setDetecting(true);
    setDetectErr(null);
    // persiste token+listId (o GET lê a config salva) preservando o mapa atual
    const saved = await onSave({ provider: "clickup", clickupToken: token, clickupListId: listId, fieldMap });
    if (!saved) {
      setDetecting(false);
      setDetectErr("Não foi possível salvar a conexão antes de detectar.");
      return;
    }
    try {
      const r = await fetch("/api/crm/sync", { method: "GET", cache: "no-store" });
      const d = await r.json();
      if (d?.ok && Array.isArray(d.fields)) {
        setFields(d.fields as CrmField[]);
        if (!d.fields.length) setDetectErr("Nenhum campo personalizado encontrado nessa lista.");
      } else {
        setDetectErr(d?.error || "Não foi possível detectar os campos.");
      }
    } catch (e) {
      setDetectErr(String(e));
    } finally {
      setDetecting(false);
    }
  }

  async function saveClickup() {
    setSaving(true);
    const saved = await onSave({ provider: "clickup", clickupToken: token, clickupListId: listId, fieldMap });
    setSaving(false);
    if (saved) onDone();
  }

  async function genWebhook() {
    setSaving(true);
    const saved = await onSave({ provider: "webhook" });
    setSaving(false);
    if (saved) setWebhook(saved);
  }

  function copy(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(text);
  }

  return (
    <div className="card pad-lg" style={{ maxWidth: 680 }}>
      <div className="card-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="t">Conectar CRM</div>
          <div className="sub">Seu funil vive no ClickUp — traga os leads pra cá.</div>
        </div>
      </div>

      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={mode === "clickup" ? "on" : ""} onClick={() => setMode("clickup")} type="button">
          ClickUp
        </button>
        <button className={mode === "webhook" ? "on" : ""} onClick={() => setMode("webhook")} type="button">
          Webhook
        </button>
      </div>

      {mode === "clickup" && (
        <div>
          <div className="pm-hint" style={{ marginBottom: 12 }}>
            Cole o <b>token pessoal</b> do ClickUp e o <b>List ID</b> da lista do funil. Depois clique em{" "}
            <b>Detectar campos</b> pra mapear cada dimensão ao campo personalizado certo.
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="field-lbl">Token do ClickUp</label>
            <input
              className="field-edit"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="pk_..."
              autoComplete="off"
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label className="field-lbl">List ID</label>
              <input
                className="field-edit"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                placeholder="Ex.: 901234567"
              />
            </div>
            <button
              className="btn-link"
              onClick={detectFields}
              disabled={detecting || !token.trim() || !listId.trim()}
              type="button"
            >
              {detecting ? "Detectando…" : "Detectar campos"}
            </button>
          </div>

          {detectErr && <div className="auth-err" style={{ marginBottom: 12 }}>{detectErr}</div>}

          {fields && fields.length > 0 && (
            <div className="pm-hint" style={{ marginBottom: 12 }}>
              <b>{fields.length}</b> {fields.length === 1 ? "campo detectado" : "campos detectados"}:{" "}
              {fields.map((f) => f.name).join(" · ")}
            </div>
          )}

          <div className="field-lbl" style={{ marginBottom: 4 }}>
            Mapeamento de campos {fields ? "" : "(opcional — ou detecte acima)"}
          </div>
          <div className="pm-hint" style={{ marginBottom: 10 }}>
            Deixe em <b>automático</b> pra eu detectar pelo nome do campo, ou <b>escolha o campo exato</b> do seu ClickUp
            pra cada dimensão (o manual tem prioridade). O que você escolher aqui vale na leitura na hora.
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginBottom: 16 }}
          >
            {FIELD_KEYS.map((f) => (
              <div key={f.k}>
                <label className="field-lbl">
                  {f.lbl} <span style={{ color: "var(--label-3)", fontWeight: 400 }}>· {f.hint}</span>
                </label>
                {fieldNames.length > 0 ? (
                  <select
                    className="field-edit"
                    value={fieldMap[f.k] ?? ""}
                    onChange={(e) => setFieldMap((p) => ({ ...p, [f.k]: e.target.value }))}
                  >
                    <option value="">{mapping?.[f.k] ? `— automático (lendo: ${mapping[f.k]}) —` : "— automático / não mapear —"}</option>
                    {fieldNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field-edit"
                    value={fieldMap[f.k] ?? ""}
                    onChange={(e) => setFieldMap((p) => ({ ...p, [f.k]: e.target.value }))}
                    placeholder="nome do campo"
                  />
                )}
              </div>
            ))}
          </div>

          <button
            className="btn-link ig"
            onClick={saveClickup}
            disabled={saving || !token.trim() || !listId.trim()}
            type="button"
          >
            {saving ? "Salvando…" : "Conectar ClickUp"}
          </button>

          {/* transparência: como a leitura funciona + campos vistos (movido do dashboard pra cá) */}
          <div style={{ marginTop: 16 }}>
            <ConnectionPanel mapping={mapping} fields={liveFields} />
          </div>
        </div>
      )}

      {mode === "webhook" && (
        <div>
          <div className="pm-hint" style={{ marginBottom: 12 }}>
            Gere uma URL de ingestão e aponte qualquer CRM pra ela. Envie <b>POST</b> com JSON do lead
            (<code>title, channel, product, status, value, lossReason, extId</code>) e o header{" "}
            <code>x-crm-secret</code>.
          </div>

          {!webhook ? (
            <button className="btn-link ig" onClick={genWebhook} disabled={saving} type="button">
              {saving ? "Gerando…" : "Gerar conexão de webhook"}
            </button>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <label className="field-lbl">URL do webhook</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="field-edit" readOnly value={webhookUrl} onFocus={(e) => e.target.select()} />
                  <button className="btn-link" type="button" onClick={() => copy(webhookUrl)}>Copiar</button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="field-lbl">Segredo (header x-crm-secret)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="field-edit" readOnly value={webhook.webhookSecret ?? ""} onFocus={(e) => e.target.select()} />
                  <button className="btn-link" type="button" onClick={() => copy(webhook.webhookSecret ?? "")}>Copiar</button>
                </div>
              </div>
              <button className="btn-link ig" onClick={onDone} type="button">Concluir</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// rótulo de valor vazio → "Não preenchido" (o traçado do CRM = campo não preenchido).
const NAO_PREENCHIDO = "Não preenchido";
const fill = (v: string | null | undefined) => (v && String(v).trim() ? String(v) : NAO_PREENCHIDO);

// ── barra de desfecho: ganho / em aberto / perdido, proporcional ──
function OutcomeBar({ won, lost, open }: { won: number; lost: number; open: number }) {
  const total = won + lost + open;
  if (total === 0) return null;
  const seg = [
    { n: won, c: "var(--excelente)", l: "Ganhos" },
    { n: open, c: "var(--cyan)", l: "Em aberto" },
    { n: lost, c: "var(--red)", l: "Perdidos" },
  ].filter((x) => x.n > 0);
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "var(--cream)" }}>
        {seg.map((x) => (
          <div key={x.l} title={`${x.l}: ${fmt(x.n)}`} style={{ width: `${(x.n / total) * 100}%`, background: x.c }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
        {seg.map((x) => (
          <span key={x.l} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--label-2)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: x.c }} />
            {x.l} <b className="tnum">{fmt(x.n)}</b>
            <span style={{ color: "var(--label-3)" }}>({Math.round((x.n / total) * 100)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// paleta cíclica p/ pizza (cores da Seahub, boa separação)
const PIE_COLORS = ["var(--cyan)", "var(--red)", "var(--excelente)", "var(--atencao)", "#8E5BE0", "var(--ink)", "#1877F2", "#E1306C", "#00A884", "#FF6B35"];
const pieColor = (i: number) => PIE_COLORS[i % PIE_COLORS.length];

// ── Pizza (donut) SVG + legenda ──
function PieChart({ rows }: { rows: Row[] }) {
  const total = rows.reduce((a, r) => a + r.count, 0);
  if (total === 0) return null;
  const top = rows.slice(0, 9);
  const rest = rows.slice(9);
  const segs = rest.length ? [...top, { key: "outros", count: rest.reduce((a, r) => a + r.count, 0), value: 0 }] : top;
  const R = 52, r0 = 30, C = 70; // raio externo/interno, centro
  let acc = 0;
  const arcs = segs.map((s, i) => {
    const frac = s.count / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = C + R * Math.cos(a0), y0 = C + R * Math.sin(a0);
    const x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
    const xi1 = C + r0 * Math.cos(a1), yi1 = C + r0 * Math.sin(a1);
    const xi0 = C + r0 * Math.cos(a0), yi0 = C + r0 * Math.sin(a0);
    const d = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r0} ${r0} 0 ${large} 0 ${xi0} ${yi0} Z`;
    return { d, color: pieColor(i), key: s.key, count: s.count, frac };
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, flex: "0 0 140px" }}>
        {arcs.map((a) => <path key={a.key} d={a.d} fill={a.color} />)}
        <text x={C} y={C - 4} textAnchor="middle" fontSize={20} fontWeight={800} fill="var(--label)" className="tnum">{fmt(total)}</text>
        <text x={C} y={C + 12} textAnchor="middle" fontSize={9} fill="var(--label-3)">leads</text>
      </svg>
      <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 5 }}>
        {arcs.map((a) => (
          <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: a.color, flex: "0 0 9px" }} />
            <span style={{ flex: 1, color: "var(--label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.key === "outros" ? "Outros" : fill(a.key)}</span>
            <span className="tnum" style={{ color: "var(--label-2)", fontWeight: 600 }}>{fmt(a.count)}</span>
            <span className="tnum" style={{ color: "var(--label-3)", width: 38, textAlign: "right" }}>{Math.round(a.frac * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// estrelas a partir de um rótulo tipo "5 estrelas" / "4 estrela"
function starsOf(key: string): number | null {
  const m = key.match(/(\d)\s*estrela/i);
  return m ? Number(m[1]) : null;
}
// ── Qualificação por estrelas: uma linha por nível, com ★ ──
function StarBars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  // ordena por nº de estrelas desc quando aplicável
  const sorted = [...rows].sort((a, b) => (starsOf(b.key) ?? -1) - (starsOf(a.key) ?? -1));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map((r, i) => {
        const n = starsOf(r.key);
        return (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 92, fontSize: 13, color: n ? "var(--atencao)" : "var(--label)", letterSpacing: 1, flex: "0 0 92px" }}>
              {n ? "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n)) : fill(r.key)}
            </span>
            <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--surface)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${(r.count / max) * 100}%`, background: pieColor(i) }} />
            </span>
            <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, width: 28, textAlign: "right" }}>{fmt(r.count)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── card de agrupamento — alterna Lista / Pizza (e Estrelas p/ qualificação) ──
function GroupCard({
  title,
  rows,
  color,
  empty,
  defaultViz = "list",
  stars = false,
  showValue = true,
}: {
  title: string;
  rows: Row[];
  color: string | ((i: number) => string);
  empty: string;
  defaultViz?: "list" | "pizza";
  stars?: boolean; // qualificação: mostra ★ em vez de texto
  showValue?: boolean; // false = só contagem (sem R$)
}) {
  const [viz, setViz] = useState<"list" | "pizza">(defaultViz);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card">
      <div className="card-head">
        <div className="t">{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {rows.length > 0 && (
            <div className="seg" style={{ transform: "scale(.86)", transformOrigin: "right center" }}>
              <button className={viz === "list" ? "on" : ""} onClick={() => setViz("list")} type="button" title="Lista">☰</button>
              <button className={viz === "pizza" ? "on" : ""} onClick={() => setViz("pizza")} type="button" title="Pizza">◔</button>
            </div>
          )}
          <span className="badge">{rows.length}</span>
        </div>
      </div>
      {!rows.length ? (
        <div className="sub" style={{ color: "var(--label-3)" }}>{empty}</div>
      ) : viz === "pizza" ? (
        <PieChart rows={rows} />
      ) : stars ? (
        <StarBars rows={rows} />
      ) : (
        rows.map((r, i) => (
          <BarRow
            key={r.key}
            k={fill(r.key)}
            v={r.count}
            max={max}
            color={typeof color === "function" ? color(i) : color}
            formatted={showValue && r.value > 0 ? `${fmt(r.count)} · ${money(r.value)}` : fmt(r.count)}
          />
        ))
      )}
    </div>
  );
}

// ── Transparência: como a leitura do CRM funciona (de onde vem cada número) ──
const DIM_LABELS: { k: string; lbl: string }[] = [
  { k: "channel", lbl: "Canal" },
  { k: "category", lbl: "Categoria de produto" },
  { k: "product", lbl: "Tipo de produto" },
  { k: "qualification", lbl: "Qualificação" },
  { k: "status", lbl: "Status" },
  { k: "stage", lbl: "Funil / etapa" },
  { k: "value", lbl: "Valor" },
  { k: "lossReason", lbl: "Motivo de perda" },
];
function ConnectionPanel({ mapping, fields }: { mapping?: Record<string, string | null>; fields?: LeadsData["availableFields"] }) {
  const m = mapping ?? {};
  const fs = fields ?? [];
  return (
    <details className="card" style={{ marginBottom: 16, padding: 0 }}>
      <summary style={{ cursor: "pointer", listStyle: "none", padding: "14px 18px", display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13.5 }}>
        <span aria-hidden>🔎</span> Como esta leitura funciona
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500, color: "var(--label-3)" }}>de onde vem cada número</span>
      </summary>
      <div style={{ borderTop: "1px solid var(--hairline)", padding: "14px 18px", fontSize: 12.5, color: "var(--label-2)", lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 10px" }}>
          Puxo as tasks da lista do ClickUp e traduzo cada uma num lead. <b>Total de leads</b> = tasks criadas no período
          (pela <b>data de criação</b> da task). <b>Ganho/Perdido/Em aberto</b> vêm do campo <b>&quot;status CRM&quot;</b> (ganho/perdido)
          e/ou das datas <b>&quot;data ganho&quot;/&quot;data perdido&quot;</b> preenchidas — não adivinho por texto.
        </p>
        <div style={{ fontWeight: 700, color: "var(--label)", margin: "10px 0 6px" }}>Campo do ClickUp lido em cada dimensão:</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "6px 18px" }}>
          {DIM_LABELS.map(({ k, lbl }) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px solid var(--hairline)", padding: "4px 0" }}>
              <span style={{ color: "var(--label-3)" }}>{lbl}</span>
              <span style={{ fontWeight: 600, color: m[k] ? "var(--label)" : "var(--label-3)", textAlign: "right" }}>
                {m[k] || "— não detectado —"}
              </span>
            </div>
          ))}
        </div>
        <p style={{ margin: "12px 0 0", color: "var(--label-3)" }}>
          Detecção automática por nome do campo. Se algum campo estiver &quot;não detectado&quot; ou errado, use
          <b> Reconfigurar → Detectar campos</b> pra apontar o campo certo (isso tem prioridade sobre a detecção automática).
        </p>

        {fs.length > 0 && (
          <>
            <div style={{ fontWeight: 700, color: "var(--label)", margin: "14px 0 6px" }}>Campos personalizados vistos no ClickUp ({fs.length}):</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--label-3)" }}>
                    <th style={{ padding: "4px 8px", fontWeight: 600 }}>Campo</th>
                    <th style={{ padding: "4px 8px", fontWeight: 600 }}>Tipo</th>
                    <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Preenchidos</th>
                    <th style={{ padding: "4px 8px", fontWeight: 600 }}>Exemplo</th>
                  </tr>
                </thead>
                <tbody>
                  {fs.map((f) => (
                    <tr key={f.name} style={{ borderTop: "1px solid var(--hairline)" }}>
                      <td style={{ padding: "4px 8px", fontWeight: 600, color: "var(--label)" }}>{f.name}</td>
                      <td style={{ padding: "4px 8px", color: "var(--label-3)" }}>{f.type || "—"}</td>
                      <td style={{ padding: "4px 8px", textAlign: "right" }} className="tnum">{f.filled}</td>
                      <td style={{ padding: "4px 8px", color: "var(--label-2)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.sample || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </details>
  );
}

// ── Dashboard de leads ──
function Dashboard({ data }: { data: LeadsData }) {
  if (data.total === 0) {
    return (
      <div className="empty">
        <div className="e-ico">📥</div>
        <h3>Nenhum lead no período</h3>
        <p>
          Ajuste o período na barra acima ou clique em <b>Sincronizar</b> para trazer os leads do seu CRM.
        </p>
      </div>
    );
  }

  const cycle = (i: number) => CHANNEL_COLORS[i % CHANNEL_COLORS.length];
  const conv = `${(data.convRate * 100).toFixed(1)}%`;
  // indicadores derivados (inteligência de marketing) — só do que já temos, sem inventar
  const ticket = data.won ? data.wonValue / data.won : 0; // ticket médio do ganho
  const lossRate = data.total ? data.lost / data.total : 0; // taxa de perda
  const openRate = data.total ? data.open / data.total : 0; // % em aberto
  const avgLead = data.total ? data.totalValue / data.total : 0; // valor médio por lead

  return (
    <>
      {/* Saúde do CRM — bloco ÚNICO no topo (substitui os KPIs soltos). Desfecho + indicadores
          agrupados (Volume / Valores / Taxas), sem repetir o mesmo número várias vezes. */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div className="t">Saúde do CRM</div>
          <span className="badge">no período</span>
        </div>
        <OutcomeBar won={data.won} lost={data.lost} open={data.open} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginTop: 16 }}>
          <StatGroup title="Volume" items={[
            { l: "Total de leads", n: fmt(data.total) },
            { l: "Em aberto", n: fmt(data.open) },
            { l: "Ganhos", n: fmt(data.won), c: "var(--excelente)" },
            { l: "Perdidos", n: fmt(data.lost), c: "var(--red)" },
          ]} />
          <StatGroup title="Valores" items={[
            { l: "Valor total", n: money(data.totalValue) },
            { l: "Valor ganho", n: money(data.wonValue), c: "var(--excelente)" },
            { l: "Em pipeline", n: money(data.pipelineValue) },
            { l: "Ticket médio (ganho)", n: money(ticket) },
          ]} />
          <StatGroup title="Taxas" items={[
            { l: "Conversão", n: conv, c: "var(--excelente)" },
            { l: "Taxa de perda", n: `${(lossRate * 100).toFixed(1)}%`, c: "var(--red)" },
            { l: "Em negociação", n: `${(openRate * 100).toFixed(1)}%` },
            { l: "Valor médio / lead", n: money(avgLead) },
          ]} />
        </div>
      </div>

      {/* Widgets organizáveis (arrasta, redimensiona, oculta) — persiste por painel */}
      <WidgetBoard
        panel="crm"
        widgets={[
          { id: "canal", label: "Por canal", defaultSize: "sm", node: <GroupCard title="Por canal" rows={data.byChannel} color={cycle} empty="Sem canal informado." defaultViz="pizza" /> },
          { id: "categoria", label: "Por categoria de produto", defaultSize: "sm", node: <GroupCard title="Por categoria de produto" rows={data.byCategory} color={cycle} empty="Sem categoria informada." defaultViz="list" showValue={false} /> },
          { id: "produto", label: "Por tipo de produto", defaultSize: "sm", node: <GroupCard title="Por tipo de produto" rows={data.byProduct} color={cycle} empty="Sem produto informado." defaultViz="list" showValue={false} /> },
          { id: "qualificacao", label: "Por qualificação", defaultSize: "sm", node: <GroupCard title="Por qualificação" rows={data.byQualification} color={cycle} empty="Sem qualificação informada." stars /> },
          { id: "funil", label: "Por funil / etapa", defaultSize: "sm", node: <GroupCard title="Por funil / etapa" rows={data.byStage} color="var(--cyan)" empty="Sem etapa informada." defaultViz="pizza" showValue={false} /> },
          { id: "status", label: "Por status", defaultSize: "sm", node: <GroupCard title="Por status" rows={data.byStatus} color={cycle} empty="Sem status informado." defaultViz="list" showValue={false} /> },
          ...(data.lossReasons.length > 0 ? [{ id: "perda", label: "Motivos de perda", defaultSize: "sm" as const, node: <GroupCard title="Motivos de perda" rows={data.lossReasons} color={pieColor} empty="Sem motivo informado." defaultViz="pizza" showValue={false} /> }] : []),
          ...(data.channelHealth && data.channelHealth.length > 0 ? [{ id: "saude-canal", label: "Saúde por canal", defaultSize: "lg" as const, node: <ChannelHealthCard rows={data.channelHealth} /> }] : []),
        ]}
      />

      <LeadsTable leads={data.leads} />
    </>
  );
}

// grupo de indicadores (rótulo + coluna de valores) — organiza a Saúde sem virar sopa de quadradinhos
function StatGroup({ title, items }: { title: string; items: { l: string; n: string; c?: string }[] }) {
  return (
    <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--label-3)", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map((it) => (
          <div key={it.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--label-2)" }}>{it.l}</span>
            <span className="tnum" style={{ fontSize: 15, fontWeight: 700, color: it.c || "var(--label)" }}>{it.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Saúde por canal: conversão (ganho/total) por canal, ordenado ──
function ChannelHealthCard({ rows }: { rows: NonNullable<LeadsData["channelHealth"]> }) {
  const top = rows.slice(0, 8);
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div className="t">Saúde por canal</div>
        <span className="badge">conversão</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {top.map((c, i) => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ width: 130, fontSize: 12.5, fontWeight: 600, color: "var(--label)", flex: "0 0 130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fill(c.key)}</span>
            {/* barra empilhada ganho/aberto/perdido */}
            <span style={{ flex: 1, minWidth: 120, display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--cream)" }}>
              {c.won > 0 && <span style={{ width: `${(c.won / c.total) * 100}%`, background: "var(--excelente)" }} title={`Ganhos: ${c.won}`} />}
              {c.open > 0 && <span style={{ width: `${(c.open / c.total) * 100}%`, background: "var(--cyan)" }} title={`Em aberto: ${c.open}`} />}
              {c.lost > 0 && <span style={{ width: `${(c.lost / c.total) * 100}%`, background: "var(--red)" }} title={`Perdidos: ${c.lost}`} />}
            </span>
            <span className="tnum" style={{ fontSize: 12.5, color: "var(--label-2)", width: 54, textAlign: "right" }}>{fmt(c.total)} leads</span>
            <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: c.conv >= 0.3 ? "var(--excelente)" : c.conv > 0 ? "var(--label)" : "var(--label-3)", width: 62, textAlign: "right" }}>
              {(c.conv * 100).toFixed(0)}% conv.
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--label-3)", marginTop: 10 }}>
        Verde = ganho · azul = em aberto · vermelho = perdido. Conversão = ganhos ÷ total do canal.
      </div>
    </div>
  );
}

// célula vazia → "não preenchido" (muted). O traçado do CRM = campo não preenchido.
function Cell({ v }: { v: string | null }) {
  if (v && v.trim()) return <>{v}</>;
  return <span style={{ color: "var(--label-3)", fontStyle: "italic", fontSize: 12 }}>não preenchido</span>;
}

// ── tabela de leads: filtros por dimensão + colapso (mostra N, expande o resto) ──
const PAGE = 20;
function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const [fCanal, setFCanal] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fProduto, setFProduto] = useState("");
  const [fQualif, setFQualif] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [expanded, setExpanded] = useState(false);

  // valores únicos por dimensão (pra os selects) — inclui "não preenchido" quando houver vazios
  const uniq = (get: (l: LeadRow) => string | null) => {
    const set = new Set<string>();
    let temVazio = false;
    for (const l of leads) {
      const v = get(l);
      if (v && v.trim()) set.add(v.trim());
      else temVazio = true;
    }
    const arr = [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (temVazio) arr.push(NAO_PREENCHIDO);
    return arr;
  };
  const opts = useMemo(
    () => ({
      canal: uniq((l) => l.channel),
      categoria: uniq((l) => l.category),
      produto: uniq((l) => l.product),
      qualif: uniq((l) => l.qualification),
      status: uniq((l) => l.status),
    }),
    [leads]
  );

  // aplica filtros (matcha "Não preenchido" contra valores vazios)
  const match = (v: string | null, f: string) => {
    if (!f) return true;
    const val = v && v.trim() ? v.trim() : NAO_PREENCHIDO;
    return val === f;
  };
  const filtered = leads.filter(
    (l) =>
      match(l.channel, fCanal) &&
      match(l.category, fCategoria) &&
      match(l.product, fProduto) &&
      match(l.qualification, fQualif) &&
      match(l.status, fStatus)
  );
  const shown = expanded ? filtered : filtered.slice(0, PAGE);
  const hasFilter = !!(fCanal || fCategoria || fProduto || fQualif || fStatus);
  const clear = () => { setFCanal(""); setFCategoria(""); setFProduto(""); setFQualif(""); setFStatus(""); };

  if (!leads.length) return null;

  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 11, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--label-3)", fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "9px 10px", fontSize: 13, borderTop: "1px solid var(--hairline, rgba(0,0,0,.06))", verticalAlign: "top" };
  const selStyle: React.CSSProperties = { fontSize: 12.5 };

  const FilterSelect = ({ v, set, list, ph }: { v: string; set: (s: string) => void; list: string[]; ph: string }) =>
    list.length > 1 ? (
      <select className="field-edit" style={selStyle} value={v} onChange={(e) => set(e.target.value)} aria-label={ph}>
        <option value="">{ph}</option>
        {list.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : null;

  return (
    <div className="card">
      <div className="card-head">
        <div className="t">Leads</div>
        <span className="badge">{hasFilter ? `${filtered.length}/${leads.length}` : leads.length}</span>
      </div>

      {/* filtros por dimensão — barra única, enxuta */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14, padding: "10px 12px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--hairline)" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--label-3)", marginRight: 2 }}>Filtrar</span>
        <FilterSelect v={fCanal} set={setFCanal} list={opts.canal} ph="Canal" />
        <FilterSelect v={fCategoria} set={setFCategoria} list={opts.categoria} ph="Categoria" />
        <FilterSelect v={fProduto} set={setFProduto} list={opts.produto} ph="Produto" />
        <FilterSelect v={fQualif} set={setFQualif} list={opts.qualif} ph="Qualificação" />
        <FilterSelect v={fStatus} set={setFStatus} list={opts.status} ph="Status" />
        {hasFilter && <button className="btn-link" type="button" onClick={clear} style={{ marginLeft: "auto" }}>Limpar</button>}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Lead</th>
              <th style={th}>Canal</th>
              <th style={th}>Categoria</th>
              <th style={th}>Produto</th>
              <th style={th}>Qualificação</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: "right" }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const oc = OUTCOME[l.outcome];
              return (
                <tr key={l.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}><Cell v={l.title} /></div>
                    {l.lossReason && l.lossReason.trim() && (
                      <div style={{ fontSize: 11.5, color: "var(--red)" }}>Perda: {l.lossReason}</div>
                    )}
                  </td>
                  <td style={td}><Cell v={l.channel} /></td>
                  <td style={td}><Cell v={l.category} /></td>
                  <td style={td}><Cell v={l.product} /></td>
                  <td style={td}><Cell v={l.qualification} /></td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: oc.color }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: oc.color, display: "inline-block" }} />
                      <Cell v={l.status} />
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right" }} className="tnum">
                    {l.value > 0 ? money(l.value) : <span style={{ color: "var(--label-3)" }}>—</span>}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--label-3)" }}>Nenhum lead com esses filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="btn-link" type="button" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Recolher" : `Ver todos os ${filtered.length}`}
          </button>
        </div>
      )}
    </div>
  );
}
