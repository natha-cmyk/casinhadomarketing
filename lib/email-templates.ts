// Templates de e-mail (HTML inline, compatível com clientes). Estética Seahub.
import { APP_URL } from "./email";

const RED = "#FF001E", CYAN = "#00BBC5", INK = "#121111", CREAM = "#EDEDEC";
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// layout base: cabeçalho com marca + corpo + botão opcional + rodapé
function layout(title: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  return `<!doctype html><html><body style="margin:0;background:${CREAM};font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${INK}">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06)">
      <div style="background:${INK};padding:18px 24px;color:#fff;font-weight:800;font-size:16px;letter-spacing:.2px">
        <span style="color:${RED}">●</span> Casinha do Marketing
      </div>
      <div style="padding:24px">
        <h1 style="font-size:19px;margin:0 0 12px;color:${INK}">${esc(title)}</h1>
        <div style="font-size:14.5px;line-height:1.6;color:#333">${bodyHtml}</div>
        ${cta ? `<div style="margin:22px 0 6px"><a href="${cta.href}" style="display:inline-block;background:${CYAN};color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:10px;font-size:14px">${esc(cta.label)}</a></div>` : ""}
      </div>
    </div>
    <div style="text-align:center;color:#8E8E93;font-size:11.5px;margin-top:14px">
      Casinha do Marketing · Seahub Coworking — Natal/RN<br/>Você recebeu porque tem acesso à plataforma.
    </div>
  </div></body></html>`;
}

export function welcomeEmail(nome?: string) {
  const oi = nome ? `Olá, ${esc(nome)}!` : "Olá!";
  return {
    subject: "Bem-vindo à Casinha do Marketing 🎉",
    html: layout("Sua Casinha está pronta", `
      <p>${oi}</p>
      <p>Seu ambiente na <b>Casinha do Marketing</b> está oficialmente pronto — é hora de entrar!</p>
      <p>Aqui você acompanha redes sociais, mídia paga, CRM, metas e conta com os assistentes de IA.</p>
      <p>Pra começar: conecte seus canais e configure seu ambiente na aba <b>Personalização</b>.</p>
      <p>Estamos muito felizes em te receber por aqui! ✨</p>
    `, { label: "🏠 Acesse sua Casinha", href: APP_URL }),
  };
}

export function inviteEmail(opts: { workspaceNome: string; convidadoPor?: string; role: string; email: string }) {
  const quem = opts.convidadoPor ? `<b>${esc(opts.convidadoPor)}</b>` : "A equipe";
  const papel = opts.role === "owner" ? "administrador(a)" : "membro";
  const subject = opts.convidadoPor
    ? `Você foi convidado(a) para a Casinha do Marketing — ${opts.convidadoPor}`
    : "Você foi convidado(a) para a Casinha do Marketing";
  return {
    subject,
    html: layout("Convite pra um ambiente", `
      <p>${quem} convidou você (${papel}) para o ambiente <b>${esc(opts.workspaceNome)}</b> na Casinha do Marketing.</p>
      <p>Para entrar, acesse a plataforma e faça login <b>com este mesmo e-mail</b> (${esc(opts.email)}) — pelo Google ou por e-mail e senha (que você mesmo vai cadastrar).</p>
      <p>Depois é só aproveitar e começar a usar!</p>
    `, { label: "🏠 Entrar na Casinha", href: `${APP_URL}/login` }),
  };
}

export function referralConvertedEmail(opts: { cliente: string; mes?: string | null }) {
  return {
    subject: "Sua indicação virou cliente 🎁",
    html: layout("Indicação convertida!", `
      <p>Boa notícia: <b>${esc(opts.cliente)}</b> chegou pela sua indicação e virou cliente da Casinha.</p>
      <p>${opts.mes ? `Como recompensa, sua mensalidade de <b>${esc(opts.mes)}</b> foi abonada! 🤗` : "Sua próxima mensalidade será abonada como recompensa! 🤗"}</p>
      <p>Continue indicando usando o seu link — cada conversão zera um mês! 🔥</p>
    `, { label: "🎯 Ver minhas indicações", href: `${APP_URL}/indicacoes` }),
  };
}

export function connectionsReminderEmail(nome?: string) {
  const oi = nome ? `Olá, ${esc(nome)}!` : "Olá!";
  return {
    subject: "Conecte seus canais pra ver todos seus números",
    html: layout("Seu painel está esperando dados", `
      <p>${oi}</p>
      <p>Notamos que seu ambiente ainda não tem canais conectados. Conectando suas redes e a mídia paga, seus painéis passam a mostrar alcance, engajamento, leads e desempenho — fica mais usual e rico de informações!</p>
      <p>Leva 1 minuto: é login seguro direto na própria rede, em <b>Personalização → Conexões</b>. Let's go! 🔥</p>
    `, { label: "🎯 Conectar meus canais", href: `${APP_URL}/personalizacao` }),
  };
}
