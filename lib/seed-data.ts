// Dados read-mostly extraídos VERBATIM do blueprint casinha-do-marketing.html.
// Não vão para o banco (só o que o usuário edita é persistido — ver schema.prisma).
// Fonte real: Conexa + Chatwoot + ClickUp. "LLM" sempre; SeaHealth = histórico.
import { sum } from "./format";

// ── Instagram 2026 semanal (Jan–Jul; W1 1–7, W2 8–14, W3 15–21, W4 22–fim) ──
export const IGW26: Record<string, number[][]> = {
  posts: [[1,1,1,0],[1,1,0,0],[2,1,0,0],[0,2,1,2],[1,1,1,0],[1,0,0,1],[1,0,1,0]],
  stories: [[29,14,27,51],[45,51,11,39],[48,34,45,48],[35,42,28,51],[18,21,46,28],[39,32,46,36],[35,39,0,0]],
  reels: [[2,1,2,5],[3,3,2,3],[2,3,5,4],[3,3,1,4],[2,3,3,5],[4,4,4,6],[2,4,3,0]],
  leadsDirect: [[4,6,7,9],[5,3,5,4],[8,8,6,8],[4,8,2,9],[11,16,9,8],[8,13,9,10],[6,13,0,0]],
  ctaCompra: [[6,13,9,12],[7,6,5,10],[7,12,14,16],[7,16,7,15],[12,14,11,8],[12,11,14,12],[11,12,0,0]],
  visualizacoes: [[54827,52324,49914,76565],[58976,45785,59910,60431],[73089,80453,82123,76981],[47187,49582,45223,52030],[43709,50249,38590,43986],[368612,187758,62158,65618],[57408,52455,45228,0]],
  contas: [[22550,21630,17765,20068],[17086,18310,22825,21921],[27808,31780,36992,31561],[19653,21704,15998,20759],[20448,19518,17838,20218],[221909,119122,29372,29402],[23479,21344,19427,0]],
  interacoes: [[331,242,330,510],[362,313,100,271],[681,1932,3510,1666],[517,740,350,638],[325,766,523,1089],[54314,22419,2001,1423],[576,618,495,0]],
  curtidas: [[154,96,139,244],[157,112,82,96],[250,851,1212,683],[226,348,159,239],[198,397,355,621],[17067,7432,909,748],[333,375,277,0]],
  comentarios: [[13,11,22,43],[31,25,8,11],[78,76,65,58],[15,26,19,25],[16,69,21,111],[396,167,31,29],[13,26,44,0]],
  salvos: [[0,3,6,8],[3,3,2,9],[14,57,252,148],[31,55,16,20],[7,19,21,29],[769,373,29,19],[3,8,5,0]],
  compart: [[38,14,29,65],[47,55,8,25],[91,414,942,334],[84,109,48,122],[28,137,53,145],[17739,7088,490,286],[104,91,71,0]],
  repost: [[19,12,23,23],[19,15,3,16],[22,42,30,31],[7,16,6,9],[9,21,12,29],[595,269,48,55],[11,26,24,0]],
};
export const IGM26: Record<string, number[]> = {
  seguidoresNovos: [210,191,250,224,239,140,170], seguidoresSaida: [181,144,159,174,93,0,0],
  totalSeguidores: [10213,10252,10370,10481,10566,10875,10974],
  atividades: [2402,2746,4886,3426,3105,4295,2207], visitasSite: [189,131,246,170,138,147,120],
  viewsSeguidoresPct: [0.203,0.216,0.18,0.184,0.147,0.0675,0.243],
  organicoPct: [0.204,0.2525,0.449,0.29,0.3165,0.6725,0.2725],
};
// Instagram mensal 2024 e 2025 (casinhas CMKT24 e CMKT25)
export const IG: Record<number, Record<string, number[]>> = {
  2024: { totalSeguidores:[6871,6928,7048,7205,7361,7562,7770,7982,8611,8691,8750,8792], seguidoresNovos:[21,70,120,157,156,201,208,212,629,80,59,42], seguidoresSaida:[0,0,0,0,0,0,0,0,0,0,0,0], posts:[7,9,8,8,10,9,12,10,7,9,8,4], stories:[162,191,200,155,184,160,249,220,354,203,196,148], reels:[7,7,10,11,11,10,9,10,15,13,12,11], leadsDirect:[14,28,27,21,19,38,40,61,42,36,35,23], ctaCompra:[66,51,55,56,61,71,72,81,111,80,61,41], contas:[21746,42938,92821,112871,112046,117191,96591,103277,113686,98452,139724,122424], visualizacoes:[73154,101892,207323,222521,244233,244415,222292,223779,285711,209184,301175,300118], interacoes:[1108,1865,2825,2798,3129,2666,2511,2733,2893,2631,2218,2635], curtidas:[870,1235,1339,2530,2425,2228,2108,2471,2136,2348,2122,2382], comentarios:[79,159,75,80,132,89,116,118,177,64,74,128], salvos:[24,49,35,54,44,52,42,44,52,24,41,30], compart:[102,178,93,134,121,121,145,100,184,92,81,95], repost:[0,0,0,0,0,0,0,0,0,0,0,0], atividades:[1728,2004,3385,4042,3695,3863,4414,3967,6646,3149,3460,3037], visitasSite:[207,174,238,508,252,300,363,402,757,315,254,206], viewsSeguidoresPct:[0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2], organicoPct:[1.0,0.26,0.14,0.206,0.131,0.157,0.14,0.236,0.235,0.245,0.163,0.20] },
  2025: { totalSeguidores:[8830,8895,9000,9091,9207,9205,9317,9429,9466,9562,10067,10148], seguidoresNovos:[38,65,105,91,116,0,112,112,37,96,505,81], seguidoresSaida:[0,0,0,0,0,2,0,0,0,0,0,0], posts:[5,8,6,7,9,5,6,4,7,8,7,4], stories:[114,188,191,252,180,186,214,212,201,160,213,152], reels:[10,7,9,15,9,17,16,18,17,16,19,11], leadsDirect:[29,34,33,45,42,34,33,31,28,25,30,12], ctaCompra:[73,59,67,70,60,46,57,65,66,45,37,21], contas:[117090,119535,104957,116683,110071,90185,87424,104861,43337,61926,72148,74507], visualizacoes:[308377,295186,245765,275960,276952,221755,269676,305463,131190,184732,287534,213473], interacoes:[1748,2161,2225,2517,2399,2169,2079,2566,1044,2394,2352,1523], curtidas:[425,749,1101,1378,1374,847,643,895,360,1148,1072,557], comentarios:[110,76,88,128,159,78,111,120,34,92,153,90], salvos:[26,37,33,31,31,31,31,33,21,56,34,19], compart:[74,148,129,216,245,141,184,173,82,292,214,111], repost:[0,0,0,0,0,0,0,0,22,51,73,39], atividades:[2977,2946,2756,3395,3404,2748,3182,3233,2155,2156,3801,2325], visitasSite:[340,239,253,293,248,178,239,239,178,194,154,139], viewsSeguidoresPct:[0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2,0.2], organicoPct:[0.1125,0.1245,0.208,0.2005,0.179,0.243,0.248,0.313,0.4235,0.471,0.311,0.313] },
};
export function igMonthly(metric: string, year: number): number[] {
  if (year === 2026) {
    if (IGW26[metric]) return IGW26[metric].map((w) => sum(w)).concat(Array(5).fill(0));
    if (IGM26[metric]) return IGM26[metric].concat(Array(12 - IGM26[metric].length).fill(0));
    return Array(12).fill(0);
  }
  const y = IG[year];
  return y && y[metric] ? y[metric].slice() : Array(12).fill(0);
}
export function igWk(metric: string, year: number, m: number, w: number): number {
  return year === 2026 && IGW26[metric] && IGW26[metric][m] ? IGW26[metric][m][w] || 0 : 0;
}

