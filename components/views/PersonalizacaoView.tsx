"use client";
// Porta a viewConfig do blueprint (linhas 1344-1393) + helpers de import/CSV,
// chip lists, matriz de relação, toggles de redes e acordeões de indicadores.
// Fidelidade 1:1 com casinha-do-marketing.html.
// UX: cada seção é um card colapsável (.psec) com acento de cor próprio; só "Conexões" abre por padrão.
import { useState, type CSSProperties, type ReactNode } from "react";
import { PageHead } from "@/components/ui";
import { ConexoesGrid } from "@/components/ConexoesGrid";
import { Ic } from "@/components/Ic";
import { REDES, PANEL_INDICATORS } from "@/lib/seed-data";
import { useStore, newId, type FonteItem } from "@/lib/store";

/* ===== helpers CSV (blueprint 1292-1306) ===== */
function parseCSV(text: string): { cols: string[]; rows: string[][]; total: number } {
  const lines = String(text).replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  if (!lines.length) return { cols: [], rows: [], total: 0 };
  const sp = (l: string) => {
    const out: string[] = [];
    let cur = "",
      q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') {
        q = !q;
      } else if ((c === "," || c === ";") && !q) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim().replace(/^"|"$/g, ""));
  };
  const cols = sp(lines[0]);
  const rows = lines.slice(1, 6).map(sp);
  return { cols, rows, total: lines.length - 1 };
}
function detectType(vals: (string | undefined)[]): string {
  const v = (vals || []).filter((x) => x !== "" && x != null) as string[];
  if (!v.length) return "texto";
  if (v.every((x) => /^-?[\d.,]+%?$/.test(String(x).trim()))) return "número";
  if (v.every((x) => /\d{1,4}[\/-]\d{1,2}/.test(String(x)))) return "data";
  return "texto";
}
// Extensão → tipo suportado pelo store (csv | xlsx | pdf).
function extTipo(ext: string): "csv" | "xlsx" | "pdf" {
  if (ext === "csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  return "pdf";
}

/* ===== PSection: card de seção colapsável, com acento de cor por seção ===== */
function PSection({
  title,
  sub,
  accent,
  meta,
  action,
  defaultOpen = false,
  children,
}: {
  title: string;
  sub?: string;
  accent: string;
  meta?: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`psec${open ? " open" : ""}`} style={{ "--psec-accent": accent } as CSSProperties}>
      <div
        className="psec-h"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <span className="psec-badge" aria-hidden="true" />
        <div className="psec-titles">
          <div className="psec-t">{title}</div>
          {sub ? <div className="psec-sub">{sub}</div> : null}
        </div>
        <span className="psec-meta">
          {meta}
          {action ? (
            <span className="psec-act" onClick={(e) => e.stopPropagation()}>
              {action}
            </span>
          ) : null}
          <svg className="psec-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
      {open ? <div className="psec-body">{children}</div> : null}
    </div>
  );
}

/* ===== DropZone: área de upload com estado "arrastando" ===== */
function DropZone({
  accept,
  onFile,
  title,
  hint,
}: {
  accept: string;
  onFile: (file?: File | null) => void;
  title: string;
  hint: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`drop${over ? " over" : ""}`}
      role="button"
      aria-label={title}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="di">
        <Ic name="upload" />
      </div>
      <h4>{title}</h4>
      <p>{hint}</p>
      <input type="file" accept={accept} style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
    </label>
  );
}

