// Especificação VISUAL da planilha anual (o "template tradicional" da Seahub portado 1:1).
// Só apresentação: seções (faixas), linhas (rótulo + tipo de célula). Os VALORES vêm do
// builder do servidor (lib/planilha/build.ts) chaveados pela MESMA row.key. Sem números aqui.
//
// Fonte de verdade: a planilha "Casinha do Marketing | Seahub 2026" (4 abas):
//   INSIDE ZUCK'S MIND · GERAÇÃO POR CANAIS · PLANEJAMENTO · PERFORMANCE DE CANAIS PAGOS

export type CellKind = "int" | "dec" | "pct" | "money" | "text";

export interface PRow {
  key: string; // chave estável (casa com o valor do builder)
  label: string;
  kind: CellKind;
  strong?: boolean; // linha de destaque (TOTAL)
  hint?: string;
}
export interface PSection {
  title: string; // faixa (header em vermelho)
  rows: PRow[];
}
export interface PTab {
  id: "insights" | "geracao" | "planejamento" | "pagos";
  label: string;
  sub?: string;
  // src indica de onde o builder tira os números (só documental — o builder decide de fato)
  sections: PSection[];
}

// ── índice de semana (0-3) a partir do dia do mês, na convenção da planilha (W1 1-7, W2 8-14, W3 15-21, W4 22+) ──
export const weekOfDay = (day: number): 0 | 1 | 2 | 3 => (day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3);

