// Formatadores portados verbatim do blueprint (helpers, linhas 692-699).
export const sum = (a: number[]) => a.reduce((s, x) => s + (Number(x) || 0), 0);
export const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);

export const fmt = (n: number | null | undefined, d = 0) =>
  n == null || isNaN(n as number)
    ? "—"
    : Number(n).toLocaleString("pt-BR", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

export const money = (n: number | null | undefined) =>
  n == null || isNaN(n as number)
    ? "—"
    : "R$ " +
      Number(n).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

export const pct = (n: number | null | undefined) =>
  n == null || isNaN(n as number)
    ? "—"
    : (n * 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) + "%";

export const kfmt = (n: number) => {
  n = Number(n) || 0;
  return Math.abs(n) >= 1000
    ? (n / 1000).toLocaleString("pt-BR", {
        maximumFractionDigits: Math.abs(n) >= 100000 ? 0 : 1,
      }) + "k"
    : fmt(n);
};

export const parseBR = (s: unknown) => {
  if (s == null) return 0;
  const str = String(s)
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.\-]/g, "");
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
};
