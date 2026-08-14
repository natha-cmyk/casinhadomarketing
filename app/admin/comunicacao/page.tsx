// /admin/comunicacao — pontos de contato de comunicação. Honesto sobre o que existe hoje
// (Supabase Auth) e o que precisa ser construído (camada de comunicação/eventos).
import { PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

function Item({ on, titulo, desc }: { on: boolean; titulo: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--hairline)" }}>
      <span style={{ flex: "0 0 auto", marginTop: 2, width: 20, height: 20, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: "#fff", background: on ? "var(--excelente,#2FB457)" : "var(--label-3)" }}>
        {on ? "✓" : "…"}
      </span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: "var(--label-2)", marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

export default async function AdminComunicacao() {
  return (
    <>
      <PageHead eyebrow="ADMIN · PLATAFORMA" title="Comunicação & pontos de contato" desc="O que a plataforma envia hoje e o que falta construir." />

      <div className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>Ativo hoje (via Supabase Auth)</div>
        <Item on titulo="Redefinição de senha" desc="E-mail automático com link de reset quando o usuário pede." />
        <Item on titulo="Magic link / confirmação de cadastro" desc="E-mail de acesso/confirmação no fluxo de login/cadastro." />
      </div>

      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>A construir (roadmap)</div>
        <Item on={false} titulo="Régua de onboarding" desc="Sequência de boas-vindas e primeiros passos por e-mail." />
        <Item on={false} titulo="Gatilho ao conectar uma conta" desc="Aviso/registro toda vez que um usuário conecta um canal." />
        <Item on={false} titulo="Resumos periódicos" desc="Digest semanal/mensal de desempenho por workspace." />
        <Item on={false} titulo="Log de envios por usuário" desc="Rastreio de cada ponto de contato que cada pessoa recebeu." />
      </div>

      <p style={{ fontSize: 12, color: "var(--label-3)", marginTop: 16, maxWidth: 640, lineHeight: 1.6 }}>
        O roadmap acima exige uma <b>camada de comunicação + eventos</b> (provedor de e-mail e uma tabela de eventos de envio) que ainda não existe no produto. Quando priorizado, cada gatilho e o log de envios aparecem aqui, por usuário e por workspace.
      </p>
    </>
  );
}
