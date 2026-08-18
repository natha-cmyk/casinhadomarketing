"use client";
// Geração por Canais — CRM do cliente (vive no ClickUp, fora da integração social).
// Conecta via ClickUp nativo (API REST) ou webhook genérico e mostra leads/oportunidades
// por canal, categoria, produto, qualificação, status/etapa e motivo de perda, respeitando
// o período da toolbar. O usuário mapeia os campos personalizados do ClickUp por dimensão.
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { PageHead, KpiCard, BarRow, MiniStat } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import { Ic } from "@/components/Ic";
import { fmt, money } from "@/lib/format";
import { daysInMonth, type Period } from "@/lib/scope";

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
                  <button className="btn-link ig" onClick={() => sync(false)} disabled={syncing} type="button" title="Puxa só o que mudou desde o último sync">
                    <Ic name="leads" /> {syncing ? "Sincronizando…" : "Sincronizar"}
                  </button>
                  <button className="btn-link" onClick={() => sync(true)} disabled={syncing} type="button" title="Reprocessa todos os leads do zero">
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
}: {
  config: CrmConfig | null;
  workspaceId: string;
  onSave: (p: Partial<CrmConfig>) => Promise<CrmConfig | null>;
  onDone: () => void;
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

          <div className="field-lbl" style={{ marginBottom: 8 }}>
            Mapeamento de campos {fields ? "" : "(opcional — ou detecte acima)"}
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
                    <option value="">— automático / não mapear —</option>
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

// ── card de agrupamento (canal / categoria / produto / qualificação) ──
function GroupCard({
  title,
  rows,
  color,
  empty,
}: {
  title: string;
  rows: Row[];
  color: string | ((i: number) => string);
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card">
      <div className="card-head">
        <div className="t">{title}</div>
        <span className="badge">{rows.length}</span>
      </div>
      {rows.length ? (
        rows.map((r, i) => (
          <BarRow
            key={r.key}
            k={fill(r.key)}
            v={r.count}
            max={max}
            color={typeof color === "function" ? color(i) : color}
            formatted={r.value > 0 ? `${fmt(r.count)} · ${money(r.value)}` : fmt(r.count)}
          />
        ))
      ) : (
        <div className="sub" style={{ color: "var(--label-3)" }}>{empty}</div>
      )}
    </div>
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

  return (
    <>
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Total de leads" val={fmt(data.total)} foot="no período" />
        <KpiCard lbl="Em aberto" val={fmt(data.open)} foot={`${money(data.pipelineValue)} em pipeline`} />
        <KpiCard lbl="Ganhos" val={fmt(data.won)} foot={`${money(data.wonValue)} fechado`} tone="pos" />
        <KpiCard lbl="Perdidos" val={fmt(data.lost)} foot={`conversão ${conv}`} tone="neg" />
      </div>

      {/* Saúde do CRM — indicadores consolidados + barra de desfecho (ganho/aberto/perdido) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div className="t">Saúde do CRM</div>
          <span className="badge">no período</span>
        </div>
        <OutcomeBar won={data.won} lost={data.lost} open={data.open} />
        <div className="mini" style={{ marginTop: 14 }}>
          <MiniStat l="Total de leads" n={fmt(data.total)} />
          <MiniStat l="Taxa de conversão" n={conv} />
          <MiniStat l="Em aberto" n={fmt(data.open)} />
          <MiniStat l="Ganhos" n={fmt(data.won)} />
          <MiniStat l="Perdidos" n={fmt(data.lost)} />
          <MiniStat l="Valor total" n={money(data.totalValue)} />
          <MiniStat l="Valor ganho" n={money(data.wonValue)} />
          <MiniStat l="Em pipeline" n={money(data.pipelineValue)} />
        </div>
      </div>

      <div className="grid two-col" style={{ marginBottom: 16 }}>
        <GroupCard title="Por canal" rows={data.byChannel} color={cycle} empty="Sem canal informado." />
        <GroupCard title="Por categoria de produto" rows={data.byCategory} color={cycle} empty="Sem categoria informada." />
      </div>

      <div className="grid two-col" style={{ marginBottom: 16 }}>
        <GroupCard title="Por tipo de produto" rows={data.byProduct} color={cycle} empty="Sem produto informado." />
        <GroupCard title="Por qualificação" rows={data.byQualification} color={cycle} empty="Sem qualificação informada." />
      </div>

      <div className="grid two-col" style={{ marginBottom: 16 }}>
        <GroupCard title="Por funil / etapa" rows={data.byStage} color="var(--cyan)" empty="Sem etapa informada." />
        <GroupCard title="Por status" rows={data.byStatus} color={cycle} empty="Sem status informado." />
      </div>

      {data.lossReasons.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><div className="t">Motivos de perda</div><span className="badge">{data.lost}</span></div>
          <div className="top-list">
            {data.lossReasons.map((r) => (
              <div className="bar-row" key={r.key}>
                <div className="k">{r.key}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(r.count / Math.max(1, data.lost)) * 100}%`, background: "var(--red)" }}
                  />
                </div>
                <div className="v tnum">{r.value > 0 ? `${fmt(r.count)} · ${money(r.value)}` : fmt(r.count)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <LeadsTable leads={data.leads} />
    </>
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

      {/* filtros por dimensão */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <FilterSelect v={fCanal} set={setFCanal} list={opts.canal} ph="Todos os canais" />
        <FilterSelect v={fCategoria} set={setFCategoria} list={opts.categoria} ph="Todas as categorias" />
        <FilterSelect v={fProduto} set={setFProduto} list={opts.produto} ph="Todos os produtos" />
        <FilterSelect v={fQualif} set={setFQualif} list={opts.qualif} ph="Todas as qualificações" />
        <FilterSelect v={fStatus} set={setFStatus} list={opts.status} ph="Todos os status" />
        {hasFilter && <button className="btn-link" type="button" onClick={clear}>Limpar filtros</button>}
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
