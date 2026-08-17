// /admin/conexoes — conexões por workspace: perfil conectado, contas por canal (ao vivo,
// best-effort com timeout) e CRM. Só o Admin acessa; leitura.
import { PageHead } from "@/components/ui";
import { adminOverview } from "@/lib/admin-data";
import { type ZernioAccount } from "@/lib/zernio";
import { listWorkspaceAccounts } from "@/lib/profiles";
import { ICONS } from "@/lib/nav";

export const dynamic = "force-dynamic";

const ADS_ONLY = new Set(["metaads", "googleads", "linkedinads", "tiktokads", "pinterestads", "snapchatads"]);

// plataforma da integração → ícone (lib/nav ICONS) + cor de marca + rótulo.
const PLAT: Record<string, { ic: string; cor: string; label: string }> = {
  instagram: { ic: "ig", cor: "#E1306C", label: "Instagram" },
  facebook: { ic: "facebook", cor: "#1877F2", label: "Facebook" },
  tiktok: { ic: "tiktok", cor: "#111111", label: "TikTok" },
  youtube: { ic: "youtube", cor: "#FF0000", label: "YouTube" },
  linkedin: { ic: "linkedin", cor: "#0A66C2", label: "LinkedIn" },
  twitter: { ic: "x", cor: "#111111", label: "X" },
  threads: { ic: "threads", cor: "#111111", label: "Threads" },
  googlebusiness: { ic: "googlebusiness", cor: "#4285F4", label: "Google Business" },
  pinterest: { ic: "pinterest", cor: "#E60023", label: "Pinterest" },
  snapchat: { ic: "snapchat", cor: "#FFCC00", label: "Snapchat" },
  reddit: { ic: "reddit", cor: "#FF4500", label: "Reddit" },
  bluesky: { ic: "bluesky", cor: "#0085FF", label: "Bluesky" },
};
const platMeta = (p: string) => PLAT[p] || { ic: "", cor: "var(--label-2)", label: p };

// glifo da rede (ícone de marca colorido) — cai num ponto colorido quando não há ícone.
function PlatIcon({ plat, size = 15 }: { plat: string; size?: number }) {
  const m = platMeta(plat);
  const glyph = m.ic ? ICONS[m.ic] : "";
  if (!glyph) return <span aria-hidden style={{ width: size, height: size, borderRadius: 999, background: m.cor, display: "inline-block", flex: `0 0 ${size}px` }} />;
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={m.cor}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: `0 0 ${size}px` }}
      dangerouslySetInnerHTML={{ __html: glyph }}
    />
  );
}
const TH: React.CSSProperties = { padding: "10px 14px", fontWeight: 600, whiteSpace: "nowrap", color: "var(--label-3)" };
const TD: React.CSSProperties = { padding: "10px 14px", verticalAlign: "top" };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

function Empty() {
  return <div style={{ fontSize: 12.5, color: "var(--label-3)" }}>Sem dados ainda.</div>;
}

