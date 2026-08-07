"use client";
// Bolha de agentes — presença + troca por seção. Chat/stub completo entra no Bloco 5.
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { viewForPath } from "@/lib/nav";

interface Agent {
  nome: string;
  papel: string;
  cor: string;
  ini: string;
}
const AGENTS: Record<string, Agent> = {
  poseidon: { nome: "Poseidon", papel: "Dados & mídia paga", cor: "#00BBC5", ini: "Po" },
  apollo: { nome: "Apollo", papel: "Conteúdo & canais", cor: "#FF001E", ini: "Ap" },
  athena: { nome: "Athena", papel: "Metas & OKR", cor: "#8E5BE0", ini: "At" },
  dionisio: { nome: "Dionísio", papel: "Persona & público", cor: "#FF9F0A", ini: "Di" },
};
const BY_VIEW: Record<string, keyof typeof AGENTS> = {
  overview: "poseidon", ads: "poseidon", canais: "poseidon", concorrencia: "poseidon", config: "poseidon",
  calendario: "apollo", instagram: "apollo", tiktok: "apollo", linkedin: "apollo", youtube: "apollo",
  x: "apollo", facebook: "apollo", threads: "apollo", reddit: "apollo", pinterest: "apollo",
  bluesky: "apollo", snapchat: "apollo", googlebusiness: "apollo",
  metas: "athena", persona: "dionisio",
};

export function AgentDock() {
  const pathname = usePathname();
  const view = viewForPath(pathname);
  const agent = AGENTS[BY_VIEW[view] || "poseidon"];
  const open = useStore((s) => s.agentOpen);
  const toggle = useStore((s) => s.toggleAgent);

  return (
    <div id="agentDock">
      {open && (
        <div className="ag-panel">
          <div className="ag-head">
            <div className="ag-head-l">
              <div className="ag-av" style={{ background: agent.cor }}>
                {agent.ini}
              </div>
              <div>
                <b>{agent.nome}</b>
                <span>{agent.papel}</span>
              </div>
            </div>
            <button className="ag-x" onClick={toggle} type="button" aria-label="Fechar">
              ✕
            </button>
          </div>
          <div className="ag-thread">
            <div className="ag-msg">
              <div className="ag-bubble">
                Oi! Sou o {agent.nome}, cuido de {agent.papel.toLowerCase()}. O chat com respostas reais entra em breve.
              </div>
            </div>
          </div>
          <div className="ag-foot">Prévia · respostas reais via OpenClaw</div>
        </div>
      )}
      <button
        className={`ag-fab${open ? " open" : ""}`}
        style={{ "--agc": agent.cor } as React.CSSProperties}
        onClick={toggle}
        type="button"
        aria-label="Abrir assistente"
      >
        {open ? "✕" : agent.ini}
      </button>
    </div>
  );
}
