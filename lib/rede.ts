// Identidade de rede: id da Casinha ↔ plataforma do provedor.
// Só "x" diverge (provedor chama de twitter). O resto é 1:1.
// Sem I/O — pode ser importado no cliente e no servidor.

const REDE_TO_PLAT: Record<string, string> = { x: "twitter" };
const PLAT_TO_REDE: Record<string, string> = { twitter: "x" };

/** id da Casinha (ou já a plataforma) → plataforma do provedor. */
export function platOf(redeOrPlat: string): string {
  return REDE_TO_PLAT[redeOrPlat] || redeOrPlat;
}

/** plataforma do provedor (ou já o id da Casinha) → id da Casinha. */
export function redeOf(platOrRede: string): string {
  return PLAT_TO_REDE[platOrRede] || platOrRede;
}
