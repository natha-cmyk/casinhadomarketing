// Termos de Uso públicos. Linkados na tela de consentimento do Google OAuth e no rodapé.
// Página estática server-side — sem dados do usuário, sem auth. Rota liberada no middleware.
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso · Casinha do Marketing",
  description: "Termos de Uso da plataforma Casinha do Marketing (Seahub Coworking).",
};

const ATUALIZADO = "20 de agosto de 2026";
const CONTATO = "jose@seahubcoworking.com.br";

export default function TermosPage() {
  return (
    <main className="legal-wrap">
      <div className="legal-card">
        <header className="legal-head">
          <div className="legal-mark">C</div>
          <div>
            <h1 className="legal-title">Termos de Uso</h1>
            <p className="legal-sub">Casinha do Marketing · Seahub Coworking — Natal/RN</p>
          </div>
        </header>
        <p className="legal-meta">Última atualização: {ATUALIZADO}</p>

        <section className="legal-body">
          <p>
            Estes Termos regem o uso da plataforma <b>Casinha do Marketing</b> (&quot;plataforma&quot;), operada pela{" "}
            <b>Seahub Coworking</b> (&quot;nós&quot;). Ao criar uma conta ou usar o serviço, você (&quot;usuário&quot;)
            concorda com estes Termos e com a{" "}
            <Link href="/privacidade">Política de Privacidade</Link>.
          </p>

          <h2>1. O serviço</h2>
          <p>A Casinha do Marketing é um painel de marketing que reúne, em um só lugar, dados de redes sociais, mídia paga, ficha do Google, CRM, metas e assistentes de IA. As funcionalidades podem evoluir, ser adicionadas ou removidas ao longo do tempo.</p>

          <h2>2. Conta e acesso</h2>
          <ul>
            <li>Você é responsável por manter a confidencialidade das suas credenciais e por toda atividade na sua conta.</li>
            <li>Cada ambiente (workspace) pode ter vários usuários, gerenciados por quem tem o papel de administrador.</li>
            <li>Você declara que as informações fornecidas no cadastro são verdadeiras e atualizadas.</li>
          </ul>

          <h2>3. Uso aceitável</h2>
          <p>Você concorda em não usar a plataforma para fins ilícitos, não tentar acessar áreas ou dados de outros usuários, não sobrecarregar ou burlar a infraestrutura, e não conectar contas de terceiros sem a devida autorização.</p>

          <h2>4. Conexões de terceiros</h2>
          <p>Ao conectar serviços externos (redes sociais, mídia paga, CRM, Google), você autoriza a plataforma a acessar as informações necessárias para exibir seus painéis. O uso desses serviços também está sujeito aos termos das respectivas plataformas. Você pode desconectar as integrações a qualquer momento.</p>

          <h2>5. Assinatura e pagamentos</h2>
          <p>Quando houver plano pago, os valores, o ciclo de cobrança e eventuais bonificações (como indicações que abonam mensalidade) serão informados na plataforma antes da contratação. Detalhes de cobrança podem ser tratados diretamente com nossa equipe.</p>

          <h2>6. Propriedade intelectual</h2>
          <p>A plataforma, sua marca e seu software pertencem à Seahub Coworking. Os dados que você insere ou conecta continuam sendo seus; concedemos a você uma licença de uso da plataforma, não a titularidade dela.</p>

          <h2>7. Assistentes de IA</h2>
          <p>Os assistentes usam LLM para gerar sugestões e análises. As respostas são apoio à decisão e podem conter imprecisões — recomendamos revisão humana antes de agir sobre elas.</p>

          <h2>8. Disponibilidade e limitação de responsabilidade</h2>
          <p>Nos empenhamos para manter o serviço disponível, mas ele é fornecido &quot;no estado em que se encontra&quot;. Não nos responsabilizamos por indisponibilidades de serviços de terceiros conectados nem por decisões tomadas com base nos dados exibidos.</p>

          <h2>9. Encerramento</h2>
          <p>Você pode encerrar sua conta a qualquer momento. Podemos suspender o acesso em caso de violação destes Termos. Após o encerramento, tratamos seus dados conforme a Política de Privacidade.</p>

          <h2>10. Alterações</h2>
          <p>Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas na plataforma ou por e-mail. A data no topo indica a versão vigente.</p>

          <h2>11. Foro e contato</h2>
          <p>
            Estes Termos são regidos pelas leis brasileiras, com foro na comarca de Natal/RN. Dúvidas:{" "}
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
