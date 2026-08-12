"use client";
// Concorrência — CRUD por workspace (persistido). Começa vazio.
// Portado de viewConcorrencia + compCard + pIcon (blueprint 1613-1643).
import { useStore, newId, type ConcItem } from "@/lib/store";
import { Card, Segmented, type SegOption } from "@/components/ui";
import { Ic } from "@/components/Ic";

// Ícones de canal (paths internos) e cores — específicos deste painel.
const PICON: Record<string, string> = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/>',
  site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 4 3 14 0 18M12 3c-3 4-3 14 0 18"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10.5V17M7 7.2v.01M11 17v-3.5a2 2 0 0 1 4 0V17"/>',
  youtube: '<rect x="2.5" y="6" width="19" height="12" rx="3.5"/><path d="M10.5 9.6l4.2 2.4-4.2 2.4z"/>',
};
const PCOLOR: Record<string, string> = {
  instagram: "#E4405F",
  site: "#00BBC5",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
};

function PiconEl({ type, on }: { type: string; on: boolean }) {
  const col = on ? PCOLOR[type] : "#C7C7CC";
  return (
    <span className="picon" title={`${type}${on ? "" : " — não mapeado"}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={col}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: PICON[type] }}
      />
    </span>
  );
}

function CompCard({ c }: { c: ConcItem }) {
  const update = useStore((s) => s.updateConc);
  const remove = useStore((s) => s.removeConc);

  const hide = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = "none";
  };

  const ov = c.iconOverride;
  let logo: React.ReactNode;
  if (ov && ov.indexOf("http") === 0) {
    logo = (
      <>
        <img src={ov} alt="" onError={hide} />
        <span>{(c.nome || "?")[0]}</span>
      </>
    );
  } else if (ov) {
    logo = <span className="comp-emoji">{ov}</span>;
  } else {
    logo = (
      <>
        {c.dominio && <img src={`https://logo.clearbit.com/${c.dominio}`} alt="" loading="lazy" onError={hide} />}
        <span>{(c.nome || "?")[0]}</span>
      </>
    );
  }

  return (
    <div className="comp-card">
      <button className="comp-editbtn" onClick={() => remove(c.id)} aria-label="Remover" title="Remover">✕</button>
      <div className="comp-logo">{logo}</div>
      <input className="comp-in" value={c.nome} placeholder="Nome" onChange={(e) => update(c.id, { nome: e.target.value })} style={{ marginBottom: 6 }} />
      <div className="comp-icons" style={{ marginBottom: 8 }}>
        <PiconEl type="instagram" on={!!c.ig} />
        <PiconEl type="site" on={!!c.dominio} />
        <PiconEl type="linkedin" on={c.linkedin} />
        <PiconEl type="youtube" on={c.youtube} />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <input className="comp-in" value={c.ig} placeholder="@instagram" onChange={(e) => update(c.id, { ig: e.target.value })} />
        <input className="comp-in" value={c.dominio || ""} placeholder="dominio.com.br" onChange={(e) => update(c.id, { dominio: e.target.value })} />
        <input className="comp-in" value={c.iconOverride || ""} placeholder="URL da imagem ou emoji" onChange={(e) => update(c.id, { iconOverride: e.target.value })} />
        <button
          type="button"
          className="btn-link"
          style={{ justifyContent: "center", padding: "6px 10px", fontSize: 12 }}
          disabled={!c.ig.replace(/[@\s]/g, "")}
          onClick={() => {
            const handle = c.ig.replace(/[@\s]/g, "");
            if (!handle) return;
            update(c.id, { iconOverride: `https://unavatar.io/instagram/${handle}` });
          }}
        >
          Puxar foto do IG
        </button>
        <select
          className="comp-in"
          value={c.categoria}
          onChange={(e) => update(c.id, { categoria: e.target.value as ConcItem["categoria"] })}
        >
          <option value="espaco">Espaço & EV</option>
          <option value="marca">Registro de Marca</option>
          <option value="certificado">Certificado Digital</option>
          <option value="cobranca">Cobrança</option>
        </select>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--label-2)" }}>
          <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={c.linkedin} onChange={(e) => update(c.id, { linkedin: e.target.checked })} /> LinkedIn
          </label>
          <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={c.youtube} onChange={(e) => update(c.id, { youtube: e.target.checked })} /> YouTube
          </label>
        </div>
      </div>
    </div>
  );
}

const CATS: [string, string][] = [
  ["geral", "Geral"],
  ["espaco", "Espaço & EV"],
  ["marca", "Registro de Marca"],
  ["certificado", "Certificado Digital"],
  ["cobranca", "Cobrança"],
];

export default function ConcorrenciaView() {
  const concorrentes = useStore((s) => s.concorrentes);
  const addConc = useStore((s) => s.addConc);
  const concProd = useStore((s) => s.concProd);
  const set = useStore((s) => s.set);
  const sel = concProd || "geral";

  const list = sel === "geral" ? concorrentes : concorrentes.filter((c) => c.categoria === sel);
  const options: SegOption[] = CATS.map(([value, label]) => ({ value, label }));

  const add = () =>
    addConc({
      id: newId("conc"), nome: "Novo concorrente", ig: "", linkedin: false, youtube: false,
      categoria: (sel === "geral" ? "espaco" : sel) as ConcItem["categoria"], ordem: concorrentes.length,
    });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Estratégia · Benchmark</div>
          <h2>Concorrência</h2>
          <p>
            <b>Nada se cria, tudo se copia.</b> Concorrentes e referências por linha de negócio — presença por canal em cada card (ícone colorido = tem; cinza = não mapeado).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Segmented small options={options} value={sel} onChange={(v) => set({ concProd: v })} />
          <button className="btn-link" onClick={add}>＋ Adicionar</button>
        </div>
      </div>

      {concorrentes.length === 0 ? (
        <div className="empty">
          <div className="e-ico">🥊</div>
          <h3>Nenhum concorrente ainda</h3>
          <p>Cadastre concorrentes e referências por linha de negócio para acompanhar a presença deles por canal.</p>
          <button className="btn-link" onClick={add}>＋ Adicionar concorrente</button>
        </div>
      ) : (
        <div className="comp-grid">
          {list.map((c) => (
            <CompCard key={c.id} c={c} />
          ))}
        </div>
      )}

    </>
  );
}
