// Assistentes do Panteão — LLM real (server-only). NUNCA importar em client.
// Cada agente é uma LLM (via /api/agents/chat) com system prompt próprio + um bloco de
// CONTEXTO montado de fontes RÁPIDAS: banco (Prisma) + snapshot do que o painel JÁ
// carregou na tela do usuário. NÃO faz chamada de integração ao vivo aqui — isso evita
// timeout da função E evita invenção (o número do agente = o número que o painel mostra).
// Marca: sempre "LLM" na UI.
// TODO(agents): tool-calling p/ buscar dado sob demanda + relatório PDF server-side + edições como rascunho.
import type { Workspace } from "@prisma/client";
import { prisma } from "./prisma";
import { MONTHS_FULL, daysInMonth, weekRange, quarterOf, type Period, type Scope } from "./scope";

export type AgentKey = "poseidon" | "apollo" | "athena" | "dionisio";

interface AgentDef { nome: string; papel: string; system: string }

// conta conectada, enviada pelo client (já carregada no store) — sem custo de integração aqui
export interface AccountLite {
  platform: string; displayName?: string; username?: string;
  followersCount?: number; enabled?: boolean; adsStatus?: string;
}

const BASE_RULES = `
Você é um assistente da Casinha do Marketing — o painel/SO de marketing da agência.
Regras (CRITÉRIO É INEGOCIÁVEL — o cliente confia nesses números pra decidir):
- Responda SEMPRE em português do Brasil, tom claro, direto e acionável (estrategista sênior falando com o cliente).
- RASTREABILIDADE: todo número/valor que você citar TEM que aparecer LITERALMENTE no contexto abaixo. É PROIBIDO estimar, arredondar inventando, deduzir, extrapolar ou "preencher" valores que não estão no contexto. Não faça contas que dependam de dados ausentes.
- Se um dado NÃO estiver no contexto, diga explicitamente que ainda não tem esse número conectado — NUNCA invente. É melhor dizer "não tenho esse dado conectado aqui" do que chutar.
- Priorize o bloco "O QUE O USUÁRIO ESTÁ VENDO NO PAINEL" como fonte primária dos números — é o que está na tela dele.
- Não afirme causa/efeito sem base nos dados. Recomendações podem ser qualitativas; números, não.
- Seja conciso: comece pela conclusão, depois o porquê. Poucos parágrafos ou lista curta. Markdown simples (títulos, negrito, listas).
- Ao citar um número, diga o período. Sugira 1–2 próximos passos concretos quando fizer sentido.
- Você é uma LLM integrada ao painel. Nunca cite nomes de ferramentas/APIs externas de integração.`;

export const AGENTS: Record<AgentKey, AgentDef> = {
  poseidon: {
    nome: "Poseidon", papel: "Dados & mídia paga",
    system: `${BASE_RULES}

Seu papel (Poseidon): dados de desempenho e mídia paga. Analise performance, alcance, frequência, ROAS, custo por resultado e eficiência de investimento — SEMPRE a partir dos números do painel/contexto. Se o investimento ou os resultados não estiverem no contexto, diga que ainda não estão conectados aqui (não invente valor de mídia paga).`,
  },
  apollo: {
    nome: "Apollo", papel: "Conteúdo & canais",
    system: `${BASE_RULES}

Seu papel (Apollo): conteúdo e calendário editorial. Conhece os canais conectados e o que está agendado/publicado. Ajude com pautas, roteiros, legendas, CTAs e cadência. Quando pedirem conteúdo, escreva de fato (pronto pra usar).`,
  },
  athena: {
    nome: "Athena", papel: "Metas & OKR",
    system: `${BASE_RULES}

Seu papel (Athena): metas e OKR. Acompanha objetivo, áreas e KRs (alvo x realizado). Avalie progresso, aponte o que está no ritmo e o que está atrasado, recomende prioridades.`,
  },
  dionisio: {
    nome: "Dionísio", papel: "Persona & público",
    system: `${BASE_RULES}

Seu papel (Dionísio): público, personas e CRM. Conhece as personas cadastradas e os leads/oportunidades (canal, produto, status, motivo de perda, valor). Ajude a entender quem converte, gargalos do funil, segmentos pra reativar e como falar com cada persona.`,
  },
};