// ── Canais Pagos por ano ──
export interface AdRow {
  id: string; canal: string; produto: string; plat: string;
  leads: number[]; vendas: number[]; receita: number[]; invest: number[];
}
export const ADS: Record<number, AdRow[]> = {
  2024: [{ id:"meta-geral", canal:"Meta Ads", produto:"Geral", plat:"Meta", leads:[0,42,49,59,77,152,74,74,25,48,64,43], vendas:[0,0,0,1,1,2,4,4,4,5,5,10], receita:[0,90,0,90,360,360,876,450,5400,450,878,0], invest:[86.45,1586.93,1233.38,1621.71,1858.10,2354.30,1338.83,1300.31,1191.46,1080.37,1564.95,1291.56] }],
  2025: [
    { id:"parceria-ev-25", canal:"Programa de Parceria", produto:"Escritório Virtual", plat:"Parceria", leads:[30,28,29,20,18,6,29,16,30,27,16,23], vendas:[29,23,26,20,21,7,25,15,27,27,13,21], receita:[12930.80,10551.20,9720,8255.90,9428.92,3085.79,15143.90,6924.90,12720.79,5599.40,2383.50,4953.90], invest:[3200,3140,3100,2024,3528,814,4737,3787,5257,4200,1800,3100] },
    { id:"meta-espaco-25", canal:"Meta Ads", produto:"Serviços de Espaço", plat:"Meta", leads:[21,38,9,45,26,37,67,63,79,55,41,70], vendas:[3,7,3,5,6,7,10,12,15,16,7,1], receita:[1175,2268.50,1125,642.50,1823.50,1655,2759,5971.14,8697.50,3825,2527.50,420], invest:[701.32,817.61,501.48,683.75,555.17,886.39,1141.12,1406,707.71,878.31,864.22,900.71] },
    { id:"google-ev-25", canal:"Google Ads", produto:"Escritório Virtual", plat:"Google", leads:[18,17,13,9,1,5,5,10,9,2,1,2], vendas:[7,5,3,2,2,1,1,2,2,0,0,1], receita:[4158,1190,1356,1399,207,119,1152,1421,1300,0,0,1213], invest:[942,825.94,999.58,710.95,715.92,273.28,419.19,789.58,1232.60,0,0,0] },
    { id:"google-espaco-25", canal:"Google Ads", produto:"Serviços de Espaço", plat:"Google", leads:[28,21,27,18,17,9,7,10,34,5,7,8], vendas:[11,3,5,5,0,1,0,1,7,1,2,1], receita:[3605,1235,646,1759,0,600,0,500,2597.50,65,269,137.50], invest:[1360.47,1573.49,860.32,935.60,902.08,619.25,816.28,0,0,0,0,0] },
    { id:"meta-ev-25", canal:"Meta Ads", produto:"Escritório Virtual", plat:"Meta", leads:[3,12,1,9,7,9,24,16,20,30,22,15], vendas:[2,0,1,2,2,3,2,1,2,3,2,5], receita:[1427,0,119,219,249,357,1403,256,256,387,1347,3249.19], invest:[267.58,475.14,261.58,288.18,205.09,315.37,511.25,431.97,417.86,508.74,514.48,462.81] },
    { id:"google-privativas-25", canal:"Google Ads", produto:"Salas Privativas", plat:"Google", leads:[3,6,11,5,0,0,19,5,10,3,0,10], vendas:[0,1,0,0,0,0,1,1,1,0,0,0], receita:[0,2000,0,0,0,0,450,1750,1200,0,0,0], invest:[901.36,456.14,456.53,456.68,456.08,375.08,456.07,455.96,453.15,910.38,912.09,899.10] },
  ],
  2026: [
    { id:"parceria-ev", canal:"Programa de Parceria", produto:"Escritório Virtual", plat:"Parceria", leads:[38,29,26,20,36,25,0,0,0,0,0,0], vendas:[32,20,23,20,31,17,0,0,0,0,0,0], receita:[0,0,0,0,0,0,0,0,0,0,0,0], invest:[5320,4000,3750,2950,4550,4100,0,0,0,0,0,0] },
    { id:"meta-espaco", canal:"Meta Ads", produto:"Serviços de Espaço", plat:"Meta", leads:[34,8,48,12,2,12,0,0,0,0,0,0], vendas:[2,2,11,2,0,2,0,0,0,0,0,0], receita:[380,1100,5570,1000,0,410,0,0,0,0,0,0], invest:[805.99,635.26,1073.50,915.17,957.57,761.67,0,0,0,0,0,0] },
    { id:"google-ev", canal:"Google Ads", produto:"Escritório Virtual", plat:"Google", leads:[11,5,13,5,7,7,0,0,0,0,0,0], vendas:[0,5,5,2,2,1,0,0,0,0,0,0], receita:[0,1742,16259,1148,268,966,0,0,0,0,0,0], invest:[0,0,0,0,0,0,0,0,0,0,0,0] },
    { id:"google-espaco", canal:"Google Ads", produto:"Serviços de Espaço", plat:"Google", leads:[25,18,12,7,10,16,0,0,0,0,0,0], vendas:[4,3,2,3,4,6,0,0,0,0,0,0], receita:[1135,1010,1035,4325,2935,1395,0,0,0,0,0,0], invest:[0,0,0,0,0,0,0,0,0,0,0,0] },
    { id:"meta-ev", canal:"Meta Ads", produto:"Escritório Virtual", plat:"Meta", leads:[10,3,16,6,3,5,0,0,0,0,0,0], vendas:[1,1,1,2,1,0,0,0,0,0,0,0], receita:[119,149,999,1118,119,0,0,0,0,0,0,0], invest:[528.39,518.71,662.81,622.93,647.14,482.25,0,0,0,0,0,0] },
    { id:"google-privativas", canal:"Google Ads", produto:"Salas Privativas", plat:"Google", leads:[7,12,13,8,15,14,0,0,0,0,0,0], vendas:[0,0,2,1,0,1,0,0,0,0,0,0], receita:[0,0,4350,1250,0,3350,0,0,0,0,0,0], invest:[0,0,0,0,0,0,0,0,0,0,0,0] },
  ],
};
export const ADS_METRICS: [string, string][] = [["receita","Receita"],["invest","Investimento"],["leads","Leads"],["vendas","Vendas"],["roas","ROAS"],["conv","Conversão"],["cpl","CPL"],["cac","CAC"]];
export const ADS_INPUTS = ["leads","vendas","receita","invest"];
export const ADS_PLATS: [string, string][] = [["todos","Todos"],["Google","Google Ads"],["Meta","Meta Ads"],["Parceria","Parceria"]];

