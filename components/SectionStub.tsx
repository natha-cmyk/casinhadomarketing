import { META } from "@/lib/nav";
import { PageHead, ScaffoldHero } from "./ui";

const DESC: Record<string, { eyebrow: string; desc: string }> = {
  overview: { eyebrow: "Visão geral", desc: "Resumo executivo do escopo selecionado: KPIs, gráficos por ano, redes e leitura rápida." },
  instagram: { eyebrow: "Canais", desc: "Performance do Instagram multi-perfil, seguidores, alcance e top conteúdos." },
  canais: { eyebrow: "Comercial", desc: "Geração de leads por produto e por canal de aquisição." },
  ads: { eyebrow: "Comercial", desc: "Investimento, receita, ROAS e CAC por canal × produto, seguindo o período." },
  metas: { eyebrow: "Comercial", desc: "OKR 2026 agrupado por áreas, com modo editor." },
  calendario: { eyebrow: "Operação", desc: "Calendário de conteúdo estilo mLabs: grid mensal, agendamentos e contas conectadas." },
  persona: { eyebrow: "Estratégia", desc: "Personas, receita por produto e insights estratégicos." },
  concorrencia: { eyebrow: "Estratégia", desc: "Grid de concorrentes por linha de negócio." },
  config: { eyebrow: "Configuração", desc: "Centro de controle: ambiente, redes & canais, indicadores e importação de dados." },
};

export function SectionStub({ view }: { view: string }) {
  const meta = META[view];
  const d = DESC[view] || { eyebrow: "Seahub", desc: "" };
  return (
    <>
      <PageHead eyebrow={d.eyebrow} title={meta?.title || meta?.label || "Seção"} desc={d.desc} />
      <ScaffoldHero icon={meta?.icon || "overview"} title={meta?.label || "Seção"} desc="Conteúdo desta tela é portado no Bloco 3 (painéis de leitura)." />
    </>
  );
}