// ── período (Scope) → rótulo legível ─────────────────────────────────────────
function periodLabel(s: Scope): string {
  const { period, year, month, week, quarter } = s;
  if (period === "semana") { const [d1, d2] = weekRange(year, month, week).split("–"); return `Semana ${week + 1} (${d1}–${d2} de ${MONTHS_FULL[month]} ${year})`; }
  if (period === "trimestre") return `${(quarter ?? quarterOf(month)) + 1}º trimestre de ${year}`;
  if (period === "ano") return `Ano de ${year}`;
  return `${MONTHS_FULL[month]} de ${year}`;
}
function isoRange(s: Scope): { since: string; until: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const { period, year, month, week, quarter } = s;
  let start: Date, end: Date;
  if (period === "semana") { const [d1, d2] = weekRange(year, month, week).split("–").map(Number); start = new Date(year, month, d1); end = new Date(year, month, d2); }
  else if (period === "trimestre") { const q = quarter ?? quarterOf(month); start = new Date(year, q * 3, 1); end = new Date(year, q * 3 + 2, daysInMonth(year, q * 3 + 2)); }
  else if (period === "ano") { start = new Date(year, 0, 1); end = new Date(year, 11, 31); }
  else { start = new Date(year, month, 1); end = new Date(year, month, daysInMonth(year, month)); }
  return { since: iso(start), until: iso(end) };
}

const nBR = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const money = (v: number) => "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const ADS_ONLY = new Set(["metaads", "googleads", "linkedinads", "tiktokads", "pinterestads", "snapchatads"]);

// ── perfil (comum) ───────────────────────────────────────────────────────────
async function perfilBlock(ws: Workspace): Promise<string> {
  const p = await prisma.perfil.findUnique({ where: { workspaceId: ws.id } }).catch(() => null);
  if (!p) return `Empresa: ${ws.nome}.`;
  return [
    p.empresa && `Empresa: ${p.empresa}`,
    p.segmento && `Segmento: ${p.segmento}`,
    p.cidade && `Cidade: ${p.cidade}`,
    p.produtos?.length && `Produtos/serviços: ${p.produtos.join(", ")}`,
  ].filter(Boolean).join(". ") + ".";
}

// contas conectadas (vindas do client — sem chamada de integração)
function accountsBlock(accounts: AccountLite[]): string {
  if (!accounts.length) return "Nenhuma conta conectada ainda (ou o painel ainda não carregou).";
  const social = accounts.filter((a) => !ADS_ONLY.has(a.platform));
  const ads = accounts.filter((a) => a.adsStatus === "connected" || a.adsStatus === "active" || ADS_ONLY.has(a.platform));
  const lines = social.map((a) => {
    const nome = a.displayName || a.username || a.platform;
    return `- ${nome} (${a.platform})${a.followersCount != null ? ` · ${nBR(num(a.followersCount))} seguidores` : ""}`;
  });
  const out = [`CANAIS CONECTADOS (${social.length}):`, ...(lines.length ? lines : ["- (nenhum)"])];
  if (ads.length) out.push(`Contas com mídia paga conectada: ${ads.map((a) => a.displayName || a.platform).join(", ")}.`);
  return out.join("\n");
}

// ── Poseidon: contas + dados manuais de campanha (Prisma) — SEM mídia ao vivo ──
async function poseidonBlock(ws: Workspace, accounts: AccountLite[]): Promise<string> {
  const cfg = await prisma.envConfig.findUnique({ where: { workspaceId: ws.id } }).catch(() => null);
  const manual = (cfg?.adConfig as { manualCampaigns?: { vendas?: number; receita?: number; leadsQualificados?: number; campaignName?: string }[] } | null)?.manualCampaigns || [];
  const receita = manual.reduce((s, c) => s + num(c.receita), 0);
  const vendas = manual.reduce((s, c) => s + num(c.vendas), 0);
  const out = [accountsBlock(accounts)];
  if (receita || vendas) out.push(`\nDADOS MANUAIS de campanha informados: ${nBR(vendas)} vendas · Receita ${money(receita)}.`);
  out.push("\nNúmeros de mídia paga ao vivo (investimento/alcance/resultados) vêm do bloco do painel abaixo, quando presente. Se não estiverem lá, não invente — diga que ainda não estão carregados aqui.");
  return out.join("\n");
}