// ── Geração por canais — consolidado do ano, por produto ──
export const CANAIS: Record<number, Record<string, Record<string, number>>> = {
  2024: {
    "Escritório Virtual": { Site:138, Loja:23, "Programa de Parceria":220, Indicação:31, "Redes Sociais":81, Orgânico:54, "Cliente Ativo":58, Prospecção:4 },
    "Serviços de Espaço": { Site:644, Loja:77, Orgânico:277, Indicação:46, "Redes Sociais":354, "Cliente Ativo":684, Prospecção:8 },
    "Registro de Marca": { "Programa de Parceria":8, Indicação:6, "Redes Sociais":3, "Cliente Ativo":2, Prospecção:1 },
  },
  2025: {
    "Escritório Virtual": { Site:99, Loja:46, "Programa de Parceria":259, Indicação:43, "Redes Sociais":214, Orgânico:66, "Cliente Ativo":41, Prospecção:138 },
    "Serviços de Espaço": { Site:239, Loja:108, Orgânico:358, Indicação:73, "Redes Sociais":709, "Cliente Ativo":688, Comunidade:13 },
    "SeaHealth": { Site:83, Indicação:266, "Redes Sociais":149, Orgânico:78, "Cliente Ativo":17, Prospecção:32 },
  },
  2026: {
    "Escritório Virtual": { Site:62, Loja:8, "Programa de Parceria":194, Indicação:14, "Redes Sociais":147, Orgânico:26, "Cliente Ativo":20, Prospecção:2 },
    "Salas de reunião, atendimento & coworking": { Site:83, Loja:12, "Redes Sociais":284, Orgânico:59, "Cliente Ativo":352, Indicação:4, Comunidade:1 },
    "Auditórios": { Site:25, Loja:9, "Programa de Parceria":1, Indicação:1, "Redes Sociais":145, Orgânico:37, "Cliente Ativo":109, Eventos:3 },
    "Salas Privativas & Coworking": { Site:81, Loja:14, Indicação:23, "Redes Sociais":65, Orgânico:9, "Cliente Ativo":51, Prospecção:1, Eventos:1, Comunidade:1, "Lead perdido":2 },
    "Seabox": { Site:7, Loja:1, "Redes Sociais":20, Orgânico:5, "Cliente Ativo":2 },
    "SeaOffice": { Loja:4, "Redes Sociais":17, "Cliente Ativo":1, "Indicação por corretores":1 },
  },
};
export function canaisTotalYear(y: number): number {
  const d = CANAIS[y];
  if (!d) return 0;
  return sum(Object.values(d).flatMap((p) => Object.values(p)));
}
export const CANAL_COLORS: Record<string, string> = { "Programa de Parceria":"#FF001E", "Cliente Ativo":"#00BBC5", "Redes Sociais":"#121111", Site:"#FF9F0A", Orgânico:"#2FB457", Indicação:"#8E5BE0", Loja:"#5A9BFF", Prospecção:"#FF6B9D", Comunidade:"#00A38E" };

