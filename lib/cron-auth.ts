import { NextResponse } from "next/server";
import { secretEquals } from "./secret-eq";

/** true só com CRON_SECRET definido e Bearer igual. Sem secret, fecha. */
export function cronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  return secretEquals(provided, secret);
}

/** 401 se o cron não está autorizado. null se pode seguir. */
export function cronDenied(req: Request): NextResponse | null {
  if (cronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) return null;
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
