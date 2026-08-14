// Assistentes do Panteão — LLM real (server-only). NUNCA importar em client.
// Cada agente é uma LLM (Claude via @anthropic-ai/sdk) com um system prompt próprio
// e um bloco de CONTEXTO montado a partir dos dados REAIS do workspace (Prisma + Zernio),
// escopado pelo período da toolbar. Marca: sempre "LLM" na UI (nunca nome de rede externa).
// TODO(agents): evoluir de contexto injetado → tool-calling nas nossas APIs (streaming de
//   ferramentas) + geração de relatório (PDF/DOCX) + edições como rascunho que o usuário confirma.
import type { Workspace } from "@prisma/client";
import { prisma } from "./prisma";
import {
  MONTHS_FULL, daysInMonth, weekRange, quarterOf, type Period, type Scope,
} from "./scope";
import {
  listAccounts, accountInsightsFull, youtubeChannelInsights, linkedinAggregate,
  gbpPerformance, postAnalytics, listAdAccounts, adsInsights,
  type ZernioAccount, type AdInsightRow,
} from "./zernio";

export type AgentKey = "poseidon" | "apollo" | "athena" | "dionisio";

interface AgentDef { nome: string; papel: string; system: string }

const BASE_RULES = `
Você é um assistente da Casinha do Marketing — o painel/SO de marketing da agência.
Regras:
- Responda SEMPRE em português do Brasil, tom claro, direto e acionável (como um estrategista sênior falando com o cliente).
- Baseie-se EXCLUSIVAMENTE nos dados de contexto fornecidos abaixo. Se um dado não estiver no contexto, diga que ainda não tem esse número conectado — nunca invente valores.
- Seja conciso: comece pela conclusão, depois o porquê. Use no máximo poucos parágrafos ou uma lista curta.
- Ao citar um número, contextualize (período, comparação) quando o dado permitir.
- Quando fizer sentido, sugira 1–2 próximos passos concretos.
- Você é uma LLM integrada ao painel. Nunca cite nomes de ferramentas/APIs externas de integração.`;

export const AGENTS: Record<AgentKey, AgentDef> = {
  poseidon: {
    nome: "Poseidon",
    papel: "Dados & mídia paga",
    system: `${BASE_RULES}

Seu papel (Poseidon): dados de desempenho e mídia paga. Você lê os painéis sociais e as contas de anúncio. Domine performance, alcance, frequência, ROAS, custo por conversa/resultado e eficiência de investimento. Aponte onde o dinheiro rende mais e onde há desperdício.`,
  },
  apollo: {
    nome: "Apollo",
    papel: "Conteúdo & canais",
    system: `${BASE_RULES}

Seu papel (Apollo): conteúdo e calendário editorial. Você conhece os canais conectados, o que está agendado/publicado e a produção por rede. Ajude com pautas, roteiros, legendas, CTAs e cadência de publicação. Quando pedirem conteúdo, escreva de fato (pronto pra usar).`,
  },
  athena: {
    nome: "Athena",
    papel: "Metas & OKR",
    system: `${BASE_RULES}

Seu papel (Athena): metas e OKR. Você acompanha objetivo, áreas e KRs (alvo x realizado). Avalie progresso, aponte o que está no ritmo e o que está atrasado, e recomende prioridades pra destravar os resultados do período.`,
  },
  dionisio: {
    nome: "Dionísio",
    papel: "Persona & público",
    system: `${BASE_RULES}

Seu papel (Dionísio): público, personas e CRM. Você conhece as personas cadastradas e os leads/oportunidades (canal, produto, status, motivo de perda, valor). Ajude a entender quem converte, gargalos do funil, segmentos pra reativar e como falar com cada persona.`,
  },
};

// ── período (Scope) → intervalo ISO (since/until), limitado a hoje ────────────
function isoRange(s: Scope): { since: string; until: string; label: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const cap = (d: Date) => (d > today ? today : d);
  const { period, year, month, week, quarter } = s;
  let start: Date, end: Date, label: string;
  if (period === "semana") {
    const [d1, d2] = weekRange(year, month, week).split("–").map(Number);
    start = new Date(year, month, d1);
    end = new Date(year, month, d2);
    label = `Semana ${week + 1} (${d1}–${d2} de ${MONTHS_FULL[month]} ${year})`;
  } else if (period === "trimestre") {
    const q = quarter ?? quarterOf(month);
    start = new Date(year, q * 3, 1);
    end = new Date(year, q * 3 + 2, daysInMonth(year, q * 3 + 2));
    label = `${q + 1}º trimestre de ${year}`;
  } else if (period === "ano") {
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31);
    label = `Ano de ${year}`;
  } else {
    start = new Date(year, month, 1);
    end = new Date(year, month, daysInMonth(year, month));
    label = `${MONTHS_FULL[month]} de ${year}`;
  }
  return { since: iso(start), until: iso(cap(end)), label };
}

