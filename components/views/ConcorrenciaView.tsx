"use client";
// Portado de viewConcorrencia + compCard + pIcon (blueprint 1613-1643).
// Grid de concorrentes por linha de negócio, presença por canal e edição de ícone.
import { useRef } from "react";
import { useStore } from "@/lib/store";
import { COMP, type CompCategoria, type CompItem } from "@/lib/seed-data";
import { Card, Segmented, type SegOption } from "@/components/ui";
import { Ic } from "@/components/Ic";

// Ícones de canal (paths internos) e cores — específicos deste painel.
const PICON: Record<string, string> = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/>',
  site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 4 3 14 0 18M12 3c-3 4-3 14 0 18"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10.5V17M7 7.2v.01M11 17v-3.5a2 2 0 0 1 4 0V17"/>',
  tiktok: '<path d="M14 4v10.5a3.5 3.5 0 1 1-3-3.47"/><path d="M14 4c.4 2.3 1.9 3.8 4.2 4"/>',
  youtube: '<rect x="2.5" y="6" width="19" height="12" rx="3.5"/><path d="M10.5 9.6l4.2 2.4-4.2 2.4z"/>',
};
const PCOLOR: Record<string, string> = {
  instagram: "#E4405F",
  site: "#00BBC5",
  linkedin: "#0A66C2",
  tiktok: "#111111",
  youtube: "#FF0000",
};

function PiconEl({ type, on, href }: { type: string; on: boolean; href?: string | null }) {
  const col = on ? PCOLOR[type] : "#C7C7CC";
  const svg = (
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
  return href ? (
    <a href={href} target="_blank" rel="noopener" className="picon-link">
      {svg}
    </a>
  ) : (
    svg
  );
}

function CompCard({ c }: { c: CompItem }) {
  const compIcons = useStore((s) => s.compIcons);
  const compEdit = useStore((s) => s.compEdit);
  const set = useStore((s) => s.set);
  const inputRef = useRef<HTMLInputElement>(null);

  const ig = c.ig ? c.ig.replace("@", "") : "";
  const ov = compIcons[c.n];
  const editing = compEdit === c.n;

  const hide = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = "none";
  };

  let logo: React.ReactNode;
  if (ov && ov.indexOf("http") === 0) {
    logo = (
      <>
        <img src={ov} alt="" onError={hide} />
        <span>{c.n[0]}</span>
      </>
    );
  } else if (ov && ov.indexOf("IG:") === 0) {
    logo = <span className="comp-igav">{c.n[0]}</span>;
  } else if (ov) {
    logo = <span className="comp-emoji">{ov}</span>;
  } else {
    logo = (
      <>
        {c.dom && <img src={`https://logo.clearbit.com/${c.dom}`} alt="" loading="lazy" onError={hide} />}
        <span>{c.n[0]}</span>
      </>
    );
  }

  const save = () => {
    const v = inputRef.current?.value.trim() || "";
    set({ compIcons: { ...compIcons, [c.n]: v }, compEdit: null });
  };
  // "Puxar do IG" — stub (via Zernio, no backend). TODO(zernio)
  const pull = () => set({ compIcons: { ...compIcons, [c.n]: "IG:" + c.ig }, compEdit: null });

  return (
    <div className="comp-card">
      <button
        className="comp-editbtn"
        onClick={() => set({ compEdit: c.n })}
        aria-label="Editar ícone"
        title="Editar ícone"
      >
        ✎
      </button>
      <div className="comp-logo">{logo}</div>
      <h4>{c.n}</h4>
      <div className="ig">{c.ig || "—"}</div>
      <div className="comp-icons">
        <PiconEl type="instagram" on={!!c.ig} href={c.ig ? `https://instagram.com/${ig}` : null} />
        <PiconEl type="site" on={!!c.dom} href={c.dom ? `https://${c.dom}` : null} />
        <PiconEl type="linkedin" on={!!c.li} href={null} />
        <PiconEl type="tiktok" on={false} href={null} />
        <PiconEl type="youtube" on={!!c.yt} href={null} />
      </div>
      {editing && (
        <div className="comp-edit">
          <input
            className="comp-in"
            ref={inputRef}
            defaultValue={ov && ov.indexOf("IG:") !== 0 ? ov : ""}
            placeholder="URL da imagem ou emoji"
            autoComplete="off"
          />
          <div className="comp-edit-row">
            <button className="comp-pull" onClick={pull} disabled={!c.ig}>
              Puxar do IG
            </button>
            <button className="comp-save" onClick={save}>
              Salvar
            </button>
            <button className="comp-cancel" onClick={() => set({ compEdit: null })} aria-label="Cancelar">
              ✕
            </button>
          </div>
          <div className="comp-hint">
            Cole uma URL/emoji, ou puxe do perfil {c.ig || "—"} (via Zernio, no backend).
          </div>
        </div>
      )}
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
  const concProd = useStore((s) => s.concProd);
  const set = useStore((s) => s.set);
  const sel = concProd || "geral";
  const list: CompItem[] =
    sel === "geral"
      ? Object.values(COMP).flatMap((c) => c.list)
      : COMP[sel as CompCategoria]?.list ?? [];

  const options: SegOption[] = CATS.map(([value, label]) => ({ value, label }));

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
        <Segmented small options={options} value={sel} onChange={(v) => set({ concProd: v })} />
      </div>
      <div className="comp-grid">
        {list.map((c) => (
          <CompCard key={c.n} c={c} />
        ))}
      </div>
      <Card style={{ marginTop: 16 }}>
        <div className="insight" style={{ border: 0, background: "transparent", padding: 0 }}>
          <div className="ib" style={{ background: "var(--cyan)" }}>
            <Ic name="vs" />
          </div>
          <p>
            <b>Presença de Instagram, LinkedIn e YouTube</b> vem direto das casinhas. <b>Site</b> e <b>TikTok</b> ainda não foram mapeados (por isso cinza) — dá pra completar num scraping de inteligência competitiva. A aba <b>Geral</b> junta todos; os filtros isolam por produto.
          </p>
        </div>
      </Card>
    </>
  );
}
