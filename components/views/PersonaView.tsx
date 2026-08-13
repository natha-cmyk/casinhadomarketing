"use client";
// Persona & Público — CRUD por workspace (persistido). Começa vazio.
// Portado de viewPersona (blueprint 1517-1598), simplificado para cards editáveis.
import { useState } from "react";
import { useStore, newId, type PersonaItem } from "@/lib/store";
import { Card, PageHead } from "@/components/ui";

// redes que expõem demografia de audiência (mesmo conjunto da rota /api/persona/gerar)
const REDE_LABEL: Record<string, string> = { instagram: "Instagram", youtube: "YouTube" };
const REDE_EMOJI: Record<string, string> = { instagram: "📸", youtube: "▶️" };
const REDE_COVER: Record<string, string> = {
  instagram: "linear-gradient(120deg,#FF001E,#121111)",
  youtube: "linear-gradient(120deg,#FF0000,#121111)",
};

function PersonaCard({ p }: { p: PersonaItem }) {
  const update = useStore((s) => s.updatePersona);
  const remove = useStore((s) => s.removePersona);

  const setDor = (idx: number, v: string) =>
    update(p.id, { dores: p.dores.map((d, i) => (i === idx ? v : d)) });
  const addDor = () => update(p.id, { dores: [...p.dores, ""] });
  const rmDor = (idx: number) => update(p.id, { dores: p.dores.filter((_, i) => i !== idx) });

  const setStat = (idx: number, col: 0 | 1, v: string) =>
    update(p.id, {
      stats: p.stats.map((s, i) => (i === idx ? ((col === 0 ? [v, s[1]] : [s[0], v]) as [string, string]) : s)),
    });
  const addStat = () => update(p.id, { stats: [...p.stats, ["", ""] as [string, string]] });
  const rmStat = (idx: number) => update(p.id, { stats: p.stats.filter((_, i) => i !== idx) });

  return (
    <div className="card ptinder" style={{ marginBottom: 12 }}>
      <div className="pt-photo" style={{ background: p.cover || "linear-gradient(120deg,#121111,#3a3a3a)" }}>
        {p.foto && (
          <img key={p.foto} src={p.foto} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <span className="pt-emoji">{p.emoji}</span>
        <div className="pt-photoedit">
          <input
            value={p.foto || ""}
            placeholder="colar URL da foto da persona"
            autoComplete="off"
            onChange={(e) => update(p.id, { foto: e.target.value })}
          />
        </div>
      </div>
      <div className="pt-body">
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-link" onClick={() => remove(p.id)} title="Remover persona">✕ Remover</button>
        </div>
        <div className="pt-sec">
          <div className="pt-l">Tag</div>
          <input className="field-edit" value={p.tag} placeholder="P0 · Marca" onChange={(e) => update(p.id, { tag: e.target.value })} />
        </div>
        <div className="pt-sec">
          <div className="pt-l">Nome</div>
          <input className="field-edit" value={p.nome} placeholder="Nome da persona" onChange={(e) => update(p.id, { nome: e.target.value })} />
        </div>
        <div className="pt-sec">
          <div className="pt-l">Handle</div>
          <input className="field-edit" value={p.handle} placeholder="@handle" onChange={(e) => update(p.id, { handle: e.target.value })} />
        </div>
        <div className="pt-sec" style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 90 }}>
            <div className="pt-l">Emoji</div>
            <input className="field-edit" value={p.emoji} placeholder="🚀" onChange={(e) => update(p.id, { emoji: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="pt-l">Cover (CSS)</div>
            <input className="field-edit" value={p.cover} placeholder="linear-gradient(...)" onChange={(e) => update(p.id, { cover: e.target.value })} />
          </div>
        </div>
        <div className="pt-sec">
          <div className="pt-l">Quem representa</div>
          <textarea className="field-edit" value={p.representa} rows={2} onChange={(e) => update(p.id, { representa: e.target.value })} />
        </div>
        <div className="pt-sec">
          <div className="pt-l">O que comunica</div>
          <textarea className="field-edit" value={p.comunica} rows={2} onChange={(e) => update(p.id, { comunica: e.target.value })} />
        </div>
        <div className="pt-sec">
          <div className="pt-l">Dores</div>
          <div className="pt-dores" style={{ marginBottom: 6 }}>
            {p.dores.map((d, j) => (
              <span key={j} className="chip-rm">
                <input
                  value={d}
                  placeholder="dor"
                  autoComplete="off"
                  onChange={(e) => setDor(j, e.target.value)}
                  style={{ border: 0, background: "transparent", font: "inherit", fontSize: "12.5px", width: `${Math.max(6, d.length)}ch` }}
                />
                <button onClick={() => rmDor(j)} aria-label="Remover dor">✕</button>
              </span>
            ))}
          </div>
          <button className="btn-link" onClick={addDor}>＋ Dor</button>
        </div>
        <div className="pt-sec">
          <div className="pt-l">Canais</div>
          <input className="field-edit" value={p.canais} onChange={(e) => update(p.id, { canais: e.target.value })} />
        </div>
        <div className="pt-sec">
          <div className="pt-l">Gatilho de conversão</div>
          <input className="field-edit" value={p.gatilho} onChange={(e) => update(p.id, { gatilho: e.target.value })} />
        </div>
        <div className="pt-sec">
          <div className="pt-l">Stats</div>
          {p.stats.map((a, j) => (
            <div key={j} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <input className="field-edit" value={a[0]} placeholder="valor" onChange={(e) => setStat(j, 0, e.target.value)} style={{ width: 120 }} />
              <input className="field-edit" value={a[1]} placeholder="rótulo" onChange={(e) => setStat(j, 1, e.target.value)} />
              <button className="btn-link" onClick={() => rmStat(j)} aria-label="Remover stat">✕</button>
            </div>
          ))}
          <button className="btn-link" onClick={addStat}>＋ Stat</button>
        </div>
      </div>
    </div>
  );
}

// rascunho de persona devolvido pela rota /api/persona/gerar
interface GenDraft {
  nome: string; representa: string; comunica: string;
  dores: string[]; canais: string; stats: [string, string][];
}

export default function PersonaView() {
  const personas = useStore((s) => s.personas);
  const addPersona = useStore((s) => s.addPersona);
  const zernioAccounts = useStore((s) => s.zernioAccounts);

  // seletor "gerar da audiência"
  const [selOpen, setSelOpen] = useState(false);
  const [genBusy, setGenBusy] = useState<string | null>(null); // accountId em processamento
  const [genErr, setGenErr] = useState<string | null>(null);

  // contas SOCIAIS conectadas que expõem demografia (Instagram / YouTube).
  // ads-only (enabled:false) não têm audiência de perfil — ficam de fora.
  const demoAccounts = zernioAccounts.filter(
    (a) => (a.platform === "instagram" || a.platform === "youtube") && a.enabled !== false
  );

  const add = () =>
    addPersona({
      id: newId("persona"), tag: "", handle: "", emoji: "✨", cover: "linear-gradient(120deg,#121111,#3a3a3a)",
      nome: "Nova persona", representa: "", comunica: "", dores: [], canais: "", gatilho: "", stats: [],
      ordem: personas.length,
    });

  // chama a rota, recebe o rascunho e cria uma persona marcada como "gerada da audiência"
  const gerar = async (acc: (typeof demoAccounts)[number]) => {
    setGenBusy(acc._id); setGenErr(null);
    try {
      const r = await fetch("/api/persona/gerar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform: acc.platform, accountId: acc._id }),
      });
      const data = (await r.json().catch(() => null)) as { persona?: GenDraft; meta?: { rede?: string }; error?: string } | null;
      if (!r.ok || !data?.persona) {
        setGenErr(data?.error || "Não foi possível gerar a persona agora.");
        return;
      }
      const d = data.persona;
      const rede = data.meta?.rede || REDE_LABEL[acc.platform] || acc.platform;
      const handleBase = acc.username || acc.displayName || acc.platform;
      addPersona({
        id: newId("persona"),
        tag: `Audiência · ${rede}`,
        handle: `@${String(handleBase).replace(/^@/, "")}`,
        emoji: REDE_EMOJI[acc.platform] || "✨",
        cover: REDE_COVER[acc.platform] || "linear-gradient(120deg,#00BBC5,#121111)",
        nome: d.nome, representa: d.representa, comunica: d.comunica,
        dores: Array.isArray(d.dores) ? d.dores : [],
        canais: d.canais || rede, gatilho: "",
        stats: Array.isArray(d.stats) ? d.stats : [],
        ordem: personas.length,
      });
      setSelOpen(false);
    } catch {
      setGenErr("Falha de rede ao gerar a persona.");
    } finally {
      setGenBusy(null);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Estratégia · Inteligência de Personas"
        title="Persona & Público"
        desc="Personas de marca e de conversão do seu público. Crie, edite e remova — tudo salvo neste workspace."
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn-link" onClick={() => { setSelOpen((o) => !o); setGenErr(null); }}>
              ✨ Gerar persona da audiência
            </button>
            <button className="btn-link" onClick={add}>＋ Adicionar</button>
          </div>
        }
      />

      {selOpen && (
        <Card padLg style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.2px", marginBottom: 2 }}>
            Retrato da audiência real
          </div>
          <p style={{ color: "var(--label-2)", margin: "0 0 12px", fontSize: 13 }}>
            Escolha uma rede conectada com demografia. Montamos uma persona a partir de quem{" "}
            <b>realmente consome o canal</b> (idade, gênero, cidade) — para você comparar com as personas
            planejadas e enxergar desalinhamento. É editável depois, como qualquer persona.
          </p>

          {demoAccounts.length === 0 ? (
            <p style={{ color: "var(--label-3)", fontSize: 13, margin: 0 }}>
              Nenhuma rede com demografia conectada. Conecte um Instagram ou YouTube em Conexões para gerar.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {demoAccounts.map((a) => {
                const rede = REDE_LABEL[a.platform] || a.platform;
                const nome = a.displayName || a.username || rede;
                const busy = genBusy === a._id;
                return (
                  <button
                    key={a._id}
                    className="btn"
                    onClick={() => gerar(a)}
                    disabled={!!genBusy}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "9px 13px", borderRadius: 12, cursor: genBusy ? "default" : "pointer",
                      opacity: genBusy && !busy ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{REDE_EMOJI[a.platform] || "✨"}</span>
                    <span style={{ fontWeight: 600 }}>{rede}</span>
                    <span style={{ color: "var(--label-3)", fontSize: 12.5 }}>· {nome}</span>
                    {busy && <span style={{ color: "var(--cyan)", fontSize: 12.5 }}>gerando…</span>}
                  </button>
                );
              })}
            </div>
          )}

          {genErr && (
            <div style={{ marginTop: 10, color: "var(--red)", fontSize: 13 }}>{genErr}</div>
          )}
        </Card>
      )}

      {personas.length === 0 ? (
        <div className="empty">
          <div className="e-ico" style={{ fontSize: 22 }}>🧑‍🤝‍🧑</div>
          <h3>Nenhuma persona ainda</h3>
          <p>Mapeie quem é o seu público — quem representa, o que comunica, dores, canais e gatilhos de conversão.</p>
          <button className="btn-link" onClick={add}>＋ Adicionar persona</button>
        </div>
      ) : (
        <Card padLg>
          {personas.map((p) => (
            <PersonaCard key={p.id} p={p} />
          ))}
        </Card>
      )}
    </>
  );
}