const nBR = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const money = (v: number) => "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// achata {k:{total}}|{k:number} → {k:number}
function flat(raw?: Record<string, { total?: number } | number> | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    const t = typeof v === "number" ? v : num((v as { total?: number })?.total);
    if (Number.isFinite(t)) out[k] = t;
  }
  return out;
}

const ADS_ONLY = new Set(["metaads", "googleads", "linkedinads", "tiktokads", "pinterestads", "snapchatads"]);
const IG_LIKE = new Set(["instagram", "facebook", "tiktok", "twitter"]);
const RESULT_ACTIONS = new Set(["lead", "onsite_conversion.messaging_conversation_started_7d", "purchase", "offsite_conversion.fb_pixel_lead"]);

// soma os resultados (lead/conversa/compra) das linhas de insight de anúncio
function adResults(rows: AdInsightRow[]): number {
  let r = 0;
  for (const row of rows) for (const a of row.actions || []) if (RESULT_ACTIONS.has(a.action_type)) r += num(a.value);
  return r;
}

// ── contexto: Perfil (comum a todos) ─────────────────────────────────────────
async function perfilBlock(ws: Workspace): Promise<string> {
  const p = await prisma.perfil.findUnique({ where: { workspaceId: ws.id } }).catch(() => null);
  if (!p) return `Empresa: ${ws.nome}.`;
  const parts = [
    p.empresa && `Empresa: ${p.empresa}`,
    p.segmento && `Segmento: ${p.segmento}`,
    p.cidade && `Cidade: ${p.cidade}`,
    p.produtos?.length && `Produtos/serviços: ${p.produtos.join(", ")}`,
  ].filter(Boolean);
  return parts.join(". ") + ".";
}

// ── Poseidon: contas sociais (alcance/seguidores) + mídia paga (gasto/resultado) ──
async function poseidonBlock(ws: Workspace, r: { since: string; until: string }): Promise<string> {
  if (!ws.zernioProfileId) return "Nenhuma conta conectada ainda.";
  let accounts: ZernioAccount[] = [];
  try { accounts = (await listAccounts(ws.zernioProfileId)).accounts; } catch { /* segue vazio */ }
  const social = accounts.filter((a) => !ADS_ONLY.has(String(a.platform)) && (a.enabled === true || (a as Record<string, unknown>).analyticsEnabled === true));

  // desempenho social (alcance/interações) — best-effort, limitado
  const socialLines: string[] = [];
  await Promise.all(
    social.slice(0, 6).map(async (a) => {
      const plat = String(a.platform);
      let m: Record<string, number> = {};
      try {
        if (plat === "youtube") m = flat((await youtubeChannelInsights(a._id, r)).metrics);
        else if (plat === "linkedin") m = flat((await linkedinAggregate(a._id, r)).analytics);
        else if (plat === "googlebusiness") m = flat((await gbpPerformance(a._id, { fromDate: r.since, toDate: r.until })).metrics);
        else if (IG_LIKE.has(plat)) m = flat((await accountInsightsFull(plat, a._id, r)).metrics);
      } catch { /* ignora conta que falhou */ }
      const nome = a.displayName || (a as Record<string, unknown>).username as string || plat;
      const bits = [
        a.followersCount != null && `${nBR(num(a.followersCount))} seguidores`,
        m.reach != null && `alcance ${nBR(m.reach)}`,
        m.views != null && `${nBR(m.views)} views`,
        m.total_interactions != null && `${nBR(m.total_interactions)} interações`,
      ].filter(Boolean);
      socialLines.push(`- ${nome} (${plat}): ${bits.join(", ") || "sem métricas no período"}`);
    })
  );

  // mídia paga: por conta social, agrega insights das ad accounts (nível conta)
  let spend = 0, reach = 0, impressions = 0, clicks = 0, results = 0;
  let hasAds = false;
  await Promise.all(
    accounts.slice(0, 8).map(async (a) => {
      try {
        const { accounts: adAccts } = await listAdAccounts(a._id);
        for (const ad of (adAccts || []).slice(0, 4)) {
          const ins = await adsInsights(a._id, ad.id, { since: r.since, until: r.until, level: "account" });
          for (const row of ins.data || []) {
            hasAds = true;
            spend += num(row.spend); reach += num(row.reach); impressions += num(row.impressions);
            clicks += num(row.clicks);
          }
          results += adResults(ins.data || []);
        }
      } catch { /* conta sem ads ou falha */ }
    })
  );

  // dados manuais de campanha (vendas/receita que a mídia não entrega)
  const cfg = await prisma.envConfig.findUnique({ where: { workspaceId: ws.id } }).catch(() => null);
  const manual = (cfg?.adConfig as { manualCampaigns?: { vendas?: number; receita?: number; campanha?: string }[] } | null)?.manualCampaigns || [];
  const receita = manual.reduce((s, c) => s + num(c.receita), 0);
  const vendas = manual.reduce((s, c) => s + num(c.vendas), 0);

  const out: string[] = [];
  out.push("CANAIS SOCIAIS:");
  out.push(socialLines.length ? socialLines.join("\n") : "- (sem contas sociais conectadas)");
  if (hasAds) {
    const cpr = results ? spend / results : null;
    out.push("\nMÍDIA PAGA (nível conta, período):");
    out.push(`- Investimento: ${money(spend)} · Alcance: ${nBR(reach)} · Impressões: ${nBR(impressions)} · Cliques: ${nBR(clicks)}`);
    out.push(`- Resultados (leads/conversas/compras): ${nBR(results)}${cpr != null ? ` · Custo por resultado: ${money(cpr)}` : ""}`);
  } else {
    out.push("\nMÍDIA PAGA: nenhuma conta de anúncio conectada (ou sem dados no período).");
  }
  if (receita || vendas) {
    const roas = spend ? receita / spend : null;
    out.push(`\nDADOS MANUAIS informados: ${nBR(vendas)} vendas · Receita ${money(receita)}${roas != null ? ` · ROAS ${roas.toFixed(2)}` : ""}.`);
  }
  return out.join("\n");
}

