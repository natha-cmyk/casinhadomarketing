// Builder da planilha anual (servidor). Monta a matriz de VALORES por aba a partir dos
// dados REAIS da plataforma, chaveada pela mesma row.key da spec.
//   insights → PlanilhaCell(tab=insights)  [histórico importado + manual; ao vivo depois]
//   geracao  → Lead (channel × product) AO VIVO, sobrepondo PlanilhaCell nos meses com lead
//   pagos    → Lead (plataforma paga × product) AO VIVO, sobrepondo PlanilhaCell (mensal)
// Regra: mês com dado AO VIVO usa o vivo; mês sem dado vivo usa o histórico/manual (PlanilhaCell).
// Semanas reais pela data (createdAt/data). Sem invenção: célula sem dado fica null.
import { prisma } from "@/lib/prisma";
import { weekOfDay, GERACAO_PRODUTOS, GERACAO_FONTES, PAGOS_CAMPANHAS, tabById, type PSection } from "./spec";
import { type Cell, type RowData, type TabData, emptyRow } from "./types";

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function bucket(d: Date): { m: number; w: number } {
  const local = new Date(d.getTime() - 3 * 3600e3); // competência local de Natal (UTC-3)
  return { m: local.getUTCMonth(), w: weekOfDay(local.getUTCDate()) };
}
function addCell(row: RowData, m: number, w: number, n = 1) {
  row.weeks[m][w] = ((row.weeks[m][w] as number) || 0) + n;
  row.months[m] = ((row.months[m] as number) || 0) + n;
}
function ensure(data: TabData, key: string): RowData {
  return (data[key] ??= emptyRow());
}
function yearRange(year: number) {
  return { gte: new Date(Date.UTC(year, 0, 1, 3, 0, 0)), lt: new Date(Date.UTC(year + 1, 0, 1, 3, 0, 0)) };
}

// ── PlanilhaCell (histórico importado + preenchimento manual) → TabData ──
async function loadStored(workspaceId: string, year: number, tab: string): Promise<TabData> {
  const data: TabData = {};
  const cells = await prisma.planilhaCell.findMany({ where: { workspaceId, tab, ano: year } });
  for (const c of cells) {
    if (c.mes < 1 || c.mes > 12) continue;
    const row = ensure(data, c.metric);
    const v: Cell = c.texto != null ? c.texto : c.valor ?? null;
    if (c.semana === -1) row.months[c.mes - 1] = v;
    else if (c.semana >= 0 && c.semana < 4) row.weeks[c.mes - 1][c.semana] = v;
  }
  return data;
}

// mescla: mês com dado AO VIVO usa o vivo; senão, usa o histórico/manual (stored)
function mergeLiveOverStored(stored: TabData, live: TabData, liveMonths: Set<number>): TabData {
  const out: TabData = {};
  const keys = new Set([...Object.keys(stored), ...Object.keys(live)]);
  for (const k of keys) {
    const s = stored[k], l = live[k];
    const row = emptyRow();
    for (let m = 0; m < 12; m++) {
      if (liveMonths.has(m) && l) { row.weeks[m] = l.weeks[m]; row.months[m] = l.months[m]; }
      else if (s) { row.weeks[m] = s.weeks[m]; row.months[m] = s.months[m]; }
    }
    out[k] = row;
  }
  return out;
}

// ── mapeadores de texto do CRM → ids da spec (best-effort por palavra-chave) ──
function mapProduto(product: unknown, title?: unknown): string | null {
  const s = norm(product) + " " + norm(title);
  if (/escritorio virtual|endereco fiscal|\bev\b|virtual/.test(s)) return "ev";
  if (/reuniao|meeting/.test(s)) return "salas_reuniao";
  if (/auditorio|palco/.test(s)) return "auditorios";
  if (/privativ|coworking|estacao|fixa/.test(s)) return "salas_privativas";
  if (/seabox/.test(s)) return "seabox";
  if (/seaoffice|sea office/.test(s)) return "seaoffice";
  return null;
}
function mapFonte(channel: unknown): string | null {
  const s = norm(channel);
  if (!s) return null;
  if (/transmissao|broadcast|lista/.test(s)) return "transmissao";
  if (/perdid|perda|loss|descart/.test(s)) return "lead_perdido";
  if (/parceri|parceir|partner/.test(s)) return "parceria";
  if (/indicac|indicao|corretor|referral/.test(s)) return "indicacao";
  if (/comunidade|community/.test(s)) return "comunidade";
  if (/evento|event/.test(s)) return "eventos";
  if (/prospec|outbound|cold/.test(s)) return "prospeccao";
  if (/cliente ativo|ativo|upsell|base/.test(s)) return "cliente_ativo";
  if (/organic/.test(s)) return "organico";
  if (/rede|social|instagram|facebook|meta|tiktok|linkedin/.test(s)) return "redes";
  if (/loja|store|balcao|recepcao|presencial|walk/.test(s)) return "loja";
  if (/site|web|landing|form|google|search/.test(s)) return "site";
  return null;
}
function mapPlatPaga(channel: unknown): "google" | "meta" | null {
  const s = norm(channel);
  if (/google|search|youtube|\byt\b|pesquisa/.test(s)) return "google";
  if (/meta|facebook|instagram|\bads\b/.test(s)) return "meta";
  return null;
}
function isWon(status: unknown): boolean {
  return /ganho|won|fechad|venda|cliente|convertid|assinou|pago/.test(norm(status));
}

// ── ABA 1: INSIGHTS (Instagram) — histórico/manual (ao vivo entra depois) ──
async function buildInsights(workspaceId: string, year: number): Promise<TabData> {
  return loadStored(workspaceId, year, "insights");
}

