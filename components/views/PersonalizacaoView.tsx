"use client";
// Porta a viewConfig do blueprint (linhas 1344-1393) + helpers de import/CSV,
// chip lists, matriz de relação, toggles de redes e acordeões de indicadores.
// Fidelidade 1:1 com casinha-do-marketing.html.
// UX: cada seção é um card colapsável (.psec) com acento de cor próprio; só "Conexões" abre por padrão.
import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import { PageHead } from "@/components/ui";
import { parseBR, fmt } from "@/lib/format";
import { ConexoesGrid } from "@/components/ConexoesGrid";
import { Ic } from "@/components/Ic";
import { REDES, PANEL_INDICATORS, type IndGroup } from "@/lib/seed-data";
import { SOCIAL_IDS, META } from "@/lib/nav";
import { socialIndGroups, indShown, isSocialPanel, socialCatalog } from "@/lib/indicators";
import { useStore, newId, type FonteItem, type CustomInd } from "@/lib/store";

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
  const customInd = useStore((s) => s.customInd);
  const addCustomInd = useStore((s) => s.addCustomInd);
  const removeCustomInd = useStore((s) => s.removeCustomInd);
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

  /* ===== indicadores: base da doc / catálogo social + custom ===== */
  // grupos do painel: redes sociais usam o catálogo Zernio; demais, PANEL_INDICATORS da doc
  function groupsFor(panel: string): IndGroup[] {
    return isSocialPanel(panel) ? socialIndGroups(panel) : PANEL_INDICATORS[panel] || [];
  }
  function shownInd(panel: string, id: string): boolean {
    if (isSocialPanel(panel)) return indShown(paineis, panel, id);
    const p = paineis[panel];
    return !p || p[id] !== false;
  }
  function togglePanelInd(panel: string, id: string) {
    // usa setInd só nos painéis não-sociais legados do Instagram (compat); social vai por paineis
    setPainelInd(panel, id, !shownInd(panel, id));
  }
  function panelIndCount(panel: string): string {
    let on = 0,
      tot = 0;
    groupsFor(panel).forEach((gp) =>
      gp.i.forEach((it) => {
        tot++;
        if (shownInd(panel, it.id)) on++;
      })
    );
    (customInd[panel] || []).forEach(() => { tot++; on++; });
    return on + "/" + tot;
  }
  // métricas Zernio disponíveis pra vincular num indicador custom (só painéis sociais)
  function metricOptions(panel: string): { key: string; label: string }[] {
    if (!isSocialPanel(panel)) return [];
    return socialCatalog(panel)
      .filter((c) => c.bind.src === "metric")
      .map((c) => ({ key: (c.bind as { key: string }).key, label: c.label }));
  }
  void ind; void setInd;

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
        sub="Conecte as contas do cliente direto por aqui — login seguro direto na própria rede. As métricas aparecem nos painéis depois."
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

      {/* ===== Importar histórico ===== */}
      <PSection
        title="Importar histórico"
        sub="traga os totais mensais das planilhas antigas (pré-90 dias) que a integração não puxa"
        accent="var(--critico)"
      >
        <HistoricoImport />
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
        sub="Ative o que você gerencia — conexão de contas (login seguro OAuth, 1 clique). Redes sociais habilitam painel."
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
          groups={groupsFor("overview")}
          custom={customInd.overview || []}
          metricOpts={metricOptions("overview")}
          shownInd={shownInd}
          onToggleOpen={() => toggleCfgOpen("overview")}
          onToggleInd={togglePanelInd}
          onAddCustom={addCustomInd}
          onRemoveCustom={removeCustomInd}
        />
        {SOCIAL_IDS.filter((id) => redes[id]).map((id) => (
          <CfgAccordion
            key={id}
            panel={id}
            label={META[id]?.label || id}
            open={!!cfgOpen[id]}
            count={panelIndCount(id)}
            groups={groupsFor(id)}
            custom={customInd[id] || []}
            metricOpts={metricOptions(id)}
            shownInd={shownInd}
            onToggleOpen={() => toggleCfgOpen(id)}
            onToggleInd={togglePanelInd}
            onAddCustom={addCustomInd}
            onRemoveCustom={removeCustomInd}
          />
        ))}
        <CfgAccordion
          panel="metas"
          label="Metas"
          open={!!cfgOpen.metas}
          count={panelIndCount("metas")}
          groups={groupsFor("metas")}
          custom={customInd.metas || []}
          metricOpts={metricOptions("metas")}
          shownInd={shownInd}
          onToggleOpen={() => toggleCfgOpen("metas")}
          onToggleInd={togglePanelInd}
          onAddCustom={addCustomInd}
          onRemoveCustom={removeCustomInd}
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

