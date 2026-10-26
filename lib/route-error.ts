/** Loga no servidor e devolve texto neutro. O cliente não recebe exceção, SQL nem corpo de upstream. */
export function clientError(scope: string, error: unknown, message: string): string {
  console.error(`[${scope}]`, error);
  return message;
}

/** Status HTTP do cliente de integração (`upstream 403: …`). null se não for esse formato. */
export function upstreamHttpStatus(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error);
  const m = /^upstream (\d{3})\b/.exec(msg);
  if (!m) return null;
  const code = Number(m[1]);
  return code >= 100 && code <= 599 ? code : null;
}