// ─────────────────────────────────────────────────────────────
// ABA 1 — INSIDE ZUCK'S MIND (Instagram, olhar profundo)
// ─────────────────────────────────────────────────────────────
const TAB_INSIGHTS: PTab = {
  id: "insights",
  label: "Insights",
  sub: "Inside Zuck's Mind · Instagram",
  sections: [
    {
      title: "PRODUÇÃO DE CONTEÚDO",
      rows: [
        { key: "posts", label: "Posts", kind: "int" },
        { key: "stories", label: "Stories", kind: "int" },
        { key: "reels", label: "Reels", kind: "int" },
        { key: "leads_direct", label: "Leads via direct", kind: "int" },
        { key: "cta_compra", label: "Execuções em CTA de compra", kind: "int" },
      ],
    },
    {
      title: "SEGUIDORES",
      rows: [
        { key: "seg_novos", label: "Seguidores novos", kind: "int" },
        { key: "seg_perdidos", label: "Deixaram de seguir", kind: "int" },
        { key: "seg_total", label: "Total de seguidores", kind: "int", strong: true, hint: "posição no fim do período" },
      ],
    },
    {
      title: "ALCANCE",
      rows: [
        { key: "visualizacoes", label: "Visualizações", kind: "int" },
        { key: "vis_seguidores", label: "Visualizações de seguidores", kind: "pct" },
        { key: "vis_nao_seguidores", label: "Visualizações de não seguidores", kind: "pct" },
        { key: "formato_vencedor_alcance", label: "Formato vencedor", kind: "text" },
        { key: "contas_alcancadas", label: "Contas alcançadas", kind: "int" },
        { key: "atividades_perfil", label: "Atividades no perfil", kind: "int" },
        { key: "visitas_site", label: "Visitas no site", kind: "int" },
      ],
    },
    {
      title: "ENGAJAMENTO",
      rows: [
        { key: "interacoes_conteudo", label: "Interações de conteúdo", kind: "int" },
        { key: "interacoes_seguidores", label: "Interações de seguidores", kind: "pct" },
        { key: "interacoes_nao_seguidores", label: "Interações de não seguidores", kind: "pct" },
        { key: "formato_vencedor_engaj", label: "Formato vencedor", kind: "text" },
        { key: "curtidas", label: "Curtidas", kind: "int" },
        { key: "comentarios", label: "Comentários", kind: "int" },
        { key: "salvos", label: "Salvos", kind: "int" },
        { key: "compartilhamento", label: "Compartilhamento", kind: "int" },
        { key: "repost", label: "Repost", kind: "int" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// ABA 2 — GERAÇÃO POR CANAIS (leads por FONTE × PRODUTO)
// ─────────────────────────────────────────────────────────────
// produtos (seções) e fontes (linhas). Chave = `${produtoId}.${fonteId}`.
export const GERACAO_PRODUTOS: { id: string; label: string }[] = [
  { id: "ev", label: "ESCRITÓRIO VIRTUAL" },
  { id: "salas_reuniao", label: "SALAS DE REUNIÃO" },
  { id: "auditorios", label: "AUDITÓRIOS" },
  { id: "salas_privativas", label: "SALAS PRIVATIVAS & COWORKING" },
  { id: "seabox", label: "SEABOX" },
  { id: "seaoffice", label: "SEAOFFICE" },
];
export const GERACAO_FONTES: { id: string; label: string }[] = [
  { id: "site", label: "Site" },
  { id: "loja", label: "Loja" },
  { id: "parceria", label: "Programa de Parceria" },
  { id: "organico", label: "Orgânico" },
  { id: "indicacao", label: "Indicação" },
  { id: "redes", label: "Redes sociais" },
  { id: "cliente_ativo", label: "Cliente ativo" },
  { id: "prospeccao", label: "Prospecção" },
  { id: "eventos", label: "Eventos" },
  { id: "comunidade", label: "Comunidade" },
  { id: "lead_perdido", label: "Lead perdido" },
  { id: "transmissao", label: "Lista de transmissão" },
];
const TAB_GERACAO: PTab = {
  id: "geracao",
  label: "Geração por Canais",
  sub: "Leads por fonte × produto",
  sections: GERACAO_PRODUTOS.map((p) => ({
    title: p.label,
    rows: [
      ...GERACAO_FONTES.map((f) => ({ key: `${p.id}.${f.id}`, label: f.label, kind: "int" as CellKind })),
      { key: `${p.id}.total`, label: "TOTAL DA SEMANA", kind: "int" as CellKind, strong: true },
    ],
  })),
};

// ─────────────────────────────────────────────────────────────
// ABA 3 — PLANEJAMENTO (produção planejada por canal — espelha o Calendário)
// ─────────────────────────────────────────────────────────────
// A planilha original é editorial (roteiros). No espelho automático mostramos o
// PLANEJADO por canal (do Calendário) — posts pautados/publicados no período.
export const PLANEJ_CANAIS: { id: string; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X / Twitter" },
  { id: "threads", label: "Threads" },
  { id: "googlebusiness", label: "Google Business" },
];
const TAB_PLANEJAMENTO: PTab = {
  id: "planejamento",
  label: "Planejamento",
  sub: "Conteúdo pautado por canal (Calendário)",
  sections: [
    {
      title: "CONTEÚDO PLANEJADO",
      rows: [
        ...PLANEJ_CANAIS.map((c) => ({ key: `plan.${c.id}`, label: c.label, kind: "int" as CellKind })),
        { key: "plan.total", label: "TOTAL PAUTADO", kind: "int" as CellKind, strong: true },
      ],
    },
    {
      title: "STATUS",
      rows: [
        { key: "plan.publicado", label: "Publicados", kind: "int" },
        { key: "plan.agendado", label: "Agendados", kind: "int" },
        { key: "plan.rascunho", label: "Rascunhos / pendentes", kind: "int" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// ABA 4 — PERFORMANCE DE CANAIS PAGOS (campanha × métrica)
// ─────────────────────────────────────────────────────────────
export const PAGOS_CAMPANHAS: { id: string; label: string; plat: "google" | "meta" | "parceria" }[] = [
  { id: "google_ev", label: "GOOGLE ADS | EV", plat: "google" },
  { id: "parceria_ev", label: "PROGRAMA DE PARCERIA | EV", plat: "parceria" },
  { id: "meta_ev", label: "META ADS | EV", plat: "meta" },
  { id: "google_servicos", label: "GOOGLE ADS | SERVIÇOS DE ESPAÇO", plat: "google" },
  { id: "meta_servicos", label: "META ADS | SERVIÇOS DE ESPAÇO", plat: "meta" },
  { id: "google_privativas", label: "GOOGLE ADS | SALAS PRIVATIVAS", plat: "google" },
  { id: "meta_seabox", label: "META ADS | SEABOX", plat: "meta" },
  { id: "google_institucional", label: "GOOGLE ADS | INSTITUCIONAL (PESQUISA)", plat: "google" },
  { id: "google_yt", label: "GOOGLE ADS | YT — GERAÇÃO DE DEMANDA", plat: "google" },
  { id: "meta_privativas", label: "META ADS | SALAS PRIVATIVAS", plat: "meta" },
  { id: "meta_institucional", label: "META ADS | INSTITUCIONAL", plat: "meta" },
];
export const PAGOS_METRICAS: PRow[] = [
  { key: "leads", label: "Geração de leads", kind: "int" },
  { key: "vendas", label: "Vendas", kind: "int" },
  { key: "receita", label: "Receita", kind: "money" },
  { key: "investimento", label: "Investimento", kind: "money" },
  { key: "cpl", label: "CPL", kind: "money" },
  { key: "cac", label: "CAC", kind: "money" },
  { key: "conversao", label: "Taxa de conversão", kind: "pct" },
];
const TAB_PAGOS: PTab = {
  id: "pagos",
  label: "Canais Pagos",
  sub: "Google · Meta · Parceria",
  sections: PAGOS_CAMPANHAS.map((c) => ({
    title: c.label,
    rows: PAGOS_METRICAS.map((m) => ({ ...m, key: `${c.id}.${m.key}` })),
  })),
};

export const PLANILHA_TABS: PTab[] = [TAB_INSIGHTS, TAB_GERACAO, TAB_PLANEJAMENTO, TAB_PAGOS];
export const tabById = (id: string): PTab => PLANILHA_TABS.find((t) => t.id === id) ?? TAB_INSIGHTS;