/* ===== cfgAccordion — toggles da base (doc/catálogo) + indicadores custom ===== */
function CfgAccordion({
  panel,
  label,
  open,
  count,
  groups,
  custom,
  metricOpts,
  shownInd,
  onToggleOpen,
  onToggleInd,
  onAddCustom,
  onRemoveCustom,
}: {
  panel: string;
  label: string;
  open: boolean;
  count: string;
  groups: IndGroup[];
  custom: CustomInd[];
  metricOpts: { key: string; label: string }[];
  shownInd: (panel: string, id: string) => boolean;
  onToggleOpen: () => void;
  onToggleInd: (panel: string, id: string) => void;
  onAddCustom: (panel: string, c: CustomInd) => void;
  onRemoveCustom: (panel: string, id: string) => void;
}) {
  const [novo, setNovo] = useState("");
  const [metric, setMetric] = useState("");
  if (!groups.length && !metricOpts.length) return null;

  function add() {
    const lbl = novo.trim();
    if (!lbl) return;
    onAddCustom(panel, { id: newId("cind"), label: lbl, kind: "kpi", metric: metric || undefined });
    setNovo("");
    setMetric("");
  }

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

          {/* Indicadores criados pelo perfil */}
          <div className="ind-grp">
            <div className="ind-h">Meus indicadores</div>
            {custom.map((c) => (
              <div className="toggle-row" key={c.id}>
                <div className="tinfo">
                  <b>{c.label}</b>
                  <span>{c.metric ? `vinculado · ${metricOpts.find((m) => m.key === c.metric)?.label || c.metric}` : "manual"}</span>
                </div>
                <button className="x" onClick={() => onRemoveCustom(panel, c.id)} aria-label={`Remover ${c.label}`} type="button">✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                className="chip-input"
                style={{ flex: "1 1 160px" }}
                placeholder="+ novo indicador"
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              />
              {metricOpts.length > 0 && (
                <select className="field-edit" style={{ flex: "0 1 170px" }} value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Vincular métrica">
                  <option value="">manual (sem vínculo)</option>
                  {metricOpts.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              )}
              <button className="btn-link ig" onClick={add} type="button">Adicionar</button>
            </div>
          </div>
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

/* ===== Importar histórico — totais mensais das planilhas antigas (pré-90 dias) =====
   Grava em HistoricalMetric via /api/historico. A exibição nos painéis fica pra depois.
   TODO(historico): ligar HistoricalMetric nos painéis pra períodos fora dos 90 dias. */
const HIST_MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const HIST_PLATAFORMAS: { id: string; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "meta_ads", label: "Meta Ads" },
  { id: "leads", label: "Leads por canal" },
  { id: "google_ads", label: "Google Ads" },
];
const HIST_ANOS = [2024, 2025, 2026];
const histPlatLabel = (id: string) => HIST_PLATAFORMAS.find((p) => p.id === id)?.label || id;

type HistRow = { metric: string; meses: number[] };
type HistDbRow = { platform: string; metric: string; ano: number; mes: number; valor: number };

// Uma linha por métrica: `metrica , jan , … , dez`. Delimitador vírgula ou ponto-e-vírgula
// (BR com vírgula decimal → use ';'). Header opcional (`metrica,…`) é ignorado. Vazio = 0.
function parseHistorico(text: string): HistRow[] {
  const lines = String(text).replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  const out: HistRow[] = [];
  for (const line of lines) {
    const delim = line.includes(";") ? ";" : ",";
    const cells = line.split(delim);
    const metric = (cells[0] || "").trim().replace(/^"|"$/g, "");
    if (!metric) continue;
    const norm = metric.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (norm === "metrica") continue; // linha de cabeçalho
    const rest = cells.slice(1, 13);
    const meses = Array.from({ length: 12 }, (_, i) => parseBR(rest[i] ?? ""));
    out.push({ metric, meses });
  }
  return out;
}

function HistoricoImport() {
  const [platform, setPlatform] = useState("instagram");
  const [ano, setAno] = useState(2026);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [imported, setImported] = useState<HistDbRow[]>([]);

  const parsed = parseHistorico(csv);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/historico");
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d?.rows)) setImported(d.rows as HistDbRow[]);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleFile(file?: File | null) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => setCsv(String(rd.result || ""));
    rd.readAsText(file);
  }

  async function importar() {
    if (!parsed.length || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/historico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, ano, rows: parsed }),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg(`${d.cells} células gravadas em ${histPlatLabel(platform)} · ${ano}.`);
        setCsv("");
        refresh();
      } else {
        setMsg("Não foi possível importar agora.");
      }
    } catch {
      setMsg("Não foi possível importar agora.");
    } finally {
      setBusy(false);
    }
  }

  async function limpar(plat: string, year: number) {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/historico?platform=${encodeURIComponent(plat)}&ano=${year}`, {
        method: "DELETE",
      });
      if (r.ok) {
        setMsg(`Histórico de ${histPlatLabel(plat)} · ${year} removido.`);
        refresh();
      }
    } catch {
    } finally {
      setBusy(false);
    }
  }

  // agrupa o que já foi importado por (plataforma × ano) pra listar + limpar
  const grupos = Object.values(
    imported.reduce<Record<string, { platform: string; ano: number; cells: number; metrics: Set<string> }>>(
      (acc, row) => {
        const k = `${row.platform}__${row.ano}`;
        if (!acc[k]) acc[k] = { platform: row.platform, ano: row.ano, cells: 0, metrics: new Set() };
        acc[k].cells++;
        acc[k].metrics.add(row.metric);
        return acc;
      },
      {}
    )
  ).sort((a, b) => b.ano - a.ano || a.platform.localeCompare(b.platform));

  return (
    <div className="imp-body">
      <div className="pm-hint" style={{ marginBottom: 4 }}>
        A integração ao vivo só puxa ~90 dias. Aqui você traz os <b>totais mensais</b> das planilhas
        antigas. Escolha a plataforma e o ano, cole (ou envie) um CSV com uma métrica por linha no
        formato <code>metrica,jan,fev,mar,abr,mai,jun,jul,ago,set,out,nov,dez</code> — valores
        numéricos, vazio conta como 0.
      </div>

      <div className="pm-row">
        <div>
          <label className="field-lbl">Plataforma</label>
          <select
            className="field-edit"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            aria-label="Plataforma"
          >
            {HIST_PLATAFORMAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-lbl">Ano</label>
          <select
            className="field-edit"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            aria-label="Ano"
          >
            {HIST_ANOS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="imp-sub" style={{ marginTop: 12 }}>
        <div className="imp-sub-h">
          Cole o CSV<span className="imp-sub-t">uma métrica por linha · vírgula ou ; como separador</span>
        </div>
        <textarea
          className="field-edit"
          style={{ minHeight: 120, fontFamily: "ui-monospace, monospace", fontSize: 12, resize: "vertical" }}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"Alcance,1200,1350,1580,1490,1720,1810,1900,2010,2200,2100,2350,2500\nSeguidores,80,95,110,102,130,145,150,160,175,168,190,210"}
          aria-label="CSV do histórico"
          spellCheck={false}
        />
        <div style={{ marginTop: 8 }}>
          <DropZone
            accept=".csv,.txt"
            onFile={handleFile}
            title="ou arraste um CSV / clique para enviar"
            hint="o conteúdo é lido aqui na hora e cai no campo acima"
          />
        </div>
      </div>

      {parsed.length ? (
        <div className="fonte-map" style={{ marginTop: 12 }}>
          <div className="fm-h">
            Preview <span className="fm-meta">{parsed.length} métrica(s) × 12 meses · {histPlatLabel(platform)} · {ano}</span>
          </div>
          <div className="fm-prev">
            <table>
              <thead>
                <tr>
                  <th>métrica</th>
                  {HIST_MESES.map((m) => (
                    <th key={m} style={{ textTransform: "capitalize" }}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.map((r, ri) => (
                  <tr key={ri}>
                    <td style={{ fontWeight: 600 }}>{r.metric}</td>
                    {r.meses.map((v, i) => (
                      <td key={i} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {fmt(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fm-acts">
            <button className="btn-link" onClick={() => setCsv("")} type="button" disabled={busy}>
              Limpar campo
            </button>
            <button className="btn-link ig" onClick={importar} type="button" disabled={busy}>
              {busy ? "Importando…" : "Importar"}
            </button>
          </div>
        </div>
      ) : null}

      {msg ? (
        <div className="pm-hint" style={{ marginTop: 8 }}>
          {msg}
        </div>
      ) : null}

      {grupos.length ? (
        <div className="imp-sub" style={{ marginTop: 12 }}>
          <div className="imp-sub-h">Já importado</div>
          {grupos.map((g) => (
            <div className="file-chip" key={`${g.platform}__${g.ano}`}>
              <div className="fi">{g.ano}</div>
              <div>
                <b>
                  {histPlatLabel(g.platform)} · {g.ano}
                </b>
                <span>
                  {g.metrics.size} métrica(s) · {g.cells} células
                </span>
              </div>
              <button
                className="x"
                onClick={() => limpar(g.platform, g.ano)}
                aria-label={`Limpar ${histPlatLabel(g.platform)} ${g.ano}`}
                type="button"
                disabled={busy}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="tfoot-note" style={{ marginTop: 12 }}>
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
        Cuidado: não empilhe &quot;Impressões&quot; (2024-25) com &quot;Visualizações&quot; (2026) — são
        métricas diferentes. E importe a versão bruta, não a ponderada por % orgânico.
      </div>
    </div>
  );
}
