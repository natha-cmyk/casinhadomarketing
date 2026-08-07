// Seed do Prisma — popula APENAS as tabelas que o usuário edita (PRD §6).
// Dados read-mostly (IG/ADS/CANAIS/LEADS_M/SOC/...) ficam em lib/seed-data.ts.
// Rodar: `npx prisma db seed` (após `prisma migrate deploy`/`migrate dev`).
import { PrismaClient, type CompCategoria, type PostStatus } from "@prisma/client";
import {
  OKR2026,
  PERSONAS,
  COMP,
  POSTS_SEED,
  PERFIL_DEFAULT,
} from "../lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  // ── EnvConfig (singleton) ──
  await prisma.envConfig.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      redes: { instagram: true, tiktok: false, linkedin: false, youtube: false },
      contas: { instagram: true, tiktok: false, linkedin: false, youtube: false },
      paineis: {},
      cfgOpen: {},
      impOpen: false,
    },
  });

  // ── Perfil / Ambiente (singleton) ──
  await prisma.perfil.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      empresa: PERFIL_DEFAULT.empresa,
      segmento: PERFIL_DEFAULT.segmento,
      cidade: PERFIL_DEFAULT.cidade,
      site: PERFIL_DEFAULT.site,
      canais: PERFIL_DEFAULT.canais,
      produtos: PERFIL_DEFAULT.produtos,
      relacao: {},
    },
  });

  // ── OKR: Objetivo (singleton) + Áreas + KRs ──
  await prisma.objetivo.upsert({
    where: { id: "main" },
    update: { texto: OKR2026.objetivo },
    create: { id: "main", texto: OKR2026.objetivo },
  });
  await prisma.kR.deleteMany();
  await prisma.area.deleteMany();
  for (let ai = 0; ai < OKR2026.areas.length; ai++) {
    const a = OKR2026.areas[ai];
    await prisma.area.create({
      data: {
        nome: a.area,
        ordem: ai,
        krs: {
          create: a.krs.map((k, ki) => ({
            kr: k.kr,
            alvo: k.alvo,
            un: k.un,
            tag: k.tag,
            resp: k.resp,
            ordem: ki,
          })),
        },
      },
    });
  }

  // ── Personas (P0–P4) ──
  await prisma.persona.deleteMany();
  for (let i = 0; i < PERSONAS.length; i++) {
    const p = PERSONAS[i];
    await prisma.persona.create({
      data: {
        tag: p.tag,
        handle: p.handle,
        emoji: p.emoji,
        cover: p.cover,
        nome: p.name,
        representa: p.representa,
        comunica: p.comunica,
        dores: p.dores,
        canais: p.canais,
        gatilho: p.gatilho,
        stats: p.stats,
        ordem: i,
      },
    });
  }

  // ── Concorrentes (24 players, 4 categorias) ──
  await prisma.concorrente.deleteMany();
  const cats = Object.keys(COMP) as (keyof typeof COMP)[];
  for (const cat of cats) {
    const list = COMP[cat].list;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      await prisma.concorrente.create({
        data: {
          nome: c.n,
          ig: c.ig,
          linkedin: !!c.li,
          youtube: !!c.yt,
          dominio: c.dom ?? null,
          categoria: cat as CompCategoria,
          ordem: i,
        },
      });
    }
  }

  // ── Posts do calendário (seed) ──
  await prisma.post.deleteMany();
  for (const p of POSTS_SEED) {
    await prisma.post.create({
      data: {
        data: new Date(p.y, p.m, p.d),
        hora: p.hora,
        titulo: p.titulo,
        canal: p.canal,
        perfil: p.perfil,
        colab: p.colab,
        pilar: p.pilar,
        formato: p.formato,
        funil: p.funil,
        legenda: p.legenda,
        cta: p.cta,
        hashtags: p.hashtags,
        arquivo: p.arquivo,
        status: p.status as PostStatus,
        contas: p.contas,
      },
    });
  }

  // resumo
  const [areas, krs, personas, comps, posts] = await Promise.all([
    prisma.area.count(),
    prisma.kR.count(),
    prisma.persona.count(),
    prisma.concorrente.count(),
    prisma.post.count(),
  ]);
  console.log(`Seed OK → áreas:${areas} KRs:${krs} personas:${personas} concorrentes:${comps} posts:${posts}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