// ── Apollo: calendário (agendado/publicado) + canais + produção de conteúdo ──
async function apolloBlock(ws: Workspace, r: { since: string; until: string }): Promise<string> {
  const posts = await prisma.post.findMany({
    where: { workspaceId: ws.id, data: { gte: new Date(r.since), lte: new Date(r.until + "T23:59:59") } },
    orderBy: { data: "asc" },
  }).catch(() => []);

  const byStatus: Record<string, number> = {};
  const byCanal: Record<string, number> = {};
  for (const p of posts) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    byCanal[p.canal] = (byCanal[p.canal] || 0) + 1;
  }
  const proximos = posts
    .filter((p) => p.status === "agendado" || p.status === "rascunho")
    .slice(0, 8)
    .map((p) => `- ${p.data.toLocaleDateString("pt-BR")} ${p.hora} · ${p.canal} · "${p.titulo}"${p.formato ? ` (${p.formato})` : ""}`);

  // canais conectados
  let canais: string[] = [];
  if (ws.zernioProfileId) {
    try {
      const { accounts } = await listAccounts(ws.zernioProfileId);
      canais = accounts.filter((a) => a.enabled === true).map((a) => `${a.displayName || a.platform} (${a.platform})`);
    } catch { /* ignora */ }
  }

  const out: string[] = [];
  out.push(`CANAIS CONECTADOS: ${canais.length ? canais.join(", ") : "nenhum ainda"}.`);
  out.push(`CALENDÁRIO no período (${posts.length} posts): ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(", ") || "vazio"}.`);
  if (Object.keys(byCanal).length) out.push(`Distribuição por canal: ${Object.entries(byCanal).map(([k, v]) => `${k}: ${v}`).join(", ")}.`);
  if (proximos.length) out.push(`PRÓXIMOS/RASCUNHOS:\n${proximos.join("\n")}`);
  return out.join("\n");
}

