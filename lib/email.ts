// Envio de e-mail transacional via Resend (server-only). Env-gated: sem RESEND_API_KEY,
// vira no-op (nunca quebra a ação). FROM e URL do app vêm de env.
//   RESEND_API_KEY  — chave da conta Resend da Seahub
//   EMAIL_FROM      — remetente verificado no Resend (ex.: "Casinha do Marketing <no-reply@seahubcoworking.com.br>")
//   APP_URL         — base pública do app pros links (ex.: https://casinha.seahubcoworking.com.br)
export const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://casinha.seahubcoworking.com.br").replace(/\/$/, "");
const FROM = process.env.EMAIL_FROM || "Casinha do Marketing <no-reply@seahubcoworking.com.br>";
const KEY = process.env.RESEND_API_KEY || "";

export const emailConfigured = () => !!KEY;

export async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string }): Promise<boolean> {
  if (!KEY) return false; // sem chave → no-op silencioso
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html, ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
    });
    return r.ok;
  } catch {
    return false; // e-mail nunca derruba a ação
  }
}
