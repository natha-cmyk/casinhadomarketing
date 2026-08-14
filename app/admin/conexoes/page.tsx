// /admin/conexoes — conexões por workspace: perfil conectado, contas por canal (ao vivo,
// best-effort com timeout) e CRM. Só o Admin acessa; leitura.
import { PageHead } from "@/components/ui";
import { adminOverview } from "@/lib/admin-data";
import { listAccounts, type ZernioAccount } from "@/lib/zernio";

export const dynamic = "force-dynamic";

const ADS_ONLY = new Set(["metaads", "googleads", "linkedinads", "tiktokads", "pinterestads", "snapchatads"]);
const TH: React.CSSProperties = { padding: "10px 14px", fontWeight: 600, whiteSpace: "nowrap", color: "var(--label-3)" };
const TD: React.CSSProperties = { padding: "10px 14px", verticalAlign: "top" };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export default async function AdminConexoes() {
  const { workspaces } = await adminOverview();

  // contas conectadas ao vivo por workspace (só os com profile) — paralelo + timeout
  const rows = await Promise.all(
    workspaces.map(async (w) => {
      let accounts: ZernioAccount[] = [];
      let erro = false;
      if (w.zernioProfileId) {
        const r = await withTimeout(listAccounts(w.zernioProfileId), 4500);
        if (r) accounts = r.accounts || [];
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

  return (
    <>
      <PageHead
        eyebrow="ADMIN · PLATAFORMA"
        title="Conexões"
        desc={`${rows.filter((r) => r.w.zernioProfileId).length} workspace(s) com perfil conectado · ${totalContas} conta(s) no total (ao vivo).`}
      />
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
                          <span key={p} style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
                            {p}{n > 1 ? ` ×${n}` : ""}
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