// ── Overview: leads por mês ──
export const LEADS_M: Record<number, number[]> = { 2026: [423,244,303,242,271,221,200,0,0,0,0,0] };

// ── OKR 2026 (KRs reais do ClickUp) ──
export interface OKRKr { kr: string; alvo: string; un: string; tag: string; resp: string }
export interface OKRArea { area: string; krs: OKRKr[] }
export const OKR2026: { objetivo: string; areas: OKRArea[] } = {
  objetivo: "Consolidar o novo modelo de negócio — ofertar mais metros quadrados e seguir encantando os clientes, com a comunidade como valor central e os serviços digitais como o pote de ouro no fim do arco-íris.",
  areas: [
    { area: "Marketing", krs: [
      { kr:"Gerar leads via LLM", alvo:"10", un:"/mês", tag:"IA", resp:"Nathã" },
      { kr:"Gerar leads de Seabox", alvo:"30", un:"/mês", tag:"Seabox", resp:"Nathã" },
      { kr:"Visitas via blog", alvo:"100", un:"/mês", tag:"IA · SEO", resp:"Nathã" },
      { kr:"Blogposts temáticos", alvo:"10", un:"/mês", tag:"IA · SEO", resp:"Nathã" },
      { kr:"Contadores cadastrados na base", alvo:"55→70", un:"%", tag:"EV", resp:"Diego · Arthur" },
    ]},
    { area: "Comunidade", krs: [
      { kr:"Impactar pessoas em meetups", alvo:"90", un:"/mês", tag:"", resp:"Regis" },
      { kr:"Evento externo", alvo:"1", un:"/trimestre", tag:"", resp:"Regis" },
      { kr:"Parcerias de patrocínio / permuta", alvo:"5", un:"no ano", tag:"", resp:"Regis" },
    ]},
    { area: "Comercial / Imobiliário", krs: [
      { kr:"Novo imóvel de parceiro", alvo:"1", un:"/mês", tag:"SeaOffice", resp:"Diego · Nathã" },
      { kr:"Faturamento com imóveis de terceiros", alvo:"R$42k", un:"/ano", tag:"SeaOffice", resp:"Diego" },
      { kr:"Reajuste de preços das salas", alvo:"+5", un:"%", tag:"", resp:"Diego" },
      { kr:"Reservas feitas pelo App", alvo:"50", un:"%", tag:"", resp:"Diego" },
    ]},
    { area: "Eficiência / Operação", krs: [
      { kr:"Redução de churn de EV", alvo:"−20", un:"%", tag:"EV", resp:"Duda · Diego · Regis" },
      { kr:"Reduzir despesas com plataformas", alvo:"−R$2k", un:"/mês", tag:"", resp:"Guiga" },
    ]},
  ],
};

// ── Calendário: feriados e eventos (chave `ano-mesHumano-dia`) ──
export const FERIADOS: Record<string, string> = {
  "2025-1-1":"Confraternização","2025-3-3":"Carnaval","2025-3-4":"Carnaval","2025-4-18":"Sexta-feira Santa","2025-4-21":"Tiradentes","2025-5-1":"Dia do Trabalho","2025-6-19":"Corpus Christi","2025-9-7":"Independência","2025-10-3":"Mártires de Cunhaú e Uruaçu","2025-10-12":"N. Sra. Aparecida","2025-11-2":"Finados","2025-11-15":"Proclamação da República","2025-11-20":"Consciência Negra","2025-12-25":"Natal",
  "2026-1-1":"Confraternização","2026-2-16":"Carnaval","2026-2-17":"Carnaval","2026-4-3":"Sexta-feira Santa","2026-4-21":"Tiradentes","2026-5-1":"Dia do Trabalho","2026-6-4":"Corpus Christi","2026-9-7":"Independência","2026-10-3":"Mártires de Cunhaú e Uruaçu","2026-10-12":"N. Sra. Aparecida","2026-11-2":"Finados","2026-11-15":"Proclamação da República","2026-11-20":"Consciência Negra","2026-12-25":"Natal",
};
export const EVENTOS: Record<string, string> = { "2025-12-12":"Aniversário Seahub","2026-12-12":"Aniversário Seahub","2026-9-18":"GO!RN","2026-9-19":"GO!RN" };
export const FER_NAC: [string, string][] = [["01/01","Confraternização"],["21/04","Tiradentes"],["01/05","Dia do Trabalho"],["07/09","Independência"],["12/10","N. Sra. Aparecida"],["02/11","Finados"],["15/11","Proclamação da República"],["20/11","Consciência Negra"],["25/12","Natal"]];
export const FER_UF: Record<string, [string, string][]> = { RN:[["03/10","Mártires de Cunhaú e Uruaçu"]], SP:[["09/07","Revolução Constitucionalista"]], RJ:[["23/04","São Jorge"],["20/01","São Sebastião"]], CE:[["19/03","São José"],["25/03","Data Magna do Ceará"]], PE:[["06/03","Revolução Pernambucana"]], BA:[["02/07","Independência da Bahia"]] };

