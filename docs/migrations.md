# Migrations Prisma (Postgres / Supabase)

Fluxo oficial: **desenvolver local** → **CI aplica em staging** → **CI aplica em produção**. O build da Vercel só roda `prisma generate` (`vercel-build`).

## Comandos

| Comando | Uso |
|--------|-----|
| `npx prisma migrate dev --name descricao_curta` | Criar migration local (branch de dev / banco local) |
| `npm run db:deploy` | CI e deploy manual: generate → validar URLs → **reconciliar** → `migrate deploy` |
| `npm run db:seed` | Seed (staging/local; não em prod sem processo) |

`db:deploy` encadeia:

1. `scripts/assert-db-env.mjs` — portas 6543/5432, aviso P1001 no GitHub  
2. `scripts/migrate-reconcile.ts` — alinha `_prisma_migrations` com schema já existente  
3. `prisma migrate deploy` — aplica só o que falta  

## Reconciliação retroativa (`migrate-reconcile`)

Bancos que já tinham schema antes do squash `0_init` (ou falha **P3018** / `type "Role" already exists`) não devem quebrar o CI.

O script trata automaticamente:

| Situação | Ação |
|----------|------|
| Linha **falha** fantasma `20260807180759_init` | Remove (não toca em migrações concluídas) |
| `0_init` **falhou** mas enum `Role` existe | `migrate resolve --rolled-back` + `--applied` em `0_init` |
| Histórico com `20260807180759_init` aplicada, sem `0_init` | Marca `0_init` como aplicada (squash) |
| Outras migrações aplicadas, `0_init` ausente | Marca `0_init` como aplicada |
| Histórico **vazio**, schema completo no “head” | Baseline: marca **todas** as pastas em `prisma/migrations` como aplicadas |
| Schema no **head**, histórico incompleto ou **P3018** no meio (`… already exists`) | `rolled-back` na falha + baseline das migrações ainda pendentes |
| Só falta a **última** migration do repo e o schema ainda não tem o head novo | **Não** faz baseline — `migrate deploy` aplica a migration nova |

Lógica testada em `lib/migrate-reconcile.ts` (`lib/migrate-reconcile.test.ts`).

**Marcador de schema no head:** `HEAD_SCHEMA_MARKER` em `lib/migrate-reconcile.ts` (hoje `EnvConfig.concCategorias`). Ao adicionar uma migration que passa a ser o novo head do banco, **atualize esse marcador** para uma coluna/tabela que só exista depois dessa migration — senão o baseline automático pode não reconhecer bancos desatualizados.

**Staging legado (sem coluna de head):** se existem `User` + enum `Role` + tabela `CrmConfig`, o reconcile trata como banco retroativo (baseline + `rolled-back` em falhas **P3009**).

## Criar uma migration nova (checklist)

1. `npx prisma migrate dev --name descricao_curta` no banco de **dev** (branch Supabase ou local).  
2. SQL **idempotente** quando possível (`IF NOT EXISTS`, etc.).  
3. Tabelas com `workspaceId`: **RLS** na mesma migration (`docs/arquitetura.md`, skill `supabase-postgres-best-practices`).  
4. Se for o novo head do repo: atualizar `HEAD_SCHEMA_MARKER` em `lib/migrate-reconcile.ts`.  
5. Push para `staging` → GitHub Actions job **Migrate (staging)**.  
6. Depois merge para `production` → **Migrate (production)**.  

**Não renomear** pastas de migrations já aplicadas em staging/prod. Squash só com processo explícito e reconciliação (como `0_init`).

## GitHub Actions

Workflow `.github/workflows/ci.yml`:

- Secrets staging: `DATABASE_URL_STAGING`, `DIRECT_URL_STAGING`  
- Secrets produção: `DATABASE_URL_PRODUCTION`, `DIRECT_URL_PRODUCTION`  
- `DIRECT_URL_*` no CI: **Session pooler** `*.pooler.supabase.com:5432` (evita P1001)  
- `DATABASE_URL_*`: Transaction pooler **6543** + `?pgbouncer=true`  

Mudanças em `prisma/**`, `scripts/migrate-reconcile.ts`, `lib/migrate-reconcile.ts` ou `assert-db-env` disparam migrate no push.

## Problemas comuns

| Erro | Causa | Correção |
|------|--------|----------|
| `type "Role" already exists` / P3018 | Schema sem `0_init` no histórico | Rodar `npm run db:deploy` (reconcile) ou ver tabela acima |
| P1001 `db.*.supabase.co:5432` | Direct URL no Actions | Session pooler no `DIRECT_URL_*` |
| Porta `6542` | Typo | Usar **6543** no `DATABASE_URL` |
| Migrate não roda no push | Sem diff em `prisma/**` | **Actions → CI → Run workflow** ou alterar migration |

## Referências

- `docs/ambientes-staging-producao.md` — Vercel Preview vs Production  
- `docs/supabase-variaveis-ambiente.md` — connection strings  
- `.cursor/rules/prisma.mdc` — RLS e modelagem  
