"use client";
// Concorrência — CRUD por workspace (persistido). Começa vazio.
// Categorias LIVRES por workspace + canais flexíveis (tipo + URL) por concorrente.
// Logo espelha automaticamente o avatar do Instagram (fallback: clearbit do domínio → inicial).
import { useMemo, useState } from "react";
import { useStore, newId, type ConcItem, type ConcChannel } from "@/lib/store";
import { Segmented, type SegOption } from "@/components/ui";

// ── Metadados de canal: rótulo, cor e ícone (paths internos) ──
const LINK_ICON = '<path d="M9 15l6-6"/><path d="M11 7l1-1a3 3 0 0 1 4 4l-1 1"/><path d="M13 17l-1 1a3 3 0 0 1-4-4l1-1"/>';
const CHANNEL_META: Record<string, { label: string; color: string; icon: string }> = {
  instagram: { label: "Instagram", color: "#E4405F", icon: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/>' },
  site: { label: "Site", color: "#00BBC5", icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 4 3 14 0 18M12 3c-3 4-3 14 0 18"/>' },
  linkedin: { label: "LinkedIn", color: "#0A66C2", icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10.5V17M7 7.2v.01M11 17v-3.5a2 2 0 0 1 4 0V17"/>' },
  youtube: { label: "YouTube", color: "#FF0000", icon: '<rect x="2.5" y="6" width="19" height="12" rx="3.5"/><path d="M10.5 9.6l4.2 2.4-4.2 2.4z"/>' },
  tiktok: { label: "TikTok", color: "#111111", icon: '<path d="M9 9v6.5a2.5 2.5 0 1 1-2.5-2.5"/><path d="M14 4c.4 2.3 2 3.7 4 4"/><path d="M14 4v9.5"/>' },
  x: { label: "X / Twitter", color: "#111111", icon: '<path d="M5 5l14 14M19 5L5 19"/>' },
  facebook: { label: "Facebook", color: "#1877F2", icon: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M14.5 8H13a1.5 1.5 0 0 0-1.5 1.5V11H10v2.2h1.5V18h2.2v-4.8h1.6l.4-2.2h-2V9.7c0-.4.3-.7.7-.7h1.1V8z"/>' },
  threads: { label: "Threads", color: "#111111", icon: '<path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"/><path d="M8.5 13c0 2 1.8 3.2 3.7 3.2 1.8 0 3.1-1.1 3.1-3 0-2.3-2.1-3-4-3"/>' },
  pinterest: { label: "Pinterest", color: "#E60023", icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7c-2 0-3.3 1.4-3.3 3.1 0 .9.4 1.8 1.3 2.1M12 7c2 0 3.2 1.2 3.2 3 0 2.2-1.2 3.9-3 3.9-1 0-1.6-.6-1.6-1.6L11.2 17"/>' },
  whatsapp: { label: "WhatsApp", color: "#25D366", icon: '<path d="M4 20l1.4-3.8A8 8 0 1 1 8.2 18.6L4 20z"/><path d="M9 9.5c.4 2.2 2.3 4.1 4.5 4.5"/>' },
  kwai: { label: "Kwai", color: "#FF6A00", icon: LINK_ICON },
};
function meta(tipo: string) {
  return CHANNEL_META[tipo] ?? { label: tipo || "Canal", color: "#8E8E93", icon: LINK_ICON };
}
// tipos oferecidos no editor (ig e site têm campos dedicados, ficam de fora)
const CHANNEL_TYPES = ["linkedin", "youtube", "tiktok", "x", "facebook", "threads", "pinterest", "whatsapp", "kwai"];

function PiconEl({ tipo }: { tipo: string }) {
  const m = meta(tipo);
  return (
    <span className="picon" title={m.label}>
      <svg viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: m.icon }} />
    </span>
  );
}

function CompCard({ c, cats }: { c: ConcItem; cats: { id: string; label: string }[] }) {
  const update = useStore((s) => s.updateConc);
  const remove = useStore((s) => s.removeConc);

  const hide = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = "none"; };

  const igHandle = (c.ig || "").replace(/[@\s]/g, "");
  const ov = c.iconOverride || "";
  const isEmoji = !!ov && !/^https?:/i.test(ov);
  const imgSrc = /^https?:/i.test(ov)
    ? ov
    : igHandle
      ? `https://unavatar.io/instagram/${igHandle}`
      : c.dominio
        ? `https://logo.clearbit.com/${c.dominio}`
        : "";

  // presença: ig + site + canais (dedupe por tipo)
  const presenca: string[] = [];
  if (igHandle) presenca.push("instagram");
  if (c.dominio) presenca.push("site");
  for (const ch of c.canais || []) if (ch.tipo && !presenca.includes(ch.tipo)) presenca.push(ch.tipo);

  const canais = c.canais || [];
  const setCanais = (next: ConcChannel[]) => update(c.id, { canais: next });
  const addCanal = () => setCanais([...canais, { tipo: "linkedin", url: "" }]);
  const patchCanal = (i: number, patch: Partial<ConcChannel>) => setCanais(canais.map((ch, j) => (j === i ? { ...ch, ...patch } : ch)));
  const delCanal = (i: number) => setCanais(canais.filter((_, j) => j !== i));

  return (
    <div className="comp-card">
      <button className="comp-editbtn" onClick={() => remove(c.id)} aria-label="Remover" title="Remover">✕</button>
      <div className="comp-logo">
        {isEmoji ? (
          <span className="comp-emoji">{ov}</span>
        ) : (
          <>
            {imgSrc && <img src={imgSrc} alt="" loading="lazy" onError={hide} />}
            <span>{(c.nome || "?")[0]}</span>
          </>
        )}
      </div>
      <input className="comp-in" value={c.nome} placeholder="Nome" onChange={(e) => update(c.id, { nome: e.target.value })} style={{ marginBottom: 6 }} />
      {presenca.length > 0 && (
        <div className="comp-icons" style={{ marginBottom: 8 }}>
          {presenca.map((t) => <PiconEl key={t} tipo={t} />)}
        </div>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        <input className="comp-in" value={c.ig} placeholder="@instagram (vira a logo)" onChange={(e) => update(c.id, { ig: e.target.value })} />
        <input className="comp-in" value={c.dominio || ""} placeholder="domínio.com.br" onChange={(e) => update(c.id, { dominio: e.target.value })} />

        {/* canais flexíveis */}
        {canais.map((ch, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="comp-in"
              list="conc-canal-tipos"
              value={ch.tipo}
              placeholder="canal"
              onChange={(e) => patchCanal(i, { tipo: e.target.value.trim().toLowerCase() })}
              style={{ flex: "0 0 96px" }}
            />
            <input
              className="comp-in"
              value={ch.url}
              placeholder="URL"
              onChange={(e) => patchCanal(i, { url: e.target.value })}
              style={{ flex: 1 }}
            />
            <button type="button" className="comp-editbtn" style={{ position: "static" }} onClick={() => delCanal(i)} title="Remover canal" aria-label="Remover canal">✕</button>
          </div>
        ))}
        <button type="button" className="btn-link" style={{ justifyContent: "center", padding: "5px 10px", fontSize: 12 }} onClick={addCanal}>＋ canal</button>

        <input className="comp-in" value={c.iconOverride || ""} placeholder="Logo manual (URL ou emoji)" onChange={(e) => update(c.id, { iconOverride: e.target.value })} />

        <select className="comp-in" value={c.categoria} onChange={(e) => update(c.id, { categoria: e.target.value })}>
          <option value="">— sem categoria —</option>
          {cats.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
          {c.categoria && !cats.some((cat) => cat.id === c.categoria) && <option value={c.categoria}>{c.categoria}</option>}
        </select>
      </div>
    </div>
  );
}

// rótulos legados do Seahub (usados só pra derivar tabs de dados antigos)
const LEGACY_LABELS: Record<string, string> = {
  espaco: "Espaço & EV", marca: "Registro de Marca", certificado: "Certificado Digital", cobranca: "Cobrança",
};

export default function ConcorrenciaView() {
  const concorrentes = useStore((s) => s.concorrentes);
  const concCategorias = useStore((s) => s.concCategorias);
  const addConc = useStore((s) => s.addConc);
  const setConcCategorias = useStore((s) => s.setConcCategorias);
  const addConcCategoria = useStore((s) => s.addConcCategoria);
  const renameConcCategoria = useStore((s) => s.renameConcCategoria);
  const removeConcCategoria = useStore((s) => s.removeConcCategoria);
  const concProd = useStore((s) => s.concProd);
  const set = useStore((s) => s.set);
  const sel = concProd || "geral";

  const [manage, setManage] = useState(false);
  const [novaCat, setNovaCat] = useState("");

  // tabs efetivas: concCategorias (fonte de verdade) ou derivadas dos concorrentes existentes
  const derived = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of concorrentes) {
      const id = (c.categoria || "").trim();
      if (id && !seen.has(id)) seen.set(id, LEGACY_LABELS[id] || id);
    }
    return [...seen].map(([id, label]) => ({ id, label }));
  }, [concorrentes]);
  const cats = concCategorias.length ? concCategorias : derived;

  const seedIfEmpty = () => { if (!concCategorias.length && derived.length) setConcCategorias(derived); };

  const list = sel === "geral" ? concorrentes : concorrentes.filter((c) => c.categoria === sel);
  const options: SegOption[] = [{ value: "geral", label: "Geral" }, ...cats.map((c) => ({ value: c.id, label: c.label }))];

  const add = () => {
    const categoria = sel !== "geral" ? sel : cats[0]?.id || "";
    addConc({ id: newId("conc"), nome: "Novo concorrente", ig: "", canais: [], categoria, ordem: concorrentes.length });
  };

  const onAddCat = () => {
    const v = novaCat.trim();
    if (!v) return;
    seedIfEmpty();
    const id = addConcCategoria(v);
    setNovaCat("");
    if (id) set({ concProd: id });
  };
  const onRemoveCat = (id: string) => {
    seedIfEmpty();
    removeConcCategoria(id);
    if (sel === id) set({ concProd: "geral" });
  };

  return (
    <>
      {/* datalist compartilhada pros tipos de canal */}
      <datalist id="conc-canal-tipos">
        {CHANNEL_TYPES.map((t) => <option key={t} value={t}>{meta(t).label}</option>)}
      </datalist>

      <div className="page-head">
        <div>
          <div className="eyebrow">Estratégia · Benchmark</div>
          <h2>Concorrência</h2>
          <p>
            <b>Nada se cria, tudo se copia.</b> Concorrentes e referências por categoria — categorias e canais são do seu workspace (crie os seus). Ícone colorido = presença no canal.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Segmented small options={options} value={sel} onChange={(v) => set({ concProd: v })} />
          <button className="btn-link" onClick={() => setManage((m) => !m)} aria-expanded={manage}>⚙ Categorias</button>
          <button className="btn-link" onClick={add}>＋ Adicionar</button>
        </div>
      </div>

      {manage && (
        <div className="card" style={{ padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Categorias do workspace</div>
          <p style={{ fontSize: 12, color: "var(--label-2)", margin: 0 }}>
            Crie, renomeie ou remova. Remover uma categoria não apaga concorrentes — eles ficam sem categoria (visíveis em “Geral”).
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {cats.length === 0 && <div style={{ fontSize: 12, color: "var(--label-2)" }}>Nenhuma categoria ainda.</div>}
            {cats.map((cat) => (
              <div key={cat.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  className="comp-in"
                  value={cat.label}
                  onChange={(e) => { seedIfEmpty(); renameConcCategoria(cat.id, e.target.value); }}
                  style={{ flex: 1 }}
                />
                <button type="button" className="comp-editbtn" style={{ position: "static" }} onClick={() => onRemoveCat(cat.id)} title="Remover categoria" aria-label="Remover categoria">✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="comp-in"
              value={novaCat}
              placeholder="Nova categoria (ex.: Coworking)"
              onChange={(e) => setNovaCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onAddCat(); }}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn-link" onClick={onAddCat}>＋ Criar</button>
          </div>
        </div>
      )}

      {concorrentes.length === 0 ? (
        <div className="empty">
          <div className="e-ico">🥊</div>
          <h3>Nenhum concorrente ainda</h3>
          <p>Cadastre concorrentes e referências por categoria para acompanhar a presença deles por canal.</p>
          <button className="btn-link" onClick={add}>＋ Adicionar concorrente</button>
        </div>
      ) : (
        <div className="comp-grid">
          {list.map((c) => <CompCard key={c.id} c={c} cats={cats} />)}
        </div>
      )}
    </>
  );
}
