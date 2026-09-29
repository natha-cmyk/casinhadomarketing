// Builder da planilha anual (servidor). Monta a matriz de VALORES por aba a partir dos
// dados REAIS da plataforma, chaveada pela mesma row.key da spec.
//   insights     → HistoricalMetric(platform=instagram)  [mensal; semanas ficam vazias]
//   geracao      → Lead (channel × product) por data      [semanas REAIS via createdAt]
//   planejamento → Post/Calendário (canal × status)       [semanas REAIS via data]
//   pagos        → Lead (plataforma paga × product)        [leads/vendas/receita; investimento depois]
// Tudo escopado por workspace. Sem invenção: célula sem dado fica null.
import { prisma } from "@/lib/prisma";
import { weekOfDay, GERACAO_PRODUTOS, GERACAO_FONTES, PLANEJ_CANAIS, PAGOS_CAMPANHAS } from "./spec";
import { type RowData, type TabData, emptyRow } from "./types";

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// instante UTC → competência local de Natal (UTC-3): { m:0-11, w:0-3 }
function bucket(d: Date): { m: number; w: number } {
  const local = new Date(d.getTime() - 3 * 3600e3);
  return { m: local.getUTCMonth(), w: weekOfDay(local.getUTCDate()) };
}
function addCell(row: RowData, m: number, w: number, n = 1) {
  row.weeks[m][w] = ((row.weeks[m][w] as number) || 0) + n;
  row.months[m] = ((row.months[m] as number) || 0) + n;
}
function ensure(data: TabData, key: string): RowData {
  return (data[key] ??= emptyRow());
}

// janela do ano (limites -03:00 → em UTC começa/termina 03:00)
function yearRange(year: number) {
  return {
    gte: new Date(Date.UTC(year, 0, 1, 3, 0, 0)),
    lt: new Date(Date.UTC(year + 1, 0, 1, 3, 0, 0)),
  };
}

