// Conta do provedor pertence ao profile pedido?
// Se a resposta não traz profileId em nenhuma conta, a query já veio filtrada
// e a lista inteira fica (não esvazia o painel). Se alguma conta vem marcada,
// só entram as do profile — conta sem profileId deixa de vazar para os outros.

export function profileIdOf(account: {
  profileId?: { _id?: string } | string | null;
}): string | undefined {
  const p = account.profileId;
  if (!p) return undefined;
  if (typeof p === "string") return p || undefined;
  return p._id || undefined;
}

export function accountsForProfile<T extends { profileId?: { _id?: string } | string | null }>(
  accounts: T[],
  profileId: string,
): T[] {
  const tagged = accounts.some((a) => profileIdOf(a));
  if (!tagged) return accounts;
  return accounts.filter((a) => profileIdOf(a) === profileId);
}
