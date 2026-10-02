# AGENTS.md — Casinha do Marketing

Painel de marketing **multi-tenant** (SaaS): cada `Workspace` é um cliente. Auth via Supabase; dados isolados por `workspaceId`; **RLS no Postgres** como defesa em profundidade; integração Zernio (REST); agentes via LLM BYO.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node **22.x** (`package.json` → `engines`) |
| App | **Next.js 16.3** (App Router) · **React 19.2** · **TypeScript** |
| Estilo | **Tailwind v4** + design system em `app/globals.css` |
| Estado UI | **Zustand** (`lib/store.ts`) |
| Banco | **Prisma 6.19** + **PostgreSQL** (Supabase: pooler + direct URL) |
| Auth | **Supabase Auth** (`@supabase/ssr`) |
| Pagamentos | **Stripe** · Ícones: `lucide-react` + SVG em `lib/nav.ts` |
| Gráficos | SVG em `components/Chart.tsx` |

## Comandos

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run db:verify
npm run build
```

Banco: `npx prisma migrate dev` · `npm run db:seed` · Deploy: `npm run vercel-build`

## Documentação (divulgação progressiva)

| Tarefa | Ler |
|---|---|
| Sempre | Este arquivo + regras `.cursor/rules/` |
| Standards (code-review) | `CODING_STANDARDS.md` |
| UI | `DESIGN.md` |
| Auth, tenancy, RLS, integrações | `docs/arquitetura.md` |
| Padrão página/view/API | `docs/padroes.md` |
| Termos (Workspace, Perfil, Profile…) | `GLOSSARY.md` |

**Não** usar `docs/historico/` como spec.

## Skills (`.agents/skills/`)

Carregue a **`SKILL.md`** indicada **antes** de implementar. Índice completo: `.agents/skills/README.md`.

| Tarefa | Skill |
|---|---|
| Conversa → spec em `.scratch/` | `to-spec` |
| Spec → tickets | `to-tickets` |
| Implementar tickets | `implement` (+ `tdd` nos seams) |
| Feature grande / incerteza | `wayfinder` |
| Priorizar tickets locais | `triage` |
| Entrevista HITL (grill) | `grilling` (+ `domain-modeling`) |
| Glossário / ADR | `domain-modeling`, `grill-with-docs` |
| Schema, migration, **RLS**, índices, SQL | `supabase-postgres-best-practices` |
| Queries Prisma | `prisma-client-api` |
| Performance React/Next | `vercel-react-best-practices` |
| Módulos / seams | `codebase-design` |
| UI Seahub | `DESIGN.md` (não `web-design-guidelines` sozinha) |
| Revisão de mudanças | `code-review` |

**RLS:** ao alterar tabelas de tenant, seguir a skill `supabase-postgres-best-practices` (`security-rls-*`) e `docs/arquitetura.md`. Incluir policies na migration. O app **continua** filtrando `workspaceId` (Prisma service role bypassa RLS).

## Agent skills

### Issue tracker

Issues em markdown local (`.scratch/<feature>/`). Ver `docs/agents/issue-tracker.md`.

### Domain docs

Layout single-context: glossário em `GLOSSARY.md`, ADRs em `docs/adr/`. Ver `docs/agents/domain.md`.

### Triage labels

Categorias (`bug`, `enhancement`) + estados (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Em tickets locais: linhas `Category:` e `Status:` no topo. Ver `docs/agents/triage-labels.md`.

## Mapa de pastas

```
app/(app)/          painel autenticado
app/admin/          operação interna
app/api/            Route Handlers
components/shell/   Sidebar, Toolbar, AgentDock
components/views/   *View.tsx
components/ui.tsx   primitivos visuais
lib/                auth, prisma, zernio, llm, store, scope, …
prisma/             schema + migrations
.scratch/           specs e tickets (ver README)
docs/agents/        config issue tracker, triage, domínio
.out-of-scope/      enhancements rejeitados (triage)
GLOSSARY.md         vocabulário de domínio
CODING_STANDARDS.md padrões para code-review
.cursor/rules/      regras por glob
```

## Tenancy (resumo)

- `getActiveWorkspaceId()` / `getActiveWorkspace()` em **toda** API de cliente (`lib/auth.ts`).
- Middleware protege **páginas**, não `/api` — cada handler autentica.
- **RLS** nas tabelas com `workspaceId` — ver `docs/arquitetura.md`.
- Glossário: `GLOSSARY.md`.

Detalhes de Zernio, Stripe, LLM, CRM, cron: `docs/arquitetura.md`.  
Padrão de código: `docs/padroes.md`.

## UI e copy

Tarefa de tela: **`DESIGN.md`**. PT-BR; **"LLM"** na UI; erros neutros (sem nome de fornecedor).

## Variáveis de ambiente

Ver `.env.example` (Postgres, Supabase, Zernio, Stripe, LLM, Resend, cron, admin).

## Proibições

1. Dado de cliente sem `workspaceId` validado + membership; não confiar em `workspaceId` do body.
2. Segredos só no servidor; não logar chaves LLM/Zernio/Stripe.
3. Não importar `lib/zernio`, `lib/stripe`, `lib/llm` em `"use client"`.
4. Não subir Prisma 7 sem migração explícita.
5. Migration de tenant **sem** RLS quando a tabela tem `workspaceId` (exceto bootstrap documentado).

## Definição de pronto

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Se alterou seed: `npm run db:verify`.

## Ponteiros no código

| Assunto | Arquivo |
|---|---|
| Modelo de dados | `prisma/schema.prisma` |
| Auth + workspace | `lib/auth.ts`, `lib/provision.ts` |
| Zernio | `lib/zernio.ts` |
| Agentes | `lib/agents.ts`, `app/api/agents/chat/route.ts` |
| Design | `DESIGN.md`, `components/ui.tsx` |
