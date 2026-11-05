import { randomBytes } from "crypto";

/** Token de link de cadastro (hex, 36 caracteres). Não usar Math.random. */
export function newSignupToken(): string {
  return randomBytes(18).toString("hex");
}