// ── ABA 2: GERAÇÃO POR CANAIS (leads por fonte × produto) ──
async function buildGeracao(workspaceId: string, year: number): Promise<TabData> {
  const live: TabData = {};
  for (const p of GERACAO_PRODUTOS) {
    for (const f of GERACAO_FONTES) ensure(live, `${p.id}.${f.id}`);
    ensure(live, `${p.id}.total`);
  }
  const liveMonths = new Set<number>();
  const leads = await prisma.lead.findMany({
    where: { workspaceId, createdAt: yearRange(year) },
    select: { channel: true, product: true, title: true, createdAt: true },
  });
  for (const l of leads) {
    const { m, w } = bucket(l.createdAt);
    liveMonths.add(m);
    const prod = mapProduto(l.product, l.title);
    if (!prod) continue;
    const fonte = mapFonte(l.channel);
    if (fonte) addCell(live[`${prod}.${fonte}`], m, w, 1);
    addCell(live[`${prod}.total`], m, w, 1);
  }
  const stored = await loadStored(workspaceId, year, "geracao");
  return mergeLiveOverStored(stored, live, liveMonths);
}

// ── ABA 3: CANAIS PAGOS (campanha × métrica) — mensal ──
async function buildPagos(workspaceId: string, year: number): Promise<TabData> {
  const live: TabData = {};
  for (const c of PAGOS_CAMPANHAS) {
    for (const k of ["leads", "vendas", "receita", "investimento", "cpl", "cac", "conversao"]) ensure(live, `${c.id}.${k}`);
  }
  const campSet = new Set(PAGOS_CAMPANHAS.map((c) => c.id));
  const pickCampaign = (plat: "google" | "meta", prod: string | null): string | null => {
    const cands = [`${plat}_${prod}`, plat === "google" ? "google_servicos" : "meta_servicos", `${plat}_ev`];
    return cands.find((c) => campSet.has(c)) ?? null;
  };
  const liveMonths = new Set<number>();
  const leads = await prisma.lead.findMany({
    where: { workspaceId, createdAt: yearRange(year) },
    select: { channel: true, product: true, title: true, status: true, value: true, createdAt: true },
  });
  for (const l of leads) {
    const plat = mapPlatPaga(l.channel);
    if (!plat) continue;
    const camp = pickCampaign(plat, mapProduto(l.product, l.title));
    if (!camp) continue;
    const { m, w } = bucket(l.createdAt);
    liveMonths.add(m);
    addCell(live[`${camp}.leads`], m, w, 1);
    if (isWon(l.status)) {
      addCell(live[`${camp}.vendas`], m, w, 1);
      if (l.value) addCell(live[`${camp}.receita`], m, w, l.value);
    }
  }
  // taxa de conversão mensal = vendas/leads (não-aditiva)
  for (const c of PAGOS_CAMPANHAS) {
    const lr = live[`${c.id}.leads`], vr = live[`${c.id}.vendas`], conv = live[`${c.id}.conversao`];
    for (let m = 0; m < 12; m++) {
      const lv = lr.months[m] as number | null, vd = vr.months[m] as number | null;
      conv.months[m] = lv && lv > 0 ? (vd || 0) / lv : null;
    }
  }
  const stored = await loadStored(workspaceId, year, "pagos");
  return mergeLiveOverStored(stored, live, liveMonths);
}

export const COVERAGE: Record<string, string> = {
  insights: "Instagram · histórico importado das planilhas + preenchimento manual. Integração ao vivo (semanas do período corrente) entra em seguida.",
  geracao: "Leads reais do CRM por fonte × produto (semanas reais pela data). Meses sem lead ao vivo mostram o histórico importado/manual.",
  pagos: "Leads/vendas/receita reais do CRM por campanha. Investimento/CPL/CAC e histórico entram por importação/manual.",
};

// ── estrutura salva por (tab, ano): célula especial metric="__structure__", mes=0, texto=JSON{weekly,sections} ──
async function loadStructure(workspaceId: string, year: number, tab: string): Promise<{ weekly: boolean; sections: PSection[] } | null> {
  const c = await prisma.planilhaCell.findFirst({ where: { workspaceId, tab, ano: year, metric: "__structure__", mes: 0 } });
  if (!c?.texto) return null;
  try {
    const j = JSON.parse(c.texto) as { weekly?: boolean; sections?: PSection[] };
    if (Array.isArray(j?.sections)) return { weekly: !!j.weekly, sections: j.sections };
  } catch {}
  return null;
}

// entrada única do painel: devolve ESTRUTURA (sections/weekly) + VALORES por (tab, ano).
// Insights = template canônico (código). Geração/Pagos: ano com estrutura salva (histórico
// importado/manual) usa a estrutura salva e só os dados salvos; senão usa a canônica + CRM ao vivo.
export async function buildPlanilha(
  workspaceId: string,
  year: number,
  tab: string
): Promise<{ weekly: boolean; sections: PSection[]; data: TabData; coverage: string }> {
  const spec = tabById(tab);
  if (tab === "insights") {
    return { weekly: spec.weekly, sections: spec.sections, data: await buildInsights(workspaceId, year), coverage: COVERAGE.insights };
  }
  // geracao / pagos
  const stored = await loadStructure(workspaceId, year, tab);
  if (stored) {
    return { weekly: stored.weekly, sections: stored.sections, data: await loadStored(workspaceId, year, tab), coverage: (COVERAGE[tab] || "") + " · histórico importado" };
  }
  const data = tab === "geracao" ? await buildGeracao(workspaceId, year) : await buildPagos(workspaceId, year);
  return { weekly: spec.weekly, sections: spec.sections, data, coverage: COVERAGE[tab] || "" };
}