// ── Calendário de conteúdo — taxonomia + seed ──
export const CANAIS_POST = ["Instagram","WhatsApp (grupos)","Lista de transmissão","Blog"];
export const PERFIS_POST = ["Seahub","Seabox","Hub Empreendedoras"];
export const PILARES_POST = ["Espaços","Endereço Fiscal","Seabox","Comunidade","Eventos","Humor","Branding","Comunicado","Autoridade"];
export const FORMATOS_POST = ["Reels","Carrossel","Post único","Story","Blogpost","Mensagem"];
export const FUNIL_POST = ["Topo","Meio","Fundo"];
export const CANAL_POST_COLORS: Record<string, string> = { Instagram:"#FF001E", "WhatsApp (grupos)":"#2FB457", "Lista de transmissão":"#00BBC5", Blog:"#8E5BE0" };
export interface SeedPost {
  id: string; y: number; m: number; d: number; hora: string; titulo: string; canal: string;
  perfil: string; colab: string; pilar: string; formato: string; funil: string;
  legenda: string; cta: string; hashtags: string; arquivo: string; status: string; contas: string[];
}
export const POSTS_SEED: SeedPost[] = [
  { id:"p1", y:2026, m:6, d:1, hora:"09:00", titulo:"Tour pelo Auditório Seaway", canal:"Instagram", perfil:"Seahub", colab:"", pilar:"Espaços", formato:"Reels", funil:"Topo", legenda:"A estrutura do auditório pronta para o seu evento.", cta:"Agende uma visita", hashtags:"#coworkingnatal #seahub", arquivo:"auditorio-seaway.mp4", status:"publicado", contas:["instagram"] },
  { id:"p2", y:2026, m:6, d:3, hora:"12:00", titulo:"3 sinais de que sua empresa precisa de endereço fiscal", canal:"Instagram", perfil:"Seahub", colab:"", pilar:"Endereço Fiscal", formato:"Carrossel", funil:"Meio", legenda:"Credibilidade e regularização para o seu CNPJ.", cta:"Fale no WhatsApp", hashtags:"#enderecofiscal #cnpj", arquivo:"ev-carrossel.png", status:"publicado", contas:["instagram"] },
  { id:"p3", y:2026, m:6, d:8, hora:"18:00", titulo:"Receba encomendas com segurança", canal:"Instagram", perfil:"Seabox", colab:"Seahub", pilar:"Seabox", formato:"Reels", funil:"Topo", legenda:"Sem depender de porteiro ou vizinho.", cta:"Assine o Seabox", hashtags:"#seabox", arquivo:"seabox-reel.mp4", status:"agendado", contas:["instagram"] },
  { id:"p4", y:2026, m:6, d:10, hora:"10:00", titulo:"Convite: Meetup Hub Empreendedoras", canal:"WhatsApp (grupos)", perfil:"Hub Empreendedoras", colab:"", pilar:"Comunidade", formato:"Mensagem", funil:"Topo", legenda:"Encontro presencial no Seahub Sebrae.", cta:"Confirme presença", hashtags:"", arquivo:"", status:"agendado", contas:[] },
  { id:"p5", y:2026, m:6, d:15, hora:"08:00", titulo:"Como escolher um coworking em Natal", canal:"Blog", perfil:"Seahub", colab:"", pilar:"Autoridade", formato:"Blogpost", funil:"Topo", legenda:"Guia completo (~1.100 palavras).", cta:"Leia no blog", hashtags:"", arquivo:"", status:"rascunho", contas:[] },
  { id:"p6", y:2026, m:6, d:22, hora:"17:00", titulo:"Oferta relâmpago: salas de reunião", canal:"Lista de transmissão", perfil:"Seahub", colab:"", pilar:"Espaços", formato:"Mensagem", funil:"Fundo", legenda:"Pacote de horas com condição especial.", cta:"Reserve agora", hashtags:"", arquivo:"", status:"agendado", contas:[] },
];

