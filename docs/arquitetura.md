# Arquitetura

Visão técnica do que está implementado + direção de **RLS**. Skill principal para banco: **`.agents/skills/supabase-postgres-best-practices`**.

## Visão geral

```
[Browser]
   │  Supabase Auth (cookie)
   ▼
[Next.js 16]
   ├─ middleware → páginas protegidas (não /api)
   ├─ app/(app)/* → Shell + Views (Zustand)
   ├─ app/api/* → Route Handlers + Prisma
   └─ lib/* → zernio, stripe, llm, crm (server-only)
        ▼
[PostgreSQL / Supabase]
   ├─ Prisma (connection service role — migrations, app server)
   └─ RLS (políticas por workspace — defesa em profundidade)
```

## Auth e sessão

1. **Supabase Auth** — login/cadastro/OAuth; `User.id` espelha `auth.users.id`.
2. **Middleware** (`lib/supabase/middleware.ts`) — renova sessão; sem usuário redireciona `/login`. `/api` **excluído** do matcher.
3. **Modo dev:** se `NEXT_PUBLIC_SUPABASE_*` vazios, middleware libera todas as páginas.
4. **Provisionamento** (`lib/provision.ts`) — 1º login cria `User`, `Workspace`, `EnvConfig`, `Perfil`, `Objetivo`; convite pendente entra no workspace do convidador; advisory lock por `userId`.
5. **Onboarding** — `workspace.onboarded === false` → redirect `/onboarding` (`app/(app)/layout.tsx`).

## Tenancy

- **Unidade:** `Workspace` (ver `GLOSSARY.md`).
- **Autorização app:** `getActiveWorkspaceId()` resolve workspace após `provisionWorkspace()`; rotas API usam esse id em todo `where`.
- **Membership:** checar papel quando a operação exige `owner`.
- **Admin plataforma:** `ADMIN_EMAILS` + `getAdminUser()` — separado de membership; rotas `/app/admin` e `/api/admin/*`.

## RLS (Row Level Security)

**Direção do projeto:** usar RLS no Postgres como camada de segurança além do filtro na aplicação. Seguir skill **`supabase-postgres-best-practices`** → referências `security-rls-basics.md`, `security-rls-performance.md`.

### Por quê

- Prisma com `DATABASE_URL` de serviço **bypassa RLS** — o app continua obrigado a filtrar `workspaceId`.
- RLS protege: acesso SQL direto, bugs que omitam `where`, futuros clients Supabase com JWT do usuário.

### Modelo de policy (alvo)

Tabelas com `workspaceId` (ex.: `Post`, `EnvConfig`, `Perfil`, …):

```sql
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_workspace_member" ON "Post"
  FOR ALL
  TO authenticated
  USING (
    "workspaceId" IN (
      SELECT "workspaceId" FROM "Membership"
      WHERE "userId" = auth.uid()::text
    )
  );
```

Ajustar nomes de tabela/coluna ao SQL gerado pelas migrations Prisma. Para `FORCE ROW LEVEL SECURITY` em dados sensíveis, ver referências da skill.

### Estado atual

- Migrations existentes **não** habilitam RLS ainda — ao tocar schema de tenant, **incluir** `ENABLE ROW LEVEL SECURITY` + policies na mesma migration.
- Até policies estarem em todas as tabelas: **nunca** confiar só no RLS; manter filtro `workspaceId` em `lib/auth` + handlers.

### Prisma vs JWT

| Caminho | RLS |
|---|---|
| Route Handler → `prisma` (service role) | Bypass — filtro na app |
| Supabase client com JWT do usuário | RLS aplica |
| Cron / webhook / admin com service role | Policies específicas ou bypass documentado |

## Integração Zernio

- Cliente REST: `lib/zernio.ts` — `ZERNIO_API_KEY` server-only; timeout 8s; erros neutros na UI.
- **Profile:** `Workspace.zernioProfileId` (primário) + `WorkspaceProfile` (extras) — `lib/profiles.ts`.
- OAuth connect: `app/api/zernio/connect` — popup; contas listadas em `app/api/zernio/accounts`.
- Rotas: analytics, ads, publish, inbox, gbp, … sob `app/api/zernio/*`.

## LLM / Agentes

- **BYO:** `LlmConfig` por workspace (`lib/llm.ts`).
- **Fallback agência:** `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` (env, teste).
- **Chat:** `POST /api/agents/chat` — stream; contexto em `lib/agents.ts`.
- **UI:** `AgentDock` — agente por seção (`lib/agents-meta.ts` → `panelOfView`).

## Billing (Stripe)

- `lib/stripe.ts` — checkout, portal, webhook.
- Modelos: `Subscription`, `Invoice`, `Referral`.
- Webhook: `app/api/stripe/webhook` — `STRIPE_WEBHOOK_SECRET`.
- Admin manual: `app/api/admin/billing` enquanto necessário.

## CRM

- `CrmConfig`, `Lead` por workspace.
- Sync: `lib/crm-sync.ts`, cron `/api/cron/crm-sync`.
- Webhook inbound: `/api/crm/webhook/[workspaceId]`.

## Cron (Vercel)

`vercel.json` — `crm-sync`, `health`, `purge-trash`, `reminders`. Auth: `CRON_SECRET`.

## Persistência na UI

```
mount → Hydrator → fetchAll() paralelo (/api/config, perfil, okr, posts, …)
       → useStore.hydrate()
edit  → store update → debounce 600ms → PUT /api/*
```

Sem banco: fetch falha silenciosamente; UI usa defaults da store.

## Deploy

- **Vercel:** `npm run vercel-build` (generate, preflight, migrate deploy, build); região `gru1`.
- **EasyPanel:** Node 22 (`nixpacks.toml`).

## Segredos (nunca no client)

`ZERNIO_*`, `STRIPE_*`, chaves em `LlmConfig`, `CRON_SECRET`, `RESEND_API_KEY`, connection strings.