// ── mapeadores de texto do CRM → ids da spec (best-effort por palavra-chave) ──
function mapProduto(product: unknown, title?: unknown): string | null {
  const s = norm(product) + " " + norm(title);
  if (/escritorio virtual|endereco fiscal|\bev\b|virtual/.test(s)) return "ev";
  if (/reuniao|meeting/.test(s)) return "salas_reuniao";
  if (/auditorio|palco|evento espaco/.test(s)) return "auditorios";
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

// ── ABA 1: INSIGHTS (Instagram histórico) ──
async function buildInsights(workspaceId: string, year: number): Promise<TabData> {
  const data: TabData = {};
  const rows = await prisma.historicalMetric.findMany({
    where: { workspaceId, platform: "instagram", ano: year },
  });
  for (const r of rows) {
    if (r.mes < 1 || r.mes > 12) continue;
    const row = ensure(data, r.metric);
    row.months[r.mes - 1] = r.valor;
  }
  return data;
}

// ── ABA 2: GERAÇÃO POR CANAIS (leads por fonte × produto) ──
async function buildGeracao(workspaceId: string, year: number): Promise<TabData> {
  const data: TabData = {};
  // garante todas as linhas da spec (mesmo zeradas) p/ a grade nunca "furar"
  for (const p of GERACAO_PRODUTOS) {
    for (const f of GERACAO_FONTES) ensure(data, `${p.id}.${f.id}`);
    ensure(data, `${p.id}.total`);
  }
  const leads = await prisma.lead.findMany({
    where: { workspaceId, createdAt: yearRange(year) },
    select: { channel: true, product: true, title: true, createdAt: true },
  });
  for (const l of leads) {
    const prod = mapProduto(l.product, l.title);
    const fonte = mapFonte(l.channel);
    if (!prod) continue;
    const { m, w } = bucket(l.createdAt);
    if (fonte) addCell(data[`${prod}.${fonte}`], m, w, 1);
    addCell(data[`${prod}.total`], m, w, 1);
  }
  return data;
}

// ── ABA 3: PLANEJAMENTO (calendário: canal × status) ──
async function buildPlanejamento(workspaceId: string, year: number): Promise<TabData> {
  const data: TabData = {};
  for (const c of PLANEJ_CANAIS) ensure(data, `plan.${c.id}`);
  for (const k of ["plan.total", "plan.publicado", "plan.agendado", "plan.rascunho"]) ensure(data, k);

  const canalIds = new Set(PLANEJ_CANAIS.map((c) => c.id));
  const mapCanal = (canal: unknown): string | null => {
    const s = norm(canal);
    if (canalIds.has(s)) return s;
    if (/instagram|insta|ig\b/.test(s)) return "instagram";
    if (/tiktok|tik tok/.test(s)) return "tiktok";
    if (/facebook|\bfb\b/.test(s)) return "facebook";
    if (/linkedin/.test(s)) return "linkedin";
    if (/youtube|\byt\b/.test(s)) return "youtube";
    if (/twitter|\bx\b/.test(s)) return "x";
    if (/threads/.test(s)) return "threads";
    if (/google|gbp|business/.test(s)) return "googlebusiness";
    return null;
  };

  const posts = await prisma.post.findMany({
    where: { workspaceId, deletedAt: null, data: yearRange(year) },
    select: { canal: true, status: true, data: true },
  });
  for (const p of posts) {
    const { m, w } = bucket(p.data);
    const canal = mapCanal(p.canal);
    if (canal) addCell(data[`plan.${canal}`], m, w, 1);
    addCell(data["plan.total"], m, w, 1);
    const st = norm(p.status);
    if (st === "publicado") addCell(data["plan.publicado"], m, w, 1);
    else if (st === "agendado") addCell(data["plan.agendado"], m, w, 1);
    else addCell(data["plan.rascunho"], m, w, 1);
  }
  return data;
}

// ── ABA 4: CANAIS PAGOS (campanha × métrica) ──
async function buildPagos(workspaceId: string, year: number): Promise<TabData> {
  const data: TabData = {};
  for (const c of PAGOS_CAMPANHAS) {
    for (const k of ["leads", "vendas", "receita", "investimento", "cpl", "cac", "conversao"]) {
      ensure(data, `${c.id}.${k}`);
    }
  }
  // mapa produto→campanha por plataforma (só campanhas existentes na spec)
  const campSet = new Set(PAGOS_CAMPANHAS.map((c) => c.id));
  const pickCampaign = (plat: "google" | "meta", prod: string | null): string | null => {
    const cands = [
      `${plat}_${prod}`,
      plat === "google" ? "google_servicos" : "meta_servicos",
      `${plat}_ev`,
    ];
    return cands.find((c) => campSet.has(c)) ?? null;
  };

  const leads = await prisma.lead.findMany({
    where: { workspaceId, createdAt: yearRange(year) },
    select: { channel: true, product: true, title: true, status: true, value: true, createdAt: true },
  });
  for (const l of leads) {
    const plat = mapPlatPaga(l.channel);
    if (!plat) continue; // só canais PAGOS entram nesta aba
    const prod = mapProduto(l.product, l.title);
    const camp = pickCampaign(plat, prod);
    if (!camp) continue;
    const { m, w } = bucket(l.createdAt);
    addCell(data[`${camp}.leads`], m, w, 1);
    if (isWon(l.status)) {
      addCell(data[`${camp}.vendas`], m, w, 1);
      if (l.value) addCell(data[`${camp}.receita`], m, w, l.value);
    }
  }
  // taxa de conversão mensal = vendas/leads (não-aditiva; só mês)
  for (const c of PAGOS_CAMPANHAS) {
    const leadsRow = data[`${c.id}.leads`];
    const vendasRow = data[`${c.id}.vendas`];
    const conv = data[`${c.id}.conversao`];
    for (let m = 0; m < 12; m++) {
      const lv = leadsRow.months[m] as number | null;
      const vd = vendasRow.months[m] as number | null;
      conv.months[m] = lv && lv > 0 ? (vd || 0) / lv : null;
    }
  }
  return data;
}

export async function buildTab(workspaceId: string, year: number, tab: string): Promise<TabData> {
  switch (tab) {
    case "geracao": return buildGeracao(workspaceId, year);
    case "planejamento": return buildPlanejamento(workspaceId, year);
    case "pagos": return buildPagos(workspaceId, year);
    case "insights":
    default: return buildInsights(workspaceId, year);
  }
}

export const COVERAGE: Record<string, string> = {
  insights: "Instagram · histórico importado (mensal). Semanas e período corrente entram com a integração ao vivo.",
  geracao: "Leads reais do CRM por fonte × produto (semanas reais pela data de entrada).",
  planejamento: "Conteúdo pautado no Calendário por canal e status (semanas reais pela data).",
  pagos: "Leads/vendas/receita reais do CRM por campanha. Investimento/CPL/CAC entram com a conexão de mídia paga.",
};