// ── Indicadores por painel (config de visibilidade) ──
export interface IndDef { id: string; label: string; desc: string }
export interface IndGroup { g: string; i: IndDef[] }
export const PANEL_INDICATORS: Record<string, IndGroup[]> = {
  overview: [
    { g:"KPIs do topo", i:[
      { id:"kpi_seg", label:"Seguidores", desc:"base total + YoY" },
      { id:"kpi_leads", label:"Leads gerados", desc:"todas as origens + YoY" },
      { id:"kpi_invest", label:"Investimento pago", desc:"mídia + ROAS" },
      { id:"kpi_mrr", label:"MRR atual", desc:"receita recorrente" },
    ]},
    { g:"Gráficos", i:[
      { id:"ch_leads", label:"Leads por ano", desc:"2024–2026" },
      { id:"ch_seg", label:"Seguidores por ano", desc:"2024–2026" },
    ]},
    { g:"Redes sociais", i:[ { id:"redes", label:"Resumo por rede social", desc:"mini-painel de cada rede ativa" } ]},
    { g:"Navegação & leitura", i:[
      { id:"atalhos", label:"Atalhos rápidos", desc:"acesso às abas" },
      { id:"insight", label:"Leitura rápida do ano", desc:"resumo em texto" },
    ]},
  ],
  instagram: [
    { g:"Crescimento", i:[ { id:"seguidores", label:"Seguidores", desc:"novos, saída, líquido" } ]},
    { g:"Alcance & mix", i:[
      { id:"organico", label:"Rendimento orgânico", desc:"share não-impulsionado" },
      { id:"splitFollowers", label:"Seguidores vs. não-seguidores", desc:"origem das views" },
    ]},
    { g:"Engajamento & perfil", i:[ { id:"atividades", label:"Atividades no perfil", desc:"ações + visitas ao site" } ]},
  ],
  metas: [
    { g:"Topo", i:[ { id:"objetivo", label:"Objetivo do ano", desc:"north star" } ]},
    { g:"Áreas do OKR", i:[
      { id:"marketing", label:"Marketing", desc:"KRs de marketing" },
      { id:"comunidade", label:"Comunidade", desc:"KRs de comunidade" },
      { id:"comercial", label:"Comercial & Imobiliário", desc:"KRs comerciais" },
      { id:"eficiencia", label:"Eficiência & Operação", desc:"KRs de eficiência" },
    ]},
  ],
  tiktok: [
    { g:"KPIs", i:[ { id:"kpi_0", label:"Seguidores", desc:"" },{ id:"kpi_1", label:"Visualizações", desc:"" },{ id:"kpi_2", label:"Curtidas", desc:"" },{ id:"kpi_3", label:"Engajamento", desc:"" } ]},
    { g:"Visualização", i:[ { id:"chart", label:"Visualizações por mês", desc:"" },{ id:"top", label:"Top conteúdos", desc:"" } ]},
  ],
  linkedin: [
    { g:"KPIs", i:[ { id:"kpi_0", label:"Seguidores", desc:"" },{ id:"kpi_1", label:"Impressões", desc:"" },{ id:"kpi_2", label:"Cliques", desc:"" },{ id:"kpi_3", label:"Engajamento", desc:"" } ]},
    { g:"Visualização", i:[ { id:"chart", label:"Impressões por mês", desc:"" },{ id:"top", label:"Top conteúdos", desc:"" } ]},
  ],
  youtube: [
    { g:"KPIs", i:[ { id:"kpi_0", label:"Inscritos", desc:"" },{ id:"kpi_1", label:"Visualizações", desc:"" },{ id:"kpi_2", label:"Tempo de exibição", desc:"" },{ id:"kpi_3", label:"CTR miniatura", desc:"" } ]},
    { g:"Visualização", i:[ { id:"chart", label:"Visualizações por mês", desc:"" },{ id:"top", label:"Top conteúdos", desc:"" } ]},
  ],
};

// ── Ecossistema de canais (Zernio): 23 canais em Social/Conversas/Ads ──
export interface Rede { id: string; label: string; cor: string; grupo: "social" | "conversas" | "ads" }
export const REDES: Rede[] = [
  { id:"instagram", label:"Instagram", cor:"#FF001E", grupo:"social" },
  { id:"tiktok", label:"TikTok", cor:"#111111", grupo:"social" },
  { id:"x", label:"X / Twitter", cor:"#111111", grupo:"social" },
  { id:"facebook", label:"Facebook", cor:"#1877F2", grupo:"social" },
  { id:"linkedin", label:"LinkedIn", cor:"#0A66C2", grupo:"social" },
  { id:"youtube", label:"YouTube", cor:"#FF0000", grupo:"social" },
  { id:"threads", label:"Threads", cor:"#111111", grupo:"social" },
  { id:"reddit", label:"Reddit", cor:"#FF4500", grupo:"social" },
  { id:"pinterest", label:"Pinterest", cor:"#E60023", grupo:"social" },
  { id:"bluesky", label:"Bluesky", cor:"#1185FE", grupo:"social" },
  { id:"snapchat", label:"Snapchat", cor:"#F7B500", grupo:"social" },
  { id:"googlebusiness", label:"Google Business", cor:"#4285F4", grupo:"social" },
  { id:"whatsapp", label:"WhatsApp", cor:"#25D366", grupo:"conversas" },
  { id:"telegram", label:"Telegram", cor:"#26A5E4", grupo:"conversas" },
  { id:"discord", label:"Discord", cor:"#5865F2", grupo:"conversas" },
  { id:"slack", label:"Slack", cor:"#611F69", grupo:"conversas" },
  { id:"metaads", label:"Meta Ads", cor:"#1877F2", grupo:"ads" },
  { id:"googleads", label:"Google Ads", cor:"#4285F4", grupo:"ads" },
  { id:"linkedinads", label:"LinkedIn Ads", cor:"#0A66C2", grupo:"ads" },
  { id:"tiktokads", label:"TikTok Ads", cor:"#111111", grupo:"ads" },
  { id:"pinterestads", label:"Pinterest Ads", cor:"#E60023", grupo:"ads" },
  { id:"xads", label:"X Ads", cor:"#111111", grupo:"ads" },
  { id:"openaiads", label:"OpenAI Ads", cor:"#0F9D58", grupo:"ads" },
];