// ── Apollo: calendário (Prisma) + canais (client) ────────────────────────────
async function apolloBlock(ws: Workspace, r: { since: string; until: string }, accounts: AccountLite[]): Promise<string> {
  const posts = await prisma.post.findMany({
    where: { workspaceId: ws.id, data: { gte: new Date(r.since), lte: new Date(r.until + "T23:59:59") } },
    orderBy: { data: "asc" },
  }).catch(() => []);
  const byStatus: Record<string, number> = {};
  const byCanal: Record<string, number> = {};
  for (const p of posts) { byStatus[p.status] = (byStatus[p.status] || 0) + 1; byCanal[p.canal] = (byCanal[p.canal] || 0) + 1; }
  const proximos = posts.filter((p) => p.status === "agendado" || p.status === "rascunho").slice(0, 8)
    .map((p) => `- ${p.data.toLocaleDateString("pt-BR")} ${p.hora} · ${p.canal} · "${p.titulo}"${p.formato ? ` (${p.formato})` : ""}`);
  const out = [accountsBlock(accounts)];
  out.push(`\nCALENDÁRIO no período (${posts.length} posts): ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(", ") || "vazio"}.`);
  if (Object.keys(byCanal).length) out.push(`Por canal: ${Object.entries(byCanal).map(([k, v]) => `${k}: ${v}`).join(", ")}.`);
  if (proximos.length) out.push(`PRÓXIMOS/RASCUNHOS:\n${proximos.join("\n")}`);
  return out.join("\n");
}

// ── Athena: OKR (Prisma) ─────────────────────────────────────────────────────
async function athenaBlock(ws: Workspace): Promise<string> {
  const [obj, areas] = await Promise.all([
    prisma.objetivo.findUnique({ where: { workspaceId: ws.id } }).catch(() => null),
    prisma.area.findMany({ where: { workspaceId: ws.id }, orderBy: { ordem: "asc" }, include: { krs: { orderBy: { ordem: "asc" } } } }).catch(() => []),
  ]);
  const out = [`OBJETIVO: ${obj?.texto || "(não definido)"}.`];
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

// ── Dionísio: personas + leads/CRM (Prisma) ──────────────────────────────────
async function dionisioBlock(ws: Workspace): Promise<string> {
  const [personas, leads] = await Promise.all([
    prisma.persona.findMany({ where: { workspaceId: ws.id }, orderBy: { ordem: "asc" } }).catch(() => []),
    prisma.lead.findMany({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, take: 500 }).catch(() => []),
  ]);
  const out = ["PERSONAS:"];
  if (personas.length) {
    for (const p of personas.slice(0, 8)) {
      const d = (p.detalhes as { consome?: string[] } | null) || {};
      const bits = [p.representa && `representa: ${p.representa}`, p.canais && `canais: ${p.canais}`, p.dores?.length && `dores: ${p.dores.join("; ")}`, d.consome?.length && `consome: ${d.consome.join(", ")}`].filter(Boolean);
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

// snapshot do painel (o que o usuário está vendo agora) — fonte primária dos números ao vivo
function panelBlock(panel: unknown): string {
  if (!panel) return "";
  let s = "";
  try { s = typeof panel === "string" ? panel : JSON.stringify(panel); } catch { s = ""; }
  if (!s || s === "{}" || s === "null") return "";
  if (s.length > 4500) s = s.slice(0, 4500) + " …(truncado)";
  return `\n=== O QUE O USUÁRIO ESTÁ VENDO NO PAINEL AGORA (fonte primária dos números ao vivo) ===\n${s}\n=== FIM DO PAINEL ===`;
}

export async function buildContext(
  agentKey: AgentKey, ws: Workspace, scope: Scope,
  opts?: { accounts?: AccountLite[]; panel?: unknown }
): Promise<string> {
  const accounts = opts?.accounts || [];
  const r = isoRange(scope);
  const perfil = await perfilBlock(ws).catch(() => `Empresa: ${ws.nome}.`);
  let body = "";
  try {
    if (agentKey === "poseidon") body = await poseidonBlock(ws, accounts);
    else if (agentKey === "apollo") body = await apolloBlock(ws, r, accounts);
    else if (agentKey === "athena") body = await athenaBlock(ws);
    else if (agentKey === "dionisio") body = await dionisioBlock(ws);
  } catch (e) {
    body = `(falha ao carregar dados do banco: ${String(e).slice(0, 120)})`;
  }
  return `PERÍODO ANALISADO: ${periodLabel(scope)}.\nPERFIL: ${perfil}\n\n${body}${panelBlock(opts?.panel)}`;
}

// normaliza o Scope recebido do client
export function normalizeScope(s: { period?: string; year?: number; month?: number; week?: number; quarter?: number } | undefined): Scope {
  const now = new Date();
  const period = (["semana", "mes", "trimestre", "ano"].includes(String(s?.period)) ? s!.period : "mes") as Period;
  const year = Number.isFinite(Number(s?.year)) ? Number(s!.year) : now.getFullYear();
  const month = Number.isFinite(Number(s?.month)) ? Number(s!.month) : now.getMonth();
  const week = Number.isFinite(Number(s?.week)) ? Number(s!.week) : 0;
  const quarter = Number.isFinite(Number(s?.quarter)) ? Number(s!.quarter) : quarterOf(month);
  return { period, year, month, week, quarter };
}
