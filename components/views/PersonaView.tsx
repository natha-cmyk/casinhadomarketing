"use client";
// Persona & Público — CRUD por workspace (persistido).
// v2: o botão "Adicionar" abre um CONSTRUTOR unificado (Do zero | Gerar da audiência),
// com campos profundos (persona como pessoa real: consome, gosta, não gosta, atividades)
// e geração de foto por IA (stub). Editar persona existente reabre o mesmo construtor.
import { useState } from "react";
import { useStore, newId, type PersonaItem, type PersonaDetalhes } from "@/lib/store";
import { Card, PageHead } from "@/components/ui";

// redes que expõem demografia de audiência (mesmo conjunto da rota /api/persona/gerar)
const REDE_LABEL: Record<string, string> = { instagram: "Instagram", youtube: "YouTube" };
const REDE_EMOJI: Record<string, string> = { instagram: "📸", youtube: "▶️" };
const REDE_COVER: Record<string, string> = {
  instagram: "linear-gradient(120deg,#FF001E,#121111)",
  youtube: "linear-gradient(120deg,#FF0000,#121111)",
};

// rascunho devolvido por /api/persona/gerar (agora com detalhes)
interface GenDraft {
  nome: string; representa: string; comunica: string;
  dores: string[]; canais: string; stats: [string, string][]; detalhes?: PersonaDetalhes;
}

