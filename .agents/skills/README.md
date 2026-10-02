# Skills locais — quando usar

Skills instaladas via `skills-lock.json`. Restaurar: `npx skills experimental_install -y`. **Antes de usar:** leia só o `SKILL.md` da skill indicada (não carregue todas).

## Setup do repo (Matt Pocock)

| Doc | Conteúdo |
|---|---|
| `docs/agents/issue-tracker.md` | Tickets em `.scratch/` |
| `docs/agents/triage-labels.md` | Status de triage |
| `docs/agents/domain.md` | Glossário + ADRs |
| `.scratch/README.md` | Exemplo de spec/ticket |

Configuração inicial: skill **`setup-matt-pocock-skills`** (já aplicada).

## Fluxo de engenharia (Matt Pocock)

| Etapa | Skill | Caminho |
|---|---|---|
| Ideia → spec | **to-spec** | `to-spec/SKILL.md` |
| Spec → tickets | **to-tickets** | `to-tickets/SKILL.md` |
| Feature grande → mapa | **wayfinder** | `wayfinder/SKILL.md` |
| Priorizar / qualificar | **triage** | `triage/SKILL.md` |
| Entrevista HITL (grill) | **grilling** | `grilling/SKILL.md` |
| Implementar tickets | **implement** | `implement/SKILL.md` |
| TDD em seams | **tdd** | `tdd/SKILL.md` |
| Revisar diff | **code-review** | `code-review/SKILL.md` |
| Refinar domínio | **grill-with-docs** / **domain-modeling** | `grill-with-docs/SKILL.md` · `domain-modeling/SKILL.md` |
| Varredura de arquitetura | **improve-codebase-architecture** | `improve-codebase-architecture/SKILL.md` |
| Módulos / seams | **codebase-design** | `codebase-design/SKILL.md` |

## Stack e domínio

| Tarefa | Skill | Caminho | Não usar para |
|---|---|---|---|
| Schema, migration, RLS, índices, SQL, performance Postgres | **supabase-postgres-best-practices** | `supabase-postgres-best-practices/SKILL.md` | Substituir `DESIGN.md` ou `docs/padroes.md` |
| Queries Prisma, filtros, transações | **prisma-client-api** | `prisma-client-api/SKILL.md` | Auth/tenancy (ver `docs/arquitetura.md`) |
| React/Next performance (waterfall, bundle, re-render) | **vercel-react-best-practices** | `vercel-react-best-practices/SKILL.md` | Identidade visual Seahub |
| Auditoria UX/a11y genérica | **web-design-guidelines** | `web-design-guidelines/SKILL.md` | Tokens/cores — use `DESIGN.md` |
| Copy de marketing do site | **copywriting** | `copywriting/SKILL.md` | Copy in-app do painel |
| SEO do site público | **seo-audit** | `seo-audit/SKILL.md` | Painel autenticado |
| Descobrir outras skills | **find-skills** | `find-skills/SKILL.md` | — |

## RLS

Para qualquer mudança em `prisma/` ou SQL de tenant: carregar **supabase-postgres-best-practices** e seguir `references/security-rls-*.md`. O projeto adota RLS como defesa em profundidade — ver `docs/arquitetura.md`.

## Prioridade de leitura

1. `AGENTS.md` + regras `.cursor/rules/`
2. `CODING_STANDARDS.md` → `docs/arquitetura.md` / `docs/padroes.md` / `DESIGN.md`
3. `GLOSSARY.md` + `docs/adr/`
4. `docs/agents/*` (tracker, triage, domínio)
5. Skill da área (tabelas acima)
6. Código canônico citado nos docs

## Testes

`npm test` (Vitest). Seams em `lib/` — ver `docs/padroes.md` → Testes. Skills **`tdd`** e **`implement`** assumem suite verde ao final.
