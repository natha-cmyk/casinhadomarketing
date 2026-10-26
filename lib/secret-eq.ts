import { timingSafeEqual } from "crypto";

/** Compara segredos sem vazar o tamanho do prefixo pelo tempo de resposta. */
export function secretEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
