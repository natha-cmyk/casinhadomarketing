// Especificação VISUAL da planilha anual (o "template tradicional" da Seahub portado 1:1).
// Só apresentação: seções (faixas), linhas (rótulo + tipo de célula). Os VALORES vêm do
// builder do servidor (lib/planilha/build.ts) chaveados pela MESMA row.key. Sem números aqui.
//
// Fonte de verdade: a planilha "Casinha do Marketing | Seahub" (3 abas replicadas):
//   INSIDE ZUCK'S MIND · GERAÇÃO POR CANAIS · PERFORMANCE DE CANAIS PAGOS

export type CellKind = "int" | "dec" | "pct" | "money" | "text";

export interface PRow {
  key: string; // chave estável (casa com o valor do builder e da célula histórica)
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
  id: "insights" | "geracao" | "pagos";
  label: string;
  sub?: string;
  weekly: boolean; // true = colunas mês×(W1-W4+TOTAL); false = só mês (Canais Pagos)
  sections: PSection[];
}

// ── índice de semana (0-3) a partir do dia do mês (W1 1-7, W2 8-14, W3 15-21, W4 22+) ──
export const weekOfDay = (day: number): 0 | 1 | 2 | 3 => (day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3);

// ─────────────────────────────────────────────────────────────
// ABA 1 — INSIDE ZUCK'S MIND (Instagram, olhar profundo) — semanal
// Estrutura FIEL à planilha: Produção · Seguidores · Alcance (+ orgânico) ·
// Engajamento (+ orgânico) · Performance de Meta Ads · Métricas de Performance ·
// e o rodapé mensal (Indicadores · Meta Ads · Desempenho Social).
// ─────────────────────────────────────────────────────────────
const TAB_INSIGHTS: PTab = {
  id: "insights",
  label: "Insights",
  sub: "Inside Zuck's Mind · Instagram",
  weekly: true,
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
        { key: "rendimento_organico_alcance", label: "Rendimento orgânico", kind: "pct" },
        { key: "visualizacoes_org", label: "Visualizações (orgânico)", kind: "dec" },
        { key: "contas_alcancadas_org", label: "Contas alcançadas (orgânico)", kind: "dec" },
        { key: "atividades_perfil_org", label: "Atividades no perfil (orgânico)", kind: "dec" },
        { key: "visitas_site_org", label: "Visitas no site (orgânico)", kind: "dec" },
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
        { key: "rendimento_organico_engaj", label: "Rendimento orgânico", kind: "pct" },
        { key: "interacoes_conteudo_org", label: "Interações de conteúdo (orgânico)", kind: "dec" },
        { key: "curtidas_org", label: "Curtidas (orgânico)", kind: "dec" },
        { key: "comentarios_org", label: "Comentários (orgânico)", kind: "dec" },
        { key: "salvos_org", label: "Salvos (orgânico)", kind: "dec" },
        { key: "compartilhamento_org", label: "Compartilhamento (orgânico)", kind: "dec" },
        { key: "repost_org", label: "Repost (orgânico)", kind: "dec" },
      ],
    },
    {
      title: "PERFORMANCE DE META ADS",
      rows: [
        { key: "ma_investimento", label: "Investimento", kind: "money" },
        { key: "ma_campanhas", label: "Campanhas ativas", kind: "int" },
        { key: "ma_leads", label: "Geração de leads", kind: "int" },
        { key: "ma_vendas", label: "Vendas", kind: "int" },
        { key: "ma_faturamento", label: "Faturamento", kind: "money" },
        { key: "ma_roas", label: "ROAS", kind: "pct" },
        { key: "ma_cpm", label: "CPM", kind: "money" },
        { key: "ma_cpl", label: "CPL", kind: "money" },
        { key: "ma_cac", label: "CAC", kind: "money" },
      ],
    },
    {
      title: "MÉTRICAS DE PERFORMANCE",
      rows: [
        { key: "mp_leads_semana", label: "Geração de leads na semana", kind: "int" },
        { key: "mp_custo_lead", label: "Custo lead por real investido", kind: "money" },
        { key: "mp_leads_conteudo", label: "Geração de leads por conteúdo construído", kind: "dec" },
        { key: "mp_vendas_social", label: "Vendas via social", kind: "int" },
        { key: "mp_faturamento_social", label: "Faturamento via social", kind: "money" },
        { key: "mp_taxa_conversao", label: "Taxa de conversão", kind: "pct" },
      ],
    },
    {
      title: "INDICADORES (resumo mensal)",
      rows: [
        { key: "ind_contas_alcancadas", label: "Contas alcançadas", kind: "int" },
        { key: "ind_visualizacoes", label: "Visualizações", kind: "int" },
        { key: "ind_seguidores", label: "Seguidores", kind: "int" },
        { key: "ind_atividades", label: "Atividades no perfil", kind: "int" },
        { key: "ind_visitas_link", label: "Visitas no link", kind: "int" },
        { key: "ind_leads_direct", label: "Leads direct", kind: "int" },
        { key: "ind_cta_compra", label: "CTA compra", kind: "int" },
        { key: "ind_total_leads", label: "Total leads", kind: "int", strong: true },
      ],
    },
    {
      title: "META ADS (resumo mensal)",
      rows: [
        { key: "mam_investimento", label: "Investimento", kind: "money" },
        { key: "mam_cpm", label: "CPM", kind: "money" },
        { key: "mam_cpl", label: "CPL", kind: "money" },
        { key: "mam_leads", label: "Leads ads", kind: "int" },
        { key: "mam_vendas", label: "Vendas", kind: "int" },
        { key: "mam_faturamento", label: "Faturamento ads", kind: "money" },
      ],
    },
    {
      title: "DESEMPENHO SOCIAL",
      rows: [{ key: "ds_faturamento_social", label: "Faturamento social", kind: "money", strong: true }],
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// ABA 2 — GERAÇÃO POR CANAIS (leads por FONTE × PRODUTO) — semanal
// ─────────────────────────────────────────────────────────────
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
  weekly: true,
  sections: GERACAO_PRODUTOS.map((p) => ({
    title: p.label,
    rows: [
      ...GERACAO_FONTES.map((f) => ({ key: `${p.id}.${f.id}`, label: f.label, kind: "int" as CellKind })),
      { key: `${p.id}.total`, label: "TOTAL DA SEMANA", kind: "int" as CellKind, strong: true },
    ],
  })),
};

// ─────────────────────────────────────────────────────────────
// ABA 3 — PERFORMANCE DE CANAIS PAGOS (campanha × métrica) — MENSAL
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
  weekly: false,
  sections: PAGOS_CAMPANHAS.map((c) => ({
    title: c.label,
    rows: PAGOS_METRICAS.map((m) => ({ ...m, key: `${c.id}.${m.key}` })),
  })),
};

export const PLANILHA_TABS: PTab[] = [TAB_INSIGHTS, TAB_GERACAO, TAB_PAGOS];
export const tabById = (id: string): PTab => PLANILHA_TABS.find((t) => t.id === id) ?? TAB_INSIGHTS;