// ── Dados de exemplo de redes sociais (SOC) ──
export interface SocData {
  label: string; cor: string; handle: string; eyebrow: string;
  kpis?: [string, string, string][]; chartLabel?: string; chartVals?: number[];
  top?: [string, string][]; placeholder?: boolean;
}
export const SOC: Record<string, SocData> = {
  tiktok: { label:"TikTok", cor:"#121111", handle:"@seahubcoworking", eyebrow:"Canais · TikTok",
    kpis:[["Seguidores","3.240","+280 no mês"],["Visualizações","128k","no mês"],["Curtidas","9,4k","no mês"],["Engajamento","7,3%","por vídeo"]],
    chartLabel:"Visualizações por mês", chartVals:[62,74,88,95,110,121,128],
    top:[["Bastidores do CarnaHub","42k views"],["Tour Seaway em 30s","31k views"],["3 dicas de CNPJ","24k views"]] },
  linkedin: { label:"LinkedIn", cor:"#0A66C2", handle:"Seahub Coworking", eyebrow:"Canais · LinkedIn",
    kpis:[["Seguidores","2.180","+95 no mês"],["Impressões","41k","no mês"],["Cliques","1,3k","no mês"],["Engajamento","4,1%","por post"]],
    chartLabel:"Impressões por mês", chartVals:[22,26,29,33,36,39,41],
    top:[["Case: empresa que cresceu no coworking","8,9k impr."],["Vaga: analista comercial","6,2k impr."],["Endereço fiscal explicado","5,1k impr."]] },
  youtube: { label:"YouTube", cor:"#FF0000", handle:"Seahub Coworking", eyebrow:"Canais · YouTube",
    kpis:[["Inscritos","1.120","+40 no mês"],["Visualizações","18k","no mês"],["Tempo de exibição","640h","no mês"],["CTR miniatura","5,8%","médio"]],
    chartLabel:"Visualizações por mês", chartVals:[9,11,12,14,15,17,18],
    top:[["Tour completo pelo Seahub","6,4k views"],["Como funciona o Seabox","3,8k views"],["Meetup Empreendedoras (recap)","2,9k views"]] },
  x: { label:"X / Twitter", cor:"#111111", eyebrow:"Canais · X", handle:"@seahubcoworking", placeholder:true },
  facebook: { label:"Facebook", cor:"#1877F2", eyebrow:"Canais · Facebook", handle:"Seahub Coworking", placeholder:true },
  threads: { label:"Threads", cor:"#111111", eyebrow:"Canais · Threads", handle:"@seahubcoworking", placeholder:true },
  reddit: { label:"Reddit", cor:"#FF4500", eyebrow:"Canais · Reddit", handle:"u/seahub", placeholder:true },
  pinterest: { label:"Pinterest", cor:"#E60023", eyebrow:"Canais · Pinterest", handle:"Seahub", placeholder:true },
  bluesky: { label:"Bluesky", cor:"#1185FE", eyebrow:"Canais · Bluesky", handle:"@seahub.bsky", placeholder:true },
  snapchat: { label:"Snapchat", cor:"#F7B500", eyebrow:"Canais · Snapchat", handle:"seahub", placeholder:true },
  googlebusiness: { label:"Google Business", cor:"#4285F4", eyebrow:"Canais · Google Business", handle:"Seahub Coworking", placeholder:true },
};

// ── Persona & Público ──
export const PERSONA_KPIS: [string, string, string][] = [
  ["Clientes na base","5.500","41,2% PJ · 58,8% PF"],
  ["Contratos ativos","1.301","+1.565 históricos"],
  ["MRR total","R$ 374,6k","ticket médio varia por produto"],
  ["Conversão geral","39,4%","10.327 deals no CRM"],
];
export const PERSONA_PRODUTOS: [string, string, string, string][] = [
  ["Endereço Fiscal","1.178 cts","R$ 147,7k MRR","39,4% do MRR · ticket R$125 · motor de volume (90,5% dos contratos)"],
  ["Sala Privativa","71 cts","R$ 217,1k MRR","57,9% do MRR · ticket R$3.057 · a margem vem daqui"],
  ["Seabox","19 cts","R$ 496 MRR","satélite · 14,1% conversão · diagnosticar antes de investir"],
  ["Estação · Hub · Outros","33 cts","R$ 9,3k MRR","2,7% do MRR somados"],
];
export interface PersonaSeed {
  tag: string; handle: string; emoji: string; cover: string; name: string;
  representa: string; comunica: string; dores: string[]; canais: string; gatilho: string; stats: [string, string][];
}
export const PERSONAS: PersonaSeed[] = [
  { tag:"P0 · Marca", handle:"@oseahuber", emoji:"🚀", cover:"linear-gradient(120deg,#121111,#3a3a3a)", name:"O Seahuber",
    representa:"A alma da marca — empreendedores, liberais e criativos de Natal/RN que valorizam pertencer a algo vivo.",
    comunica:"Trabalhar é melhor junto: estrutura sem burocracia, comunidade sem formalidade.",
    dores:["Isolamento de quem trabalha sozinho","Ambiente sem energia e troca","Burocracia que trava o corre"],
    canais:"Conteúdo de marca, eventos (CarnaHub, aniversário) e comunidade.", gatilho:"Sentir que faz parte de algo maior.",
    stats:[["Marca","persona-guia"],["1.000+","Seahubers"],["Todos","produtos"]] },
  { tag:"P1 · Endereço Fiscal", handle:"@abrindo.cnpj", emoji:"🏢", cover:"linear-gradient(120deg,#FF001E,#ff5a6e)", name:"Quem precisa de endereço",
    representa:"PJ MEI/ME em abertura (mediana 37a) — Saúde, Tech, Imóveis, Consultoria, Advocacia.",
    comunica:"Endereço legalizado, barato e rápido pro seu CNPJ, sem alugar sala.",
    dores:["Não ter endereço comercial","Custo de sala fixa","Burocracia de regularização"],
    canais:"Google (auto-serviço) e Programa de Parceria (canal nº1).", gatilho:"Preço claro + ativação em 24h.",
    stats:[["48,5%","conversão"],["R$125","ticket"],["Parceria","canal nº1"]] },
  { tag:"P2 · Sala Privativa", handle:"@empresa.crescendo", emoji:"🏙️", cover:"linear-gradient(120deg,#00BBC5,#5fe0e8)", name:"Empresa que precisa de sede",
    representa:"Empresa de 2–15 pessoas em crescimento buscando uma base fixa e profissional.",
    comunica:"Uma sede pronta pra operar — com comunidade e credibilidade junto.",
    dores:["Crescer sem estrutura","Imagem e credibilidade","Gestão de escritório"],
    canais:"Tour presencial + prova social (não responde a mídia paga).", gatilho:"Ver o espaço e a comunidade ao vivo — ciclo de ~4,3 negociações.",
    stats:[["18,9%","conversão"],["R$3.057","ticket"],["Presencial","decide vendo"]] },
  { tag:"P3 · Salas avulsas", handle:"@atende.cliente", emoji:"💼", cover:"linear-gradient(120deg,#FF9F0A,#ffc35a)", name:"Profissional por demanda",
    representa:"Liberal, consultor, advogado ou psicólogo que atende clientes por demanda.",
    comunica:"Sala pronta por hora ou turno — reserve pelo WhatsApp em minutos.",
    dores:["Atender cliente sem estrutura","Flexibilidade de horário","Praticidade na reserva"],
    canais:"WhatsApp (chega com data, hora e nº de pessoas).", gatilho:"Resposta rápida + foto do espaço antes de fechar.",
    stats:[["44,4%","reunião"],["38,7%","atendimento"],["WhatsApp","canal"]] },
  { tag:"P4 · Auditório", handle:"@faz.evento", emoji:"🎤", cover:"linear-gradient(120deg,#8E5BE0,#b08ef0)", name:"Quem organiza eventos",
    representa:"Empresa, educador ou produtor de evento para 20–60 pessoas.",
    comunica:"Espaço com AV completo pro seu evento, sem dor de cabeça.",
    dores:["Espaço + equipamento AV","Capacidade adequada","Aprovação de um superior"],
    canais:"Reserva com data e nº de pessoas definidos.", gatilho:"AV completo + capacidade confirmada.",
    stats:[["38,6%","conversão"],["20–60","pessoas"],["AV","completo"]] },
];
export const PERSONA_INSIGHTS: [string, string][] = [
  ["Silêncio é a maior perda","53,4% dos deals perdidos foram \"não respondeu\" — preço soma 11,9%. Régua de follow-up é a intervenção de maior retorno."],
  ["A base ativa converte melhor","Cliente Ativo converte a 79,5%. Upsell EF→Privativa: 7 de 1.162 elegíveis. Cada cliente de EF é um lead quente de privativa."],
  ["Parceria é o melhor canal","88% de conversão e 57,3% do EF. Maior volume E maior eficiência. Multiplicar parceiros é a alavanca mais clara."],
  ["Saúde está pronta pra comprar","87,8% de conversão e a maior base identificada (~330). Campanha dedicada tem o maior retorno por segmento."],
];

