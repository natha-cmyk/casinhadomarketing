const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data civil `YYYY-MM-DD` que existe no calendário. */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Par since/until só quando os dois são datas civis. Caso contrário, null (não interpolar). */
export function isoDateRange(
  since: string | null | undefined,
  until: string | null | undefined,
): { since: string; until: string } | null {
  if (!since || !until || !isIsoDate(since) || !isIsoDate(until)) return null;
  return { since, until };
}
