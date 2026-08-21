// Preflight de migração (roda ANTES do `prisma migrate deploy` no build).
// Um processo externo com a pasta de migrações ANTIGA (init nomeada
// `20260807180759_init`, hoje squashada pra `0_init`) reinsere periodicamente
// uma linha FALHA dessa migração fantasma no `_prisma_migrations` do banco
// compartilhado — o que dispara P3009 e derruba TODO deploy.
//
// Este script apaga SOMENTE linhas fantasma NÃO concluídas (failed/rolled_back)
// dessa migração — nunca toca em migrações aplicadas (finished_at preenchido).
// É best-effort: qualquer erro é logado e o script sai 0, pra nunca travar o build.
import { PrismaClient } from "@prisma/client";

const PHANTOM = "20260807180759_init";

async function main() {
  const prisma = new PrismaClient();
  try {
    const n = await prisma.$executeRawUnsafe(
      `DELETE FROM "_prisma_migrations" WHERE migration_name = $1 AND finished_at IS NULL`,
      PHANTOM
    );
    console.log(`[db-preflight] linhas fantasma removidas (${PHANTOM}): ${n}`);
  } catch (e) {
    console.warn(`[db-preflight] ignorado (não bloqueia build): ${e?.message || e}`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(0));
