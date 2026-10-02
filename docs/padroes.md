# Padrões de código

Como o repositório **já** organiza código. Skill: **`.agents/skills/codebase-design`** (módulos profundos, seams).

Arquivo canônico por padrão — copie o vizinho, não invente estrutura nova.

## Páginas (App Router)

**Padrão:** página fina → view.

| Canônico | Exemplo |
|---|---|
| `app/(app)/page.tsx` | `import { PainelView } from "@/components/views/PainelView"` → `return <PainelView />` |
| `app/(app)/instagram/page.tsx` | idem com `InstagramView` |
| `app/(app)/layout.tsx` | Server: `getActiveWorkspace()` + redirect onboarding |

**Não:** buscar Prisma na página; lógica de negócio pesada no `page.tsx`.

## Views

**Padrão:** `components/views/*View.tsx` — client quando usa Zustand/interação.

| Responsabilidade | Sim | Não |
|---|---|---|
| UI + estado local | ✓ | |
| Ler/escrever `useStore` | ✓ | |
| `fetch('/api/...')` via `lib/api.ts` | ✓ | |
| Import Prisma / `lib/zernio` | | ✗ |
| Segredos / `process.env` secreto | | ✗ |

Views grandes (`PersonalizacaoView`, `GeracaoView`, `CalendarioView`, `PostModal`): editar por seção; extrair subcomponente só quando a tarefa pedir.

## Estado UI (Zustand)

- Store: `lib/store.ts` — período, OKR, posts, personas, config de UI, etc.
- **View atual:** rota (`lib/nav.ts`), **não** campo na store.
- Hidratação: `components/Hydrator.tsx` — `fetchAll()` no mount, saves debounced 600ms via `lib/api.ts`.

## API (Route Handlers)

**Canônico:** `app/api/config/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export async function GET() {
  const ws = await getActiveWorkspaceId();
  if (!ws) return NextResponse.json(null, { status: 401 });
  const row = await prisma.envConfig.findUnique({ where: { workspaceId: ws } });
  return NextResponse.json(row);
}
```

| Tipo de rota | Auth |
|---|---|
| Dado do cliente | `getActiveWorkspaceId()` / `getActiveWorkspace()` |
| Admin plataforma | `getAdminUser()` |
| Cron | `Bearer CRON_SECRET` |
| Webhook Stripe | `STRIPE_WEBHOOK_SECRET` |
| Proxy Zernio | workspace da sessão + `lib/zernio.ts` |

Regra Cursor: `.cursor/rules/api.mdc`

## Módulos server-only (seams)

| Módulo | Papel |
|---|---|
| `lib/auth.ts` | Sessão Supabase + workspace ativo |
| `lib/provision.ts` | 1º acesso, convites, advisory lock |
| `lib/zernio.ts` | REST integração redes (erros neutros) |
| `lib/stripe.ts` | Billing |
| `lib/llm.ts` | Resolve LLM BYO + fallback agência |
| `lib/profiles.ts` | Multi-profile Zernio por workspace |
| `lib/crm-sync.ts` | Sync CRM |

Importar **apenas** em server components, route handlers ou outros `lib/*` — nunca em `"use client"`.

## Prisma

- Client singleton: `lib/prisma.ts`
- Toda entidade de cliente: `workspaceId` no `where`/`data`
- Migrations + RLS: ver `docs/arquitetura.md` e `.cursor/rules/prisma.mdc`
- Skill: **`prisma-client-api`**

## UI

- Primitivos: `components/ui.tsx`
- Design: `DESIGN.md`, `app/globals.css`
- Ícones de rede: `<Ic name="…" />` + `ICONS` em `lib/nav.ts`
- Gráficos: `lib/charts.ts` → `<Chart svg={…} />`

## Formatação e escopo

- Números/moeda: `lib/format.ts` (`fmt`, `money`, `pct`, `kfmt`)
- Período: `lib/scope.ts` (`scopeVal`, `scopeLabelText`, `StatusTier` → `<Pill>`)

## Testes

- Runner: **Vitest** — `npm test` (CI) · `npm run test:watch` (local)
- Arquivos: `**/*.{test,spec}.ts` ao lado do módulo ou em `lib/`
- **Seams preferidos:** funções puras em `lib/` (`scope.ts`, `format.ts`, parsers) — sem React/Prisma no primeiro ciclo TDD
- Testar comportamento pela interface pública; não acoplar a detalhes internos
- Skills: **`tdd`** (loop red-green) · **`implement`** (roda suite ao final)
- Standards: `CODING_STANDARDS.md`

Exemplo canônico: `lib/scope.test.ts` (escopo / período).

## Copy

- Português Brasil
- UI: **"LLM"**; sem nomes de fornecedor em erro visível ao usuário