export default async function AdminConexoes() {
  const { workspaces } = await adminOverview();

  // contas conectadas ao vivo por workspace (só os com profile) — paralelo + timeout
  const rows = await Promise.all(
    workspaces.map(async (w) => {
      let accounts: ZernioAccount[] = [];
      let erro = false;
      if (w.zernioProfileId) {
        const r = await withTimeout(listWorkspaceAccounts(w), 4500); // agrega profiles (multi-conta)
        if (r) accounts = r;
        else erro = true;
      }
      const social = accounts.filter((a) => !ADS_ONLY.has(String(a.platform)));
      const ads = accounts.filter((a) => ADS_ONLY.has(String(a.platform)) || a.adsStatus === "connected" || a.adsStatus === "active");
      const byPlatform = new Map<string, number>();
      for (const a of social) byPlatform.set(String(a.platform), (byPlatform.get(String(a.platform)) || 0) + 1);
      return { w, total: accounts.length, social: social.length, ads: ads.length, byPlatform, erro };
    })
  );

  const totalContas = rows.reduce((a, r) => a + r.total, 0);

  // AGREGADOS da plataforma: canais mais conectados (workspaces por canal) + CRMs por tipo
  const platTally = new Map<string, number>();
  const crmTally = new Map<string, number>();
  for (const r of rows) {
    for (const p of r.byPlatform.keys()) platTally.set(p, (platTally.get(p) || 0) + 1);
    const prov = r.w.crmConfig?.provider;
    if (prov) crmTally.set(prov, (crmTally.get(prov) || 0) + 1);
  }
  const platRank = [...platTally.entries()].sort((a, b) => b[1] - a[1]);
  const crmRank = [...crmTally.entries()].sort((a, b) => b[1] - a[1]);
  const platMax = Math.max(1, ...platRank.map(([, n]) => n));

  return (
    <>
      <PageHead
        eyebrow="ADMIN · PLATAFORMA"
        title="Conexões"
        desc={`${rows.filter((r) => r.w.zernioProfileId).length} workspace(s) com perfil conectado · ${totalContas} conta(s) no total (ao vivo).`}
      />
      {/* Agregados da plataforma: onde estão as conexões */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Canais mais conectados <span style={{ color: "var(--label-3)", fontWeight: 600 }}>· nº de workspaces</span></div>
          {platRank.length ? platRank.map(([p, n]) => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span style={{ width: 130, fontSize: 12.5, color: "var(--label)", display: "flex", alignItems: "center", gap: 7 }}>
                <PlatIcon plat={p} />{platMeta(p).label}
              </span>
              <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--surface)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(n / platMax) * 100}%`, background: platMeta(p).cor }} />
              </span>
              <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, width: 22, textAlign: "right" }}>{n}</span>
            </div>
          )) : <Empty />}
        </div>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>CRMs conectados <span style={{ color: "var(--label-3)", fontWeight: 600 }}>· por tipo</span></div>
          {crmRank.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {crmRank.map(([prov, n]) => (
                <span key={prov} style={{ fontSize: 12.5, padding: "5px 12px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)", fontWeight: 600 }}>
                  {prov}: <span className="tnum">{n}</span>
                </span>
              ))}
            </div>
          ) : <Empty />}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--hairline)" }}>
              <th style={TH}>Workspace</th>
              <th style={TH}>Perfil</th>
              <th style={TH}>Contas por canal</th>
              <th style={TH}>Sociais</th>
              <th style={TH}>Mídia paga</th>
              <th style={TH}>CRM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.w.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                <td style={{ ...TD, fontWeight: 600 }}>{r.w.nome}</td>
                <td style={TD}>
                  {r.w.zernioProfileId
                    ? (r.erro ? <span style={{ color: "var(--atencao,#FF9F0A)" }}>conectado (sem resposta)</span> : <span style={{ color: "var(--excelente,#2FB457)", fontWeight: 700 }}>conectado</span>)
                    : <span style={{ color: "var(--label-3)" }}>—</span>}
                </td>
                <td style={TD}>
                  {r.byPlatform.size
                    ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {[...r.byPlatform.entries()].map(([p, n]) => (
                          <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, padding: "2px 8px 2px 6px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
                            <PlatIcon plat={p} size={13} />{platMeta(p).label}{n > 1 ? ` ×${n}` : ""}
                          </span>
                        ))}
                      </div>
                    : <span style={{ color: "var(--label-3)" }}>—</span>}
                </td>
                <td style={TD}>{r.social || <span style={{ color: "var(--label-3)" }}>0</span>}</td>
                <td style={TD}>{r.ads || <span style={{ color: "var(--label-3)" }}>0</span>}</td>
                <td style={TD}>{r.w.crmConfig ? (r.w.crmConfig.provider || "sim") : <span style={{ color: "var(--label-3)" }}>—</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, color: "var(--label-3)", textAlign: "center" }}>Nenhum workspace ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--label-3)", marginTop: 14 }}>
        Contagem de contas é buscada ao vivo da integração (timeout de 4,5s por workspace). “conectado (sem resposta)” = o perfil existe mas a integração não respondeu a tempo.
      </p>
    </>
  );
}