export default function PersonalizacaoView() {
  const perfil = useStore((s) => s.perfil);
  const setPerfil = useStore((s) => s.setPerfil);
  const toggleRelacao = useStore((s) => s.toggleRelacao);
  const addChip = useStore((s) => s.addChip);
  const removeChip = useStore((s) => s.removeChip);
  const redes = useStore((s) => s.redes);
  const toggleRede = useStore((s) => s.toggleRede);
  const ind = useStore((s) => s.ind);
  const setInd = useStore((s) => s.setInd);
  const paineis = useStore((s) => s.paineis);
  const setPainelInd = useStore((s) => s.setPainelInd);
  const cfgOpen = useStore((s) => s.cfgOpen);
  const toggleCfgOpen = useStore((s) => s.toggleCfgOpen);
  const fontes = useStore((s) => s.fontes);
  const addFonte = useStore((s) => s.addFonte);
  const fonteMap = useStore((s) => s.fonteMap);
  const setFonteMap = useStore((s) => s.setFonteMap);
  const set = useStore((s) => s.set);
  const setZernioAccounts = useStore((s) => s.setZernioAccounts);

  // Kit do Panteão: só nome do arquivo (extração no backend — OpenClaw).
  const [kit, setKit] = useState<string | null>(null);

  async function refreshConx() {
    try {
      const r = await fetch("/api/zernio/accounts");
      const d = await r.json();
      if (d?.accounts) setZernioAccounts(d.accounts);
    } catch {}
  }

  /* ===== shownInd (blueprint 1233) ===== */
  function shownInd(panel: string, id: string): boolean {
    if (panel === "instagram") return ind[id] !== false;
    const p = paineis[panel];
    return !p || p[id] !== false;
  }
  function togglePanelInd(panel: string, id: string) {
    if (panel === "instagram") setInd(id, !shownInd(panel, id));
    else setPainelInd(panel, id, !shownInd(panel, id));
  }
  function panelIndCount(panel: string): string {
    let on = 0,
      tot = 0;
    (PANEL_INDICATORS[panel] || []).forEach((gp) =>
      gp.i.forEach((it) => {
        tot++;
        if (shownInd(panel, it.id)) on++;
      })
    );
    return on + "/" + tot;
  }

  /* ===== import de arquivos (blueprint 1307-1328) ===== */
  function handleKitFile(file?: File | null) {
    if (!file) return;
    // TODO(openclaw): extração do PDF do kit roda no backend; aqui só registramos o nome.
    setKit(file.name || "arquivo");
  }
  function handleFonteFile(file?: File | null) {
    if (!file) return;
    const name = file.name || "arquivo";
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "csv") {
      const rd = new FileReader();
      rd.onload = () => {
        const p = parseCSV(String(rd.result));
        const campos = p.cols.map((nome, i) => {
          const vals = p.rows.map((r) => r[i]);
          const tipo = detectType(vals);
          return { nome: nome || "coluna " + (i + 1), tipo, usar: tipo === "número" };
        });
        setFonteMap({ nome: name, tipo: "csv", linhas: p.total, campos, preview: p.rows });
      };
      rd.readAsText(file);
    } else {
      // TODO(openclaw): XLSX/PDF são interpretados no backend — adiciona como pendente.
      setFonteMap({ nome: name, tipo: extTipo(ext), linhas: 0, campos: [], preview: [] });
    }
  }
  function toggleField(i: number) {
    if (!fonteMap) return;
    setFonteMap({ ...fonteMap, campos: fonteMap.campos.map((c, idx) => (idx === i ? { ...c, usar: !c.usar } : c)) });
  }
  function confirmFonte() {
    if (!fonteMap) return;
    const pendente = fonteMap.tipo !== "csv";
    const usados = pendente ? 0 : fonteMap.campos.filter((c) => c.usar).length;
    const fonte: FonteItem = {
      id: newId("fonte"),
      nome: fonteMap.nome,
      tipo: fonteMap.tipo,
      campos: pendente ? 0 : fonteMap.campos.length,
      usados,
      linhas: pendente ? 0 : fonteMap.linhas,
      pendente,
    };
    addFonte(fonte);
    setFonteMap(null);
  }
  function removeFonte(id: string) {
    set({ fontes: fontes.filter((f) => f.id !== id) });
  }

  const p = perfil;

  return (
    <>
      <PageHead
        eyebrow="CONFIGURAÇÃO"
        title="Personalização"
        desc="No primeiro acesso, importe o kit de pré-trabalho do Panteão para pré-preencher o ambiente. Depois, mantenha canais, produtos e indicadores por aqui."
      />

      {/* ===== Conexões ===== */}
      <PSection
        title="Conexões"
        sub="Conecte as contas do cliente direto por aqui — login na própria rede, sem entrar na Zernio. As métricas aparecem nos painéis depois."
        accent="var(--red)"
        action={
          <button className="btn-link" onClick={refreshConx} type="button">
            Atualizar
          </button>
        }
      >
        <ConexoesGrid grupos={["social", "conversas", "ads"]} />
      </PSection>

      {/* ===== Importe seus dados ===== */}
      <PSection
        title="Importe seus dados"
        sub="kit do Panteão + planilhas e documentos (CSV, XLSX, PDF)"
        accent="var(--excelente)"
        meta={
          <span className="psec-count">
            {kit ? "kit ✓" : "kit —"} · {fontes.length} fonte(s)
          </span>
        }
      >
        <div className="imp-body">
          <div className="imp-sub">
            <div className="imp-sub-h">
              Kit do Panteão<span className="imp-sub-t">importação única · extração no backend</span>
            </div>
            {kit ? (
              <div className="file-chip">
                <div className="fi">PDF</div>
                <div>
                  <b>{kit}</b>
                  <span>ambiente pré-preenchido a partir do kit</span>
                </div>
                <button className="x" onClick={() => setKit(null)} aria-label="Remover" type="button">
                  ✕
                </button>
              </div>
            ) : (
              <DropZone
                accept="application/pdf"
                onFile={handleKitFile}
                title="Arraste o PDF ou clique para enviar"
                hint="Só no primeiro acesso · pré-preenche canais, produtos e serviços"
              />
            )}
          </div>

          <div className="imp-sub">
            <div className="imp-sub-h">
              Planilhas & documentos{fontes.length ? <span className="badge"> {fontes.length}</span> : null}
            </div>
            {fontes.map((f) => (
              <div className="file-chip" key={f.id}>
                <div className="fi">{(f.tipo || "").toUpperCase()}</div>
                <div>
                  <b>{f.nome}</b>
                  <span>
                    {f.pendente
                      ? "pendente · interpretação no backend (OpenClaw)"
                      : `${f.usados} de ${f.campos} campos · ${f.linhas} linhas`}
                  </span>
                </div>
                <button className="x" onClick={() => removeFonte(f.id)} aria-label="Remover" type="button">
                  ✕
                </button>
              </div>
            ))}
            {fonteMap ? (
              <InterpretPanel
                fonteMap={fonteMap}
                onCancel={() => setFonteMap(null)}
                onToggleField={toggleField}
                onConfirm={confirmFonte}
              />
            ) : (
              <DropZone
                accept=".csv,.xlsx,.xls,.pdf"
                onFile={handleFonteFile}
                title="Arraste CSV, XLSX ou PDF ou clique para enviar"
                hint="CSV é lido aqui na hora · XLSX e PDF interpretados no backend (OpenClaw)"
              />
            )}
          </div>

          <div className="tfoot-note">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9A9AA0"
              strokeWidth={2}
              style={{ flex: "0 0 14px", marginTop: 1 }}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v4h1" />
            </svg>{" "}
            Leitura do PDF e interpretação inteligente rodam no backend (Lovable/OpenClaw). O CSV é parseado aqui; a seleção de campos é manual.
          </div>
        </div>
      </PSection>

      {/* ===== Ambiente ===== */}
      <PSection title="Ambiente" accent="var(--ink)">
        <div className="pm-row">
          <div>
            <label className="field-lbl">Empresa / marca</label>
            <input className="field-edit" value={p.empresa} onChange={(e) => setPerfil({ empresa: e.target.value })} aria-label="Empresa" />
          </div>
          <div>
            <label className="field-lbl">Segmento</label>
            <input
              className="field-edit"
              value={p.segmento || ""}
              onChange={(e) => setPerfil({ segmento: e.target.value })}
              placeholder="Ex.: Coworking / imobiliário"
            />
          </div>
        </div>
        <div className="pm-row" style={{ marginTop: 9 }}>
          <div>
            <label className="field-lbl">Cidade</label>
            <input
              className="field-edit"
              value={p.cidade || ""}
              onChange={(e) => setPerfil({ cidade: e.target.value })}
              placeholder="Natal/RN"
            />
          </div>
          <div>
            <label className="field-lbl">Site</label>
            <input
              className="field-edit"
              value={p.site || ""}
              onChange={(e) => setPerfil({ site: e.target.value })}
              placeholder="seahubcoworking.com.br"
            />
          </div>
        </div>
      </PSection>

      {/* ===== Canais trabalhados / Produtos & serviços ===== */}
      <div className="grid two-col psec-grid" style={{ marginBottom: 16 }}>
        <PSection
          title="Canais trabalhados"
          accent="var(--cyan)"
          meta={<span className="psec-count">{p.canais.length}</span>}
        >
          <ChipList kind="canais" items={p.canais} onAdd={addChip} onRemove={removeChip} />
        </PSection>
        <PSection
          title="Produtos & serviços"
          accent="var(--atencao)"
          meta={<span className="psec-count">{p.produtos.length}</span>}
        >
          <ChipList kind="produtos" items={p.produtos} onAdd={addChip} onRemove={removeChip} />
        </PSection>
      </div>

      {/* ===== Relação canais × produtos ===== */}
      <PSection
        title="Relação canais × produtos"
        sub="Marque quais canais trabalham cada produto — conecta os dois ambientes acima"
        accent="var(--red)"
      >
        {p.produtos.length && p.canais.length ? (
          <div className="rel-scroll">
            <table className="rel-tbl">
              <thead>
                <tr>
                  <th></th>
                  {p.canais.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.produtos.map((pr) => (
                  <tr key={pr}>
                    <td className="rel-prod">{pr}</td>
                    {p.canais.map((c) => {
                      const on = (p.relacao || {})[c + "|" + pr];
                      return (
                        <td key={c}>
                          <button
                            className={`rel-cell ${on ? "on" : ""}`}
                            onClick={() => toggleRelacao(c + "|" + pr)}
                            aria-label={`${c} para ${pr}`}
                            type="button"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="pm-hint">Adicione canais e produtos acima para relacioná-los.</div>
        )}
      </PSection>

      {/* ===== Redes & canais ===== */}
      <PSection
        title="Redes & canais"
        sub="Ative o que você gerencia — conexão via Zernio (OAuth hospedado, 1 clique). Redes sociais habilitam painel."
        accent="var(--cyan)"
      >
        <div className="ind-panel first">
          <div className="ind-h">Social</div>
          {REDES.filter((r) => r.grupo === "social").map((r) => (
            <RedeToggle key={r.id} rede={r} on={!!redes[r.id]} onToggle={() => toggleRede(r.id)} />
          ))}
        </div>
        <div className="ind-panel">
          <div className="ind-h">Conversas</div>
          {REDES.filter((r) => r.grupo === "conversas").map((r) => (
            <RedeToggle key={r.id} rede={r} on={!!redes[r.id]} onToggle={() => toggleRede(r.id)} />
          ))}
        </div>
        <div className="ind-panel">
          <div className="ind-h">Ads</div>
          {REDES.filter((r) => r.grupo === "ads").map((r) => (
            <RedeToggle key={r.id} rede={r} on={!!redes[r.id]} onToggle={() => toggleRede(r.id)} />
          ))}
        </div>
      </PSection>

      {/* ===== Indicadores dos painéis ===== */}
      <PSection
        title="Indicadores dos painéis"
        sub="Escolha o que aparece em cada ambiente — clique num painel para expandir"
        accent="var(--atencao)"
      >
        <CfgAccordion
          panel="overview"
          label="Painel"
          open={!!cfgOpen.overview}
          count={panelIndCount("overview")}
          shownInd={shownInd}
          onToggleOpen={() => toggleCfgOpen("overview")}
          onToggleInd={togglePanelInd}
        />
        {redes.instagram && (
          <CfgAccordion
            panel="instagram"
            label="Instagram"
            open={!!cfgOpen.instagram}
            count={panelIndCount("instagram")}
            shownInd={shownInd}
            onToggleOpen={() => toggleCfgOpen("instagram")}
            onToggleInd={togglePanelInd}
          />
        )}
        {redes.tiktok && (
          <CfgAccordion
            panel="tiktok"
            label="TikTok"
            open={!!cfgOpen.tiktok}
            count={panelIndCount("tiktok")}
            shownInd={shownInd}
            onToggleOpen={() => toggleCfgOpen("tiktok")}
            onToggleInd={togglePanelInd}
          />
        )}
        {redes.linkedin && (
          <CfgAccordion
            panel="linkedin"
            label="LinkedIn"
            open={!!cfgOpen.linkedin}
            count={panelIndCount("linkedin")}
            shownInd={shownInd}
            onToggleOpen={() => toggleCfgOpen("linkedin")}
            onToggleInd={togglePanelInd}
          />
        )}
        {redes.youtube && (
          <CfgAccordion
            panel="youtube"
            label="YouTube"
            open={!!cfgOpen.youtube}
            count={panelIndCount("youtube")}
            shownInd={shownInd}
            onToggleOpen={() => toggleCfgOpen("youtube")}
            onToggleInd={togglePanelInd}
          />
        )}
        <CfgAccordion
          panel="metas"
          label="Metas"
          open={!!cfgOpen.metas}
          count={panelIndCount("metas")}
          shownInd={shownInd}
          onToggleOpen={() => toggleCfgOpen("metas")}
          onToggleInd={togglePanelInd}
        />
      </PSection>
    </>
  );
}

/* ===== chipList (blueprint 1135) ===== */
function ChipList({
  kind,
  items,
  onAdd,
  onRemove,
}: {
  kind: "canais" | "produtos";
  items: string[];
  onAdd: (field: "canais" | "produtos", v: string) => void;
  onRemove: (field: "canais" | "produtos", v: string) => void;
}) {
  const [val, setVal] = useState("");
  return (
    <>
      <div className="chips-edit" data-kind={kind}>
        {items.map((c) => (
          <span className="chip-rm" key={c}>
            {c}
            <button onClick={() => onRemove(kind, c)} aria-label={`Remover ${c}`} type="button">
              ✕
            </button>
          </span>
        ))}
      </div>
      <input
        className="chip-input"
        data-kind={kind}
        placeholder="+ adicionar e Enter"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = val.trim();
            if (v) onAdd(kind, v);
            setVal("");
          }
        }}
      />
    </>
  );
}

/* ===== redeToggle (blueprint 1235) ===== */
function RedeToggle({ rede, on, onToggle }: { rede: (typeof REDES)[number]; on: boolean; onToggle: () => void }) {
  const sub =
    rede.grupo === "conversas"
      ? on
        ? "conectado · calendário e contas"
        : "ative para agendar mensagens"
      : rede.grupo === "ads"
      ? on
        ? "conectado · Canais Pagos e boost"
        : "ative para vincular investimento"
      : on
      ? "painel ativo na navegação"
      : "ative para habilitar o painel";
  return (
    <div className="toggle-row">
      <div className="tinfo">
        <b>
          <span className="rede-dot" style={{ background: rede.cor }}></span>
          {rede.label}
        </b>
        <span>{sub}</span>
      </div>
      <button
        className={`switch ${on ? "on" : ""}`}
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        aria-label={rede.label}
        type="button"
      />
    </div>
  );
}

/* ===== cfgAccordion (blueprint 1237-1243) ===== */
function CfgAccordion({
  panel,
  label,
  open,
  count,
  shownInd,
  onToggleOpen,
  onToggleInd,
}: {
  panel: string;
  label: string;
  open: boolean;
  count: string;
  shownInd: (panel: string, id: string) => boolean;
  onToggleOpen: () => void;
  onToggleInd: (panel: string, id: string) => void;
}) {
  const groups = PANEL_INDICATORS[panel];
  if (!groups) return null;
  return (
    <div className={`acc ${open ? "open" : ""}`}>
      <button className="acc-h" onClick={onToggleOpen} type="button">
        <span className="acc-t">{label}</span>
        <span className="acc-meta">
          {count}
          <svg className="acc-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="acc-body">
          {groups.map((gp) => (
            <div className="ind-grp" key={gp.g}>
              <div className="ind-h">{gp.g}</div>
              {gp.i.map((it) => {
                const on = shownInd(panel, it.id);
                return (
                  <div className="toggle-row" key={it.id}>
                    <div className="tinfo">
                      <b>{it.label}</b>
                      {it.desc ? <span>{it.desc}</span> : null}
                    </div>
                    <button
                      className={`switch ${on ? "on" : ""}`}
                      onClick={() => onToggleInd(panel, it.id)}
                      role="switch"
                      aria-checked={on}
                      aria-label={it.label}
                      type="button"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== interpretPanel (blueprint 1330-1343) ===== */
function InterpretPanel({
  fonteMap,
  onCancel,
  onToggleField,
  onConfirm,
}: {
  fonteMap: NonNullable<ReturnType<typeof useStore.getState>["fonteMap"]>;
  onCancel: () => void;
  onToggleField: (i: number) => void;
  onConfirm: () => void;
}) {
  const pendente = fonteMap.tipo !== "csv";
  if (pendente) {
    return (
      <div className="fonte-map">
        <div className="fm-h">{fonteMap.nome}</div>
        <div className="pm-hint">
          Arquivos <b>{(fonteMap.tipo || "").toUpperCase()}</b> são interpretados no backend (OpenClaw), que lê o conteúdo e sugere os
          campos. No preview, adicione como fonte pendente.
        </div>
        <div className="fm-acts">
          <button className="btn-link" onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className="btn-link ig" onClick={onConfirm} type="button">
            Adicionar como pendente
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="fonte-map">
      <div className="fm-h">
        {fonteMap.nome} <span className="fm-meta">{fonteMap.linhas} linhas · {fonteMap.campos.length} campos</span>
      </div>
      <div className="pm-hint">
        A IA detectou os campos abaixo (numéricos pré-selecionados). Escolha os que viram indicadores — o OpenClaw refina essa sugestão em
        produção.
      </div>
      <div className="fm-fields">
        {fonteMap.campos.map((c, i) => (
          <label className="fm-field" key={i}>
            <input type="checkbox" checked={c.usar} onChange={() => onToggleField(i)} />
            <span className="fm-fn">{c.nome}</span>
            <span className="fm-ft">{c.tipo}</span>
          </label>
        ))}
      </div>
      <div className="fm-prev">
        <table>
          <thead>
            <tr>
              {fonteMap.campos.map((c, i) => (
                <th key={i}>{c.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fonteMap.preview.map((r, ri) => (
              <tr key={ri}>
                {fonteMap.campos.map((c, i) => (
                  <td key={i}>{r[i] != null ? r[i] : ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fm-acts">
        <button className="btn-link" onClick={onCancel} type="button">
          Cancelar
        </button>
        <button className="btn-link ig" onClick={onConfirm} type="button">
          Adicionar como fonte
        </button>
      </div>
    </div>
  );
}
