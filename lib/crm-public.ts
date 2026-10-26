// O que a tela de Geração pode ver. O token do ClickUp não volta no JSON.

export function toPublicCrmConfig<T extends { clickupToken?: string | null }>(
  row: T | null,
): (Omit<T, "clickupToken"> & { hasClickupToken: boolean }) | null {
  if (!row) return null;
  const { clickupToken, ...rest } = row;
  return { ...rest, hasClickupToken: Boolean(clickupToken && String(clickupToken).trim()) };
}

/**
 * Token no PUT:
 * - string com conteúdo → substitui
 * - null → apaga
 * - ausente ou vazio → mantém o que já está salvo (a tela não recebe o token de volta)
 */
export function nextClickupToken(incoming: unknown, existing: string | null | undefined): string | null {
  if (incoming === null) return null;
  if (typeof incoming === "string" && incoming.trim()) return incoming.trim();
  const kept = existing?.trim() ?? "";
  return kept || null;
}
