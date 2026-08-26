// Política de Privacidade pública (LGPD). Linkada na tela de consentimento do Google OAuth
// e no rodapé. Página estática server-side — sem dados do usuário, sem auth.
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade · Casinha do Marketing",
  description: "Como a Casinha do Marketing (Seahub Coworking) trata seus dados pessoais.",
};

const ATUALIZADO = "20 de agosto de 2026";
const CONTATO = "jose@seahubcoworking.com.br";

export default function PrivacidadePage() {
  return (
    <main className="legal-wrap">
      <div className="legal-card">
        <header className="legal-head">
          <div className="legal-mark">C</div>
          <div>
            <h1 className="legal-title">Política de Privacidade</h1>
            <p className="legal-sub">Casinha do Marketing · Seahub Coworking — Natal/RN</p>
          </div>
        </header>
        <p className="legal-meta">Última atualização: {ATUALIZADO}</p>

        <section className="legal-body">
          <p>
            Esta Política explica como a <b>Casinha do Marketing</b>, plataforma operada pela{" "}
            <b>Seahub Coworking</b> (&quot;nós&quot;), coleta, usa e protege dados pessoais de quem utiliza o
            serviço (&quot;você&quot;), em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
          </p>

          <h2>1. Dados que coletamos</h2>
          <ul>
            <li><b>Cadastro:</b> nome, e-mail e, quando você entra com o Google, o e-mail e nome associados à conta Google.</li>
            <li><b>Ambiente:</b> informações da sua empresa que você preenche (ramo, telefone de contato, cidade/estado, personas, metas).</li>
            <li><b>Conexões de canais:</b> ao conectar redes sociais, mídia paga, ficha do Google ou CRM, recebemos tokens de acesso e métricas dessas contas (alcance, engajamento, leads, desempenho de anúncios) para exibir seus painéis.</li>
            <li><b>Uso:</b> registros técnicos de acesso e ações na plataforma (log de auditoria), para segurança e suporte.</li>
          </ul>

          <h2>2. Como usamos</h2>
          <p>Usamos os dados para: prover e operar a plataforma; montar seus painéis e relatórios; alimentar os assistentes de IA; enviar comunicações transacionais (boas-vindas, convites de equipe, avisos); e garantir a segurança do serviço. Não vendemos seus dados.</p>

          <h2>3. Uso do Google e de outras plataformas</h2>
          <p>
            Ao conectar contas Google (login e, quando aplicável, ficha do Google Meu Negócio), o uso das informações
            recebidas respeita as políticas das respectivas plataformas. Só acessamos os dados necessários para as
            funções que você habilita, e você pode revogar o acesso a qualquer momento nas configurações da conta na
            plataforma de origem ou entrando em contato conosco.
          </p>

          <h2>4. Compartilhamento e operadores</h2>
          <p>Compartilhamos dados apenas com prestadores que viabilizam o serviço, atuando como operadores sob nossas instruções:</p>
          <ul>
            <li><b>Supabase</b> — autenticação e banco de dados.</li>
            <li><b>Vercel</b> — hospedagem da aplicação.</li>
            <li><b>Resend</b> — envio de e-mails transacionais.</li>
            <li><b>Provedores de integração</b> que você conecta (redes sociais, mídia paga, CRM) — para leitura das métricas autorizadas.</li>
          </ul>

          <h2>5. Bases legais (LGPD)</h2>
          <p>Tratamos dados com base na execução do contrato (prestação do serviço), no seu consentimento (ao conectar canais) e no legítimo interesse (segurança e melhoria da plataforma).</p>

          <h2>6. Retenção</h2>
          <p>Mantemos os dados enquanto sua conta estiver ativa e pelo prazo necessário para cumprir obrigações legais. Ao encerrar a conta, os dados são excluídos ou anonimizados, salvo retenção exigida por lei.</p>

          <h2>7. Segurança</h2>
          <p>Adotamos medidas técnicas e organizacionais para proteger seus dados (acesso restrito por ambiente, criptografia em trânsito, escopo por workspace). Nenhum sistema é 100% infalível, mas trabalhamos continuamente para reduzir riscos.</p>

          <h2>8. Seus direitos</h2>
          <p>Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus dados, além de revogar consentimentos. Para exercer, fale com nosso contato abaixo.</p>

          <h2>9. Cookies</h2>
          <p>Usamos apenas cookies essenciais para manter sua sessão autenticada. Não usamos cookies de publicidade de terceiros.</p>

          <h2>10. Alterações</h2>
          <p>Podemos atualizar esta Política. Mudanças relevantes serão comunicadas na plataforma ou por e-mail. A data no topo indica a versão vigente.</p>

          <h2>11. Contato</h2>
          <p>
            Dúvidas ou solicitações sobre privacidade e dados pessoais:{" "}
            <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
          </p>
        </section>

        <footer className="legal-foot">
          <Link href="/">← Voltar</Link>
          <span>Casinha do Marketing · Seahub Coworking</span>
        </footer>
      </div>
    </main>
  );
}