// ── Concorrência ──
export type CompCategoria = "espaco" | "marca" | "certificado" | "cobranca";
export interface CompItem { n: string; ig: string; li: number; yt: number; dom?: string }
export const COMP: Record<CompCategoria, { label: string; list: CompItem[] }> = {
  espaco: { label:"Espaço & EV", list:[
    { n:"Hub Plural", ig:"@hubplural_oficial", li:1, yt:1, dom:"hubplural.com.br" },{ n:"Natal Coworking", ig:"@natalcoworking", li:0, yt:0, dom:"natalcoworking.com.br" },{ n:"Febracis", ig:"@febracisrn", li:0, yt:0, dom:"febracis.com" },{ n:"Company Hero", ig:"@companyhero_br", li:1, yt:1, dom:"companyhero.com" },{ n:"Regus Brasil", ig:"@regus_brasil", li:1, yt:0, dom:"regus.com" },{ n:"Hus Coworking", ig:"@huscoworking", li:1, yt:0 },{ n:"Lions Coworking", ig:"@lionscoworking", li:1, yt:0 },{ n:"Rio Coworking", ig:"@rio.coworking", li:0, yt:1 },{ n:"CoDesign", ig:"@codesigncoworking", li:0, yt:1 },{ n:"Brains", ig:"@brainscoworking", li:1, yt:1 },{ n:"Amora", ig:"@amoracoworking", li:1, yt:0 },{ n:"Smart Office", ig:"@smartofficenatal", li:0, yt:0 },{ n:"Go Work", ig:"@goworkcoworking", li:1, yt:1 },{ n:"We Work", ig:"@wework_br", li:1, yt:1, dom:"wework.com" },
  ]},
  marca: { label:"Registro de Marca", list:[
    { n:"Consolide sua Marca", ig:"@consolidesuamarca", li:1, yt:1 },{ n:"Forza", ig:"@forzaregistrodemarca", li:1, yt:1 },{ n:"Zenite", ig:"@zenitemarcas", li:1, yt:1 },{ n:"Farol M&P", ig:"@farolmarcasepatentes", li:0, yt:1 },{ n:"Empodere", ig:"@empoderetuamarca", li:0, yt:0 },
  ]},
  certificado: { label:"Certificado Digital", list:[
    { n:"Certisign", ig:"@certisign", li:1, yt:1 },{ n:"CERTMAIS", ig:"@certmais", li:0, yt:1 },{ n:"Acert", ig:"@acertcertificadoradigital", li:0, yt:0 },
  ]},
  cobranca: { label:"Cobrança", list:[
    { n:"Contabilizei", ig:"@contabilizei", li:0, yt:0 },{ n:"Conta Azul", ig:"@contaazul", li:0, yt:0 },
  ]},
};

// ── Ambiente / Perfil default (state.perfil do blueprint) ──
export const PERFIL_DEFAULT = {
  empresa: "Seahub Coworking",
  canais: ["Instagram","Google Ads","Meta Ads","WhatsApp"],
  produtos: ["Endereço Fiscal","Salas de Reunião","Auditórios","Salas Privativas","Estações","Seabox"],
  segmento: "Coworking · escritórios flexíveis",
  cidade: "Natal/RN",
  site: "seahubcoworking.com.br",
};
