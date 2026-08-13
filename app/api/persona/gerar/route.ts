// POST /api/persona/gerar — gera um RASCUNHO de persona a partir da audiência REAL da rede.
// body: { platform, accountId }. Puxa a demografia (idade/gênero/país/cidade) do canal via
// Zernio (instagram e youtube expõem demografia) e monta heurísticamente — SEM LLM — uma
// persona pública que retrata quem realmente consome aquele canal, pra o usuário comparar
// com as personas planejadas e enxergar desalinhamento. Não inventa números: se a rede não
// devolver demografia, retorna erro amigável. Scoped por workspace ativo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";
import { demographics, type DemographicsResponse } from "@/lib/zernio";

export const dynamic = "force-dynamic";

// redes que expõem demografia de audiência na Zernio
const DEMO_PLATFORMS = new Set(["instagram", "youtube"]);
const REDE_LABEL: Record<string, string> = { instagram: "Instagram", youtube: "YouTube" };

// UF a partir do nome de estado que a Meta devolve (ex. "State of Rio Grande do Norte")
const UF: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};
const COUNTRY_LABEL: Record<string, string> = {
  BR: "Brasil", US: "Estados Unidos", PT: "Portugal", AR: "Argentina", ES: "Espanha",
};

const DIACRITICS = /[̀-ͯ]/g;
const strip = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();

// "Parnamirim, State of Rio Grande do Norte, Brazil" → "Parnamirim/RN"
function cityLabel(dim: string): string {
  const parts = dim.split(",").map((p) => p.trim()).filter(Boolean);
  const city = parts[0] || dim;
  const stateRaw = parts[1] ? parts[1].replace(/state of/i, "").trim() : "";
  const uf = stateRaw ? UF[strip(stateRaw)] : "";
  return uf ? `${city}/${uf}` : city;
}

function genderLabel(dim: string): string {
  const d = strip(dim);
  if (d.startsWith("f")) return "Feminino";
  if (d.startsWith("m")) return "Masculino";
  return "Outros";
}

// faixa etária "25-34" → "25–34" (en-dash), preserva "65+"
const ageLabel = (dim: string) => dim.replace(/-/g, "–");

// pega o breakdown por chave, tolerante às 3 formas conhecidas do envelope
function pickBreakdown(data: DemographicsResponse, key: string): { dimension: string; value: number }[] {
  const rows =
    data.demographics?.[key] ??
    data.breakdowns?.[key] ??
    data.metrics?.[key]?.breakdowns ??
    [];
  return Array.isArray(rows) ? rows.filter((r) => r && Number.isFinite(Number(r.value))) : [];
}

const sum = (rows: { value: number }[]) => rows.reduce((a, r) => a + Number(r.value || 0), 0);
const topOf = (rows: { dimension: string; value: number }[]) =>
  rows.length ? [...rows].sort((a, b) => Number(b.value) - Number(a.value))[0] : null;
const pct = (v: number, total: number) => (total > 0 ? Math.round((Number(v) / total) * 100) : 0);

// dores genéricas derivadas do segmento do perfil (se houver) — 3 itens
function doresFromSegmento(segmento?: string): string[] {
  const seg = (segmento || "").trim();
  if (!seg) {
    return [
      "Precisa de prova de valor rápida antes de decidir",
      "Compara opções parecidas antes de escolher",
      "Quer sentir que a solução é feita para o momento dela",
    ];
  }
  return [
    `Avalia se ${seg} resolve a necessidade dela de fato`,
    `Compara ${seg} com alternativas antes de decidir`,
    `Busca confiança e prova social em ${seg}`,
  ];
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const platform = String(body?.platform || "");
    const accountId = String(body?.accountId || "");
    if (!platform || !accountId)
      return NextResponse.json({ error: "platform/accountId ausentes" }, { status: 400 });
    if (!DEMO_PLATFORMS.has(platform))
      return NextResponse.json({ error: "Esta rede não expõe demografia de audiência." }, { status: 400 });

    // demografia real da audiência + segmento do perfil (pras dores)
    const [demoRes, perfil] = await Promise.all([
      demographics(accountId, { platform }).catch(() => null),
      prisma.perfil.findUnique({ where: { workspaceId: ws } }).catch(() => null),
    ]);

    if (!demoRes)
      return NextResponse.json({ error: "Sem dados de audiência nesta rede." }, { status: 422 });

    const ageRows = pickBreakdown(demoRes, "age");
    const genderRows = pickBreakdown(demoRes, "gender");
    const cityRows = pickBreakdown(demoRes, "city");
    const countryRows = pickBreakdown(demoRes, "country");

    if (!ageRows.length && !genderRows.length && !cityRows.length && !countryRows.length)
      return NextResponse.json({ error: "Sem dados de audiência nesta rede." }, { status: 422 });

    const rede = REDE_LABEL[platform] || platform;

    // dominantes (só com o que a API devolveu — nada inventado)
    const ageTop = topOf(ageRows);
    const ageTotal = sum(ageRows);
    const faixa = ageTop ? ageLabel(ageTop.dimension) : "";
    const faixaPct = ageTop ? pct(ageTop.value, ageTotal) : 0;

    const genTop = topOf(genderRows);
    const genTotal = sum(genderRows);
    const genero = genTop ? genderLabel(genTop.dimension) : "";
    const generoPct = genTop ? pct(genTop.value, genTotal) : 0;

    const topCities = [...cityRows]
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 2)
      .map((c) => cityLabel(c.dimension));

    const countryTop = topOf(countryRows);
    const pais = countryTop ? COUNTRY_LABEL[countryTop.dimension] || countryTop.dimension : "";

    // texto "quem representa"
    const partes: string[] = [];
    if (genero && faixa) partes.push(`Predominância ${genero.toLowerCase()} ${faixa} anos`);
    else if (genero) partes.push(`Predominância ${genero.toLowerCase()}`);
    else if (faixa) partes.push(`Faixa dominante ${faixa} anos`);
    if (topCities.length) partes.push(`concentrada em ${topCities.join(", ")}`);
    else if (pais) partes.push(`concentrada em ${pais}`);
    const representa = partes.length
      ? partes.join(", ") + "."
      : `Retrato da audiência real do ${rede}.`;

    // nome sugerido
    const nome =
      `Audiência ${rede}` + (faixa || genero ? ` — ${[faixa, genero].filter(Boolean).join(" ")}` : "");

    // stats reais [valor, rótulo] — mesma convenção do PersonaCard (valor em destaque)
    const stats: [string, string][] = [];
    if (faixa) stats.push([faixaPct ? `${faixa} (${faixaPct}%)` : faixa, "Faixa dominante"]);
    if (genero) stats.push([generoPct ? `${genero} ${generoPct}%` : genero, "Gênero predominante"]);
    if (topCities[0]) stats.push([topCities[0], "Top cidade"]);
    if (pais) stats.push([pais, "País"]);

    return NextResponse.json({
      persona: {
        nome,
        representa,
        comunica: `Audiência que consome a marca pelo ${rede}.`,
        dores: doresFromSegmento(perfil?.segmento),
        canais: rede,
        stats,
      },
      meta: { platform, rede, accountId },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