// ── Athena: OKR (objetivo, áreas, KRs alvo x realizado) ──────────────────────
async function athenaBlock(ws: Workspace): Promise<string> {
  const [obj, areas] = await Promise.all([
    prisma.objetivo.findUnique({ where: { workspaceId: ws.id } }).catch(() => null),
    prisma.area.findMany({ where: { workspaceId: ws.id }, orderBy: { ordem: "asc" }, include: { krs: { orderBy: { ordem: "asc" } } } }).catch(() => []),
  ]);
  const out: string[] = [];
  out.push(`OBJETIVO: ${obj?.texto || "(não definido)"}.`);
  if (!areas.length) { out.push("Nenhuma área/KR cadastrado."); return out.join("\n"); }
  for (const a of areas) {
    out.push(`\nÁrea: ${a.nome}`);
    for (const k of a.krs) {
      const real = k.realizado != null && k.realizado !== "" ? k.realizado : "—";
      out.push(`  - ${k.kr}: realizado ${real} / alvo ${k.alvo || "—"} ${k.un || ""}${k.resp ? ` (resp: ${k.resp})` : ""}`.trimEnd());
    }
  }
  return out.join("\n");
}

// ── Dionísio: personas + leads/CRM (canal, produto, status, perda, valor) ────
async function dionisioBlock(ws: Workspace): Promise<string> {
  const [personas, leads] = await Promise.all([
    prisma.persona.findMany({ where: { workspaceId: ws.id }, orderBy: { ordem: "asc" } }).catch(() => []),
    prisma.lead.findMany({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, take: 500 }).catch(() => []),
  ]);

  const out: string[] = [];
  out.push("PERSONAS:");
  if (personas.length) {
    for (const p of personas.slice(0, 8)) {
      const d = (p.detalhes as { consome?: string[]; gosta?: string[] } | null) || {};
      const bits = [
        p.representa && `representa: ${p.representa}`,
        p.canais && `canais: ${p.canais}`,
        p.dores?.length && `dores: ${p.dores.join("; ")}`,
        d.consome?.length && `consome: ${d.consome.join(", ")}`,
      ].filter(Boolean);
      out.push(`- ${p.nome} (${p.tag})${bits.length ? ` — ${bits.join(" · ")}` : ""}`);
    }
  } else out.push("- nenhuma persona cadastrada.");

  out.push(`\nCRM — LEADS (${leads.length} recentes):`);
  if (leads.length) {
    const by = (f: (l: (typeof leads)[number]) => string | null | undefined) => {
      const m: Record<string, number> = {};
      for (const l of leads) { const k = f(l) || "—"; m[k] = (m[k] || 0) + 1; }
      return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ");
    };
    const valor = leads.reduce((s, l) => s + num(l.value), 0);
    out.push(`- Por canal: ${by((l) => l.channel)}`);
    out.push(`- Por status: ${by((l) => l.status)}`);
    out.push(`- Por produto: ${by((l) => l.product)}`);
    const perdas = Array.from(new Set(leads.filter((l) => l.lossReason).map((l) => l.lossReason as string)));
    if (perdas.length) out.push(`- Motivos de perda: ${perdas.slice(0, 6).join(", ")}`);
    if (valor) out.push(`- Valor total em oportunidades: ${money(valor)}.`);
  } else out.push("- nenhum lead sincronizado (conecte o CRM na aba Geração).");
  return out.join("\n");
}

// monta o bloco de CONTEXTO do agente (dados reais, escopados pelo período)
export async function buildContext(agentKey: AgentKey, ws: Workspace, scope: Scope): Promise<string> {
  const r = isoRange(scope);
  const perfil = await perfilBlock(ws).catch(() => `Empresa: ${ws.nome}.`);
  let body = "";
  try {
    if (agentKey === "poseidon") body = await poseidonBlock(ws, r);
    else if (agentKey === "apollo") body = await apolloBlock(ws, r);
    else if (agentKey === "athena") body = await athenaBlock(ws);
    else if (agentKey === "dionisio") body = await dionisioBlock(ws);
  } catch (e) {
    body = `(falha ao carregar alguns dados: ${String(e).slice(0, 120)})`;
  }
  return `PERÍODO ANALISADO: ${r.label}.\nPERFIL: ${perfil}\n\n${body}`;
}

// normaliza o Scope recebido do client (defaults seguros)
export function normalizeScope(s: { period?: string; year?: number; month?: number; week?: number; quarter?: number } | undefined): Scope {
  const now = new Date();
  const period = (["semana", "mes", "trimestre", "ano"].includes(String(s?.period)) ? s!.period : "mes") as Period;
  const year = Number.isFinite(Number(s?.year)) ? Number(s!.year) : now.getFullYear();
  const month = Number.isFinite(Number(s?.month)) ? Number(s!.month) : now.getMonth();
  const week = Number.isFinite(Number(s?.week)) ? Number(s!.week) : 0;
  const quarter = Number.isFinite(Number(s?.quarter)) ? Number(s!.quarter) : quarterOf(month);
  return { period, year, month, week, quarter };
}
