// Registry de provedores de CRM (arquitetura multi-CRM). ClickUp e Webhook estão ativos;
// os demais são o SEAM pra novos adapters — cada um traduz a API do provedor → Lead normalizado
// (mesma forma que lib/crm-sync faz pro ClickUp). Ativar um novo = implementar o adapter +
// as credenciais. Ver [[crm-interpretacao]] no roadmap.
export type CrmProviderId = "clickup" | "webhook" | "hubspot" | "rdstation" | "pipedrive" | "notion";

export interface CrmProvider {
  id: CrmProviderId;
  label: string;
  status: "ativo" | "em_breve";
  desc: string;
}

export const CRM_PROVIDERS: CrmProvider[] = [
  { id: "clickup", label: "ClickUp", status: "ativo", desc: "Token pessoal + List ID. Traz tasks como leads." },
  { id: "webhook", label: "Webhook / API", status: "ativo", desc: "URL de ingestão genérica — qualquer CRM manda eventos." },
  { id: "hubspot", label: "HubSpot", status: "em_breve", desc: "Adapter em construção — precisa da chave/app HubSpot." },
  { id: "rdstation", label: "RD Station", status: "em_breve", desc: "Adapter em construção — precisa do token RD." },
  { id: "pipedrive", label: "Pipedrive", status: "em_breve", desc: "Adapter em construção — precisa do API token." },
  { id: "notion", label: "Notion", status: "em_breve", desc: "Adapter em construção — precisa da integração Notion." },
];

export const crmProvider = (id: string) => CRM_PROVIDERS.find((p) => p.id === id);
export const isCrmActive = (id: string) => crmProvider(id)?.status === "ativo";