// ── Editor de chip-list (usado em consome/gosta/naoGosta/atividades/dores) ──
function ChipList({
  label, itens, onChange, placeholder,
}: {
  label: string; itens: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const set = (idx: number, v: string) => onChange(itens.map((d, i) => (i === idx ? v : d)));
  const add = () => onChange([...itens, ""]);
  const rm = (idx: number) => onChange(itens.filter((_, i) => i !== idx));
  return (
    <div>
      <label className="field-lbl">{label}</label>
      <div className="pt-dores" style={{ marginBottom: 6 }}>
        {itens.map((d, j) => (
          <span key={j} className="chip-rm">
            <input
              value={d}
              placeholder={placeholder || "item"}
              autoComplete="off"
              onChange={(e) => set(j, e.target.value)}
              style={{ border: 0, background: "transparent", font: "inherit", fontSize: "12.5px", width: `${Math.max(6, d.length)}ch` }}
            />
            <button onClick={() => rm(j)} aria-label="Remover">✕</button>
          </span>
        ))}
      </div>
      <button className="btn-link" type="button" onClick={add}>＋ {label}</button>
    </div>
  );
}

// ── Card de exibição (read-only) — clique em Editar abre o construtor ──
function PersonaCard({ p, onEdit }: { p: PersonaItem; onEdit: () => void }) {
  const remove = useStore((s) => s.removePersona);
  const det = p.detalhes || {};
  const chips = (arr?: string[]) =>
    (arr || []).filter(Boolean).map((c, i) => (
      <span key={i} className="chip-rm" style={{ paddingRight: 11 }}>{c}</span>
    ));
  const hasDet =
    (det.consome?.length || det.gosta?.length || det.naoGosta?.length || det.atividades?.length) ? true : false;

  return (
    <div className="card ptinder" style={{ marginBottom: 12 }}>
      <div className="pt-photo" style={{ background: p.cover || "linear-gradient(120deg,#121111,#3a3a3a)" }}>
        {p.foto && (
          <img key={p.foto} src={p.foto} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <span className="pt-emoji">{p.emoji}</span>
      </div>
      <div className="pt-body">
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn-link" onClick={onEdit} title="Editar persona">✏️ Editar</button>
          <button className="btn-link" onClick={() => remove(p.id)} title="Remover persona">✕ Remover</button>
        </div>
        {p.tag && (
          <div className="pt-sec"><div className="pt-l">Tag</div><p>{p.tag}</p></div>
        )}
        <div className="pt-sec"><div className="pt-l">Nome</div><p style={{ fontWeight: 700 }}>{p.nome}</p></div>
        {p.handle && (<div className="pt-sec"><div className="pt-l">Handle</div><p>{p.handle}</p></div>)}
        {p.representa && (<div className="pt-sec"><div className="pt-l">Quem representa</div><p>{p.representa}</p></div>)}
        {p.comunica && (<div className="pt-sec"><div className="pt-l">O que comunica</div><p>{p.comunica}</p></div>)}
        {hasDet && (
          <>
            {det.consome?.filter(Boolean).length ? (
              <div className="pt-sec"><div className="pt-l">O que consome</div><div className="pt-dores">{chips(det.consome)}</div></div>
            ) : null}
            {det.gosta?.filter(Boolean).length ? (
              <div className="pt-sec"><div className="pt-l">O que gosta</div><div className="pt-dores">{chips(det.gosta)}</div></div>
            ) : null}
            {det.naoGosta?.filter(Boolean).length ? (
              <div className="pt-sec"><div className="pt-l">O que não gosta</div><div className="pt-dores">{chips(det.naoGosta)}</div></div>
            ) : null}
            {det.atividades?.filter(Boolean).length ? (
              <div className="pt-sec"><div className="pt-l">Atividades específicas</div><div className="pt-dores">{chips(det.atividades)}</div></div>
            ) : null}
          </>
        )}
        {p.dores.filter(Boolean).length ? (
          <div className="pt-sec"><div className="pt-l">Dores</div><div className="pt-dores">{chips(p.dores)}</div></div>
        ) : null}
        {p.canais && (<div className="pt-sec"><div className="pt-l">Canais</div><p>{p.canais}</p></div>)}
        {p.gatilho && (<div className="pt-sec"><div className="pt-l">Gatilho de conversão</div><p>{p.gatilho}</p></div>)}
        {p.stats.filter((s) => s[0] || s[1]).length ? (
          <div className="pt-sec">
            <div className="pt-l">Stats</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {p.stats.filter((s) => s[0] || s[1]).map((s, i) => (
                <div key={i}>
                  <div className="tnum" style={{ fontSize: 15, fontWeight: 700 }}>{s[0]}</div>
                  <div style={{ fontSize: 11.5, color: "var(--label-3)" }}>{s[1]}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Formulário do construtor ──
interface BForm {
  nomeProprio: string; tag: string; handle: string; emoji: string; cover: string;
  representa: string; comunica: string;
  consome: string[]; gosta: string[]; naoGosta: string[]; atividades: string[];
  dores: string[]; canais: string; gatilho: string; stats: [string, string][]; foto: string;
}

const blankForm = (): BForm => ({
  nomeProprio: "", tag: "", handle: "", emoji: "✨", cover: "linear-gradient(120deg,#121111,#3a3a3a)",
  representa: "", comunica: "", consome: [], gosta: [], naoGosta: [], atividades: [],
  dores: [], canais: "", gatilho: "", stats: [], foto: "",
});

const formFromPersona = (p: PersonaItem): BForm => ({
  nomeProprio: p.detalhes?.nomeProprio || p.nome || "",
  tag: p.tag, handle: p.handle, emoji: p.emoji || "✨", cover: p.cover,
  representa: p.representa, comunica: p.comunica,
  consome: [...(p.detalhes?.consome || [])], gosta: [...(p.detalhes?.gosta || [])],
  naoGosta: [...(p.detalhes?.naoGosta || [])], atividades: [...(p.detalhes?.atividades || [])],
  dores: [...p.dores], canais: p.canais, gatilho: p.gatilho,
  stats: p.stats.map((s) => [s[0], s[1]] as [string, string]), foto: p.foto || "",
});

// limpa strings vazias das chip-lists antes de salvar
const clean = (a: string[]) => a.map((x) => x.trim()).filter(Boolean);

// ── Construtor (modal) ──
function PersonaBuilder({
  mode, persona, onClose,
}: {
  mode: "new" | "edit"; persona?: PersonaItem; onClose: () => void;
}) {
  const addPersona = useStore((s) => s.addPersona);
  const updatePersona = useStore((s) => s.updatePersona);
  const personas = useStore((s) => s.personas);
  const zernioAccounts = useStore((s) => s.zernioAccounts);

  const [f, setF] = useState<BForm>(() => (mode === "edit" && persona ? formFromPersona(persona) : blankForm()));
  const [caminho, setCaminho] = useState<"zero" | "audiencia">("zero");
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [fotoAviso, setFotoAviso] = useState<string | null>(null);

  const upd = (patch: Partial<BForm>) => setF((prev) => ({ ...prev, ...patch }));

  // contas SOCIAIS conectadas que expõem demografia (Instagram / YouTube).
  const demoAccounts = zernioAccounts.filter(
    (a) => (a.platform === "instagram" || a.platform === "youtube") && a.enabled !== false
  );

  // Gera da audiência → PRÉ-PREENCHE o formulário (não cria direto).
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
      const det = d.detalhes || {};
      setF((prev) => ({
        ...prev,
        nomeProprio: det.nomeProprio || d.nome || prev.nomeProprio,
        tag: prev.tag || `Audiência · ${rede}`,
        handle: prev.handle || `@${String(handleBase).replace(/^@/, "")}`,
        emoji: REDE_EMOJI[acc.platform] || prev.emoji,
        cover: REDE_COVER[acc.platform] || prev.cover,
        representa: d.representa || prev.representa,
        comunica: d.comunica || prev.comunica,
        consome: (det.consome && det.consome.length ? det.consome : prev.consome),
        gosta: (det.gosta && det.gosta.length ? det.gosta : prev.gosta),
        naoGosta: (det.naoGosta && det.naoGosta.length ? det.naoGosta : prev.naoGosta),
        atividades: (det.atividades && det.atividades.length ? det.atividades : prev.atividades),
        dores: Array.isArray(d.dores) && d.dores.length ? d.dores : prev.dores,
        canais: prev.canais || d.canais || rede,
        stats: Array.isArray(d.stats) && d.stats.length ? d.stats : prev.stats,
      }));
      setCaminho("zero"); // volta pros campos já preenchidos
    } catch {
      setGenErr("Falha de rede ao gerar a persona.");
    } finally {
      setGenBusy(null);
    }
  };

  // Foto por IA (stub): seta uma prévia determinística e avisa que a geração real vem depois.
  const gerarFoto = async () => {
    if (fotoBusy) return;
    setFotoBusy(true); setFotoAviso(null);
    try {
      const r = await fetch("/api/persona/foto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: f.nomeProprio || f.tag || "persona" }),
      });
      const j = (await r.json().catch(() => null)) as { foto?: string; placeholder?: boolean; pending?: boolean } | null;
      if (j?.foto) {
        upd({ foto: j.foto });
        setFotoAviso("Prévia — geração real por IA em breve.");
      } else {
        setFotoAviso("Geração por IA em breve. Você pode colar uma URL manualmente.");
      }
    } catch {
      // não quebra o construtor se a rota falhar
      setFotoAviso("Não foi possível gerar a prévia agora. Cole uma URL manualmente.");
    } finally {
      setFotoBusy(false);
    }
  };

  const salvar = () => {
    const nome = f.nomeProprio.trim() || "Nova persona";
    const detalhes: PersonaDetalhes = {
      nomeProprio: f.nomeProprio.trim() || undefined,
      consome: clean(f.consome), gosta: clean(f.gosta),
      naoGosta: clean(f.naoGosta), atividades: clean(f.atividades),
    };
    const base = {
      tag: f.tag, handle: f.handle, emoji: f.emoji, cover: f.cover, nome,
      representa: f.representa, comunica: f.comunica,
      dores: clean(f.dores), canais: f.canais, gatilho: f.gatilho,
      stats: f.stats.filter((s) => s[0] || s[1]),
      foto: f.foto || undefined, detalhes,
    };
    if (mode === "edit" && persona) {
      updatePersona(persona.id, base);
    } else {
      addPersona({ id: newId("persona"), ...base, ordem: personas.length });
    }
    onClose();
  };

  // stats helpers
  const setStat = (idx: number, col: 0 | 1, v: string) =>
    upd({ stats: f.stats.map((s, i) => (i === idx ? ((col === 0 ? [v, s[1]] : [s[0], v]) as [string, string]) : s)) });
  const addStat = () => upd({ stats: [...f.stats, ["", ""] as [string, string]] });
  const rmStat = (idx: number) => upd({ stats: f.stats.filter((_, i) => i !== idx) });

  return (
    <div className="pm-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pm" role="dialog" aria-modal="true" style={{ width: "min(620px,100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <b>{mode === "edit" ? "Editar persona" : "Nova persona"}</b>
          <button className="pm-x" aria-label="Fechar" onClick={onClose}>✕</button>
        </div>
        <div className="pm-body">
          {/* caminhos (só na criação) */}
          {mode === "new" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <button
                  type="button"
                  className={`btn-link${caminho === "zero" ? " on" : ""}`}
                  onClick={() => { setCaminho("zero"); setGenErr(null); }}
                >
                  Do zero
                </button>
                <button
                  type="button"
                  className={`btn-link${caminho === "audiencia" ? " on" : ""}`}
                  onClick={() => { setCaminho("audiencia"); setGenErr(null); }}
                >
                  ✨ Gerar da audiência
                </button>
              </div>
              {caminho === "audiencia" && (
                <div style={{ background: "var(--surface)", borderRadius: 10, padding: 12, marginBottom: 6 }}>
                  <p style={{ color: "var(--label-2)", margin: "0 0 10px", fontSize: 12.5 }}>
                    Escolha uma rede conectada com demografia. Montamos uma persona a partir de quem{" "}
                    <b>realmente consome o canal</b> (idade, gênero, cidade) e pré-preenchemos os campos abaixo.
                    Tudo editável antes de salvar.
                  </p>
                  {demoAccounts.length === 0 ? (
                    <p style={{ color: "var(--label-3)", fontSize: 12.5, margin: 0 }}>
                      Nenhuma rede com demografia conectada. Conecte um Instagram ou YouTube em Conexões.
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
                            type="button"
                            className="btn-link"
                            onClick={() => gerar(a)}
                            disabled={!!genBusy}
                            style={{ opacity: genBusy && !busy ? 0.5 : 1 }}
                          >
                            <span style={{ fontSize: 15 }}>{REDE_EMOJI[a.platform] || "✨"}</span>
                            <span style={{ fontWeight: 600 }}>{rede}</span>
                            <span style={{ color: "var(--label-3)", fontSize: 12 }}>· {nome}</span>
                            {busy && <span style={{ color: "var(--cyan)", fontSize: 12 }}>gerando…</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {genErr && <div style={{ marginTop: 10, color: "var(--red)", fontSize: 12.5 }}>{genErr}</div>}
                </div>
              )}
            </>
          )}

          {/* foto + geração IA */}
          <label className="field-lbl">Foto da persona</label>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 68, height: 68, borderRadius: 12, flexShrink: 0, overflow: "hidden",
                display: "grid", placeItems: "center", color: "#fff", fontSize: 30,
                background: f.cover || "linear-gradient(120deg,#121111,#3a3a3a)",
              }}
            >
              {f.foto ? (
                <img key={f.foto} src={f.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <span>{f.emoji}</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input
                className="field-edit"
                value={f.foto}
                placeholder="colar URL da foto"
                autoComplete="off"
                onChange={(e) => { upd({ foto: e.target.value }); setFotoAviso(null); }}
              />
              <div style={{ marginTop: 6 }}>
                <button type="button" className="btn-link" onClick={gerarFoto} disabled={fotoBusy}>
                  {fotoBusy ? "Gerando…" : "✨ Gerar foto (IA)"}
                </button>
              </div>
              {fotoAviso && <div style={{ marginTop: 6, color: "var(--label-3)", fontSize: 12 }}>{fotoAviso}</div>}
            </div>
          </div>

          <div className="pm-row">
            <div>
              <label className="field-lbl">Nome próprio da persona</label>
              <input className="field-edit" value={f.nomeProprio} placeholder="Ex.: Marina, 32"
                onChange={(e) => upd({ nomeProprio: e.target.value })} />
            </div>
            <div>
              <label className="field-lbl">Tag</label>
              <input className="field-edit" value={f.tag} placeholder="P0 · Marca"
                onChange={(e) => upd({ tag: e.target.value })} />
            </div>
          </div>

          <div className="pm-row">
            <div>
              <label className="field-lbl">@handle</label>
              <input className="field-edit" value={f.handle} placeholder="@handle"
                onChange={(e) => upd({ handle: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ width: 84 }}>
                <label className="field-lbl">Emoji</label>
                <input className="field-edit" value={f.emoji} placeholder="🚀"
                  onChange={(e) => upd({ emoji: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-lbl">Cover (CSS)</label>
                <input className="field-edit" value={f.cover} placeholder="linear-gradient(...)"
                  onChange={(e) => upd({ cover: e.target.value })} />
              </div>
            </div>
          </div>

          <label className="field-lbl">Quem representa</label>
          <textarea className="field-edit" rows={2} value={f.representa}
            onChange={(e) => upd({ representa: e.target.value })} />

          <label className="field-lbl">O que comunica</label>
          <textarea className="field-edit" rows={2} value={f.comunica}
            onChange={(e) => upd({ comunica: e.target.value })} />

          <div style={{ marginTop: 9 }}>
            <ChipList label="O que consome" itens={f.consome} placeholder="ex.: podcasts de gestão"
              onChange={(v) => upd({ consome: v })} />
          </div>
          <div style={{ marginTop: 9 }}>
            <ChipList label="O que gosta" itens={f.gosta} placeholder="ex.: transparência"
              onChange={(v) => upd({ gosta: v })} />
          </div>
          <div style={{ marginTop: 9 }}>
            <ChipList label="O que não gosta" itens={f.naoGosta} placeholder="ex.: burocracia"
              onChange={(v) => upd({ naoGosta: v })} />
          </div>
          <div style={{ marginTop: 9 }}>
            <ChipList label="Atividades específicas" itens={f.atividades} placeholder="ex.: vai a eventos de networking"
              onChange={(v) => upd({ atividades: v })} />
          </div>
          <div style={{ marginTop: 9 }}>
            <ChipList label="Dores" itens={f.dores} placeholder="dor"
              onChange={(v) => upd({ dores: v })} />
          </div>

          <div className="pm-row" style={{ marginTop: 9 }}>
            <div>
              <label className="field-lbl">Canais</label>
              <input className="field-edit" value={f.canais}
                onChange={(e) => upd({ canais: e.target.value })} />
            </div>
            <div>
              <label className="field-lbl">Gatilho de conversão</label>
              <input className="field-edit" value={f.gatilho}
                onChange={(e) => upd({ gatilho: e.target.value })} />
            </div>
          </div>

          <label className="field-lbl">Stats</label>
          {f.stats.map((a, j) => (
            <div key={j} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <input className="field-edit" value={a[0]} placeholder="valor"
                onChange={(e) => setStat(j, 0, e.target.value)} style={{ width: 130 }} />
              <input className="field-edit" value={a[1]} placeholder="rótulo"
                onChange={(e) => setStat(j, 1, e.target.value)} />
              <button className="btn-link" type="button" onClick={() => rmStat(j)} aria-label="Remover stat">✕</button>
            </div>
          ))}
          <button className="btn-link" type="button" onClick={addStat}>＋ Stat</button>
        </div>
        <div className="pm-foot">
          <span />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-link" type="button" onClick={onClose}>Cancelar</button>
            <button className="btn-link ig" type="button" onClick={salvar}>
              {mode === "edit" ? "Salvar alterações" : "Criar persona"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PersonaView() {
  const personas = useStore((s) => s.personas);
  const [builder, setBuilder] = useState<{ mode: "new" | "edit"; id?: string } | null>(null);

  const editing = builder?.mode === "edit" ? personas.find((p) => p.id === builder.id) : undefined;

  return (
    <>
      <PageHead
        eyebrow="Estratégia · Inteligência de Personas"
        title="Persona & Público"
        desc="Personas de marca e de conversão do seu público, tratadas como pessoas reais. Crie do zero ou gere a partir da audiência — tudo salvo neste workspace."
        right={
          <button className="btn-link" onClick={() => setBuilder({ mode: "new" })}>＋ Adicionar</button>
        }
      />

      {personas.length === 0 ? (
        <div className="empty">
          <div className="e-ico" style={{ fontSize: 22 }}>🧑‍🤝‍🧑</div>
          <h3>Nenhuma persona ainda</h3>
          <p>Mapeie quem é o seu público — como pessoa real: o que consome, gosta, não gosta, atividades, dores, canais e gatilhos de conversão.</p>
          <button className="btn-link" onClick={() => setBuilder({ mode: "new" })}>＋ Adicionar persona</button>
        </div>
      ) : (
        <Card padLg>
          {personas.map((p) => (
            <PersonaCard key={p.id} p={p} onEdit={() => setBuilder({ mode: "edit", id: p.id })} />
          ))}
        </Card>
      )}

      {builder && (builder.mode === "new" || editing) && (
        <PersonaBuilder
          mode={builder.mode}
          persona={editing}
          onClose={() => setBuilder(null)}
        />
      )}
    </>
  );
}
