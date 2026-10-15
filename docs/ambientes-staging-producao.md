# Staging e produção

Checklist para isolar deploys, banco, billing e integrações. O app não define “ambiente” no código: tudo vem de **variáveis de ambiente** na Vercel (**Production** vs **Preview**).

Referências no repo: `.env.example`, `docs/arquitetura.md`, `lib/email.ts` (`APP_URL`), `lib/stripe.ts`, `vercel.json` (crons).

---

## Decisões adotadas

| Tópico | Decisão |
|--------|---------|
| **Vercel** | Um único projeto; ambientes **Production** + **Preview** |
| **Branch produção** | `production` → deploy **Production** na Vercel |
| **Branch staging** | `staging` → deploy **Preview** (staging oficial) |
| **Domínio staging** | `https://staging.casinha.seahubcoworking.com.br` (já configurado na Vercel) |
| **Domínio produção** | ex.: `https://casinha.seahubcoworking.com.br` (Production) |
| **Supabase** | Mesmo **projeto** Supabase; staging usa **database branch** (dev) no projeto principal |
| **Resend** | Mesma conta e mesma `RESEND_API_KEY` nos dois ambientes |

### Modelo resumido

| Camada | Produção | Staging |
|--------|----------|---------|
| Vercel | Env **Production**, branch `production` | Env **Preview**, branch `staging` |
| URL | domínio de produção | `staging.casinha.seahubcoworking.com.br` |
| Postgres | `DATABASE_URL` / `DIRECT_URL` do **banco principal** | URLs do **branch** dev no Supabase |
| Supabase Auth | `NEXT_PUBLIC_SUPABASE_URL` + anon key (projeto único) | **Igual** (auth é do projeto, não do branch) |
| Stripe | Live (`sk_live_`, prices live) | Test (`sk_test_`, prices test) |
| Resend | mesma conta | mesma conta |

> **Auth + branch:** o branch isola **dados Postgres** (Prisma). Usuários do Supabase Auth continuam no projeto inteiro — login em staging e prod usa o mesmo pool de contas; o que muda é em qual banco o app grava (`Workspace`, posts, etc.) conforme `DATABASE_URL` do deploy.

---

## 1. Vercel

### Projeto e Git

- [ ] **Settings → Git → Production Branch** = `production`.
- [ ] Fluxo: merge para `staging` → deploy Preview no domínio staging; merge `staging` → `production` → deploy Production.
- [ ] Confirmar que `staging.casinha.seahubcoworking.com.br` está ligado ao branch **`staging`** (não a previews aleatórios de outras branches).
- [ ] Opcional: desabilitar ou limitar deploy Preview de branches que não sejam `staging` (evita URLs órfãs com env errada).

### Variáveis de ambiente

Configurar na Vercel em **Production** vs **Preview** (valores diferentes onde indicado).

| Variável | Production | Preview (staging) |
|----------|------------|-------------------|
| `DATABASE_URL` / `DIRECT_URL` | Banco **principal** | Connection strings do **branch dev** |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Projeto Supabase | **Mesmos** (projeto único) |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | URL de produção | `https://staging.casinha.seahubcoworking.com.br` |
| `STRIPE_*` | Live + webhook prod | Test + webhook staging |
| `CRON_SECRET` | Segredo A | Segredo B (recomendado) |
| `RESEND_API_KEY` | Conta Resend | **Mesma** chave |
| `EMAIL_FROM` | Remetente prod | Opcional: mesmo remetente ou prefixo no assunto (operacional) |
| `ZERNIO_*`, LLM, `ADMIN_EMAILS` | Prod / real | Teste / equipe |

- [ ] Nunca usar `DATABASE_URL` de produção em **Preview**.
- [ ] **Sempre** setar `APP_URL` no Preview — fallback em `lib/email.ts` aponta para produção se vazio.

### Build e migrations

- [ ] Migrations via GitHub Actions (`ci.yml`, jobs deploy-*) ou `npm run db:deploy` — não no build da Vercel.
- [ ] Migrations aplicam no **principal** (Production) e no **branch dev** (Preview/staging) — manter os dois em dia ao mudar schema.
- [ ] Seed (`npm run db:seed`) só no branch dev / local, não no banco de produção sem processo explícito.

### Crons (`vercel.json`)

Rotas protegidas por `CRON_SECRET`: `crm-sync`, `health`, `purge-trash`, `reminders`.

- [ ] Crons da Vercel rodam no contexto **Production** do projeto (branch `production`).
- [ ] Staging **não** deve depender de crons agendados na Vercel (ou aceitar que Preview não replica o mesmo schedule).
- [ ] `CRON_SECRET` de Production ≠ Preview se alguém chamar cron manualmente no staging.

### Git (processo)

- [ ] Proteção de branch `production` (revisão antes de deploy).
- [ ] `main` (se existir): alinhar com o time se ainda recebe deploy ou só `production` / `staging`.

---

## 2. Supabase (projeto único + branch dev)

### Database branch

- [ ] Criar/manter **branch** de banco (dev) no projeto Supabase principal.
- [ ] Copiar do dashboard as URLs do branch → **Preview** na Vercel: `DATABASE_URL` (pooler 6543, `pgbouncer=true`) e `DIRECT_URL` (5432).
- [ ] **Production** na Vercel: `DATABASE_URL` / `DIRECT_URL` do banco **principal** (não do branch).

### Auth (compartilhado)

- [ ] **Site URL** no Supabase: pode ficar na URL de produção; o que importa para login são os **Redirect URLs**.
- [ ] **Redirect URLs** (ambos os hosts):
  - `https://casinha.seahubcoworking.com.br/auth/callback` (ajustar host real de prod)
  - `https://staging.casinha.seahubcoworking.com.br/auth/callback`
  - `http://localhost:3000/auth/callback` (dev local)
- [ ] Google OAuth: autorizar os dois redirects no Google Cloud Console.
- [ ] `NEXT_PUBLIC_SUPABASE_*`: **iguais** em Production e Preview.

### Schema e RLS

- [ ] Após nova migration: deploy **staging** (branch) e depois **production** (principal), ou `migrate deploy` em cada connection string.
- [ ] RLS nas migrations vale para qualquer instância onde a migration rodou (`docs/arquitetura.md`).

### Cuidados do branch

- [ ] Dados do branch **não** são backup de prod — não restaurar branch em prod sem processo.
- [ ] Copiar dados prod → branch dev só com **anonimização** (LGPD).
- [ ] Usuário que existe no Auth mas nunca fez provision no branch dev: primeiro login no staging recria workspace no **banco do branch** (`lib/provision.ts`).

---

## 3. Stripe

- [ ] **Preview (staging):** Test mode — `sk_test_…`, `STRIPE_PRICE_*` de teste, webhook `https://staging.casinha.seahubcoworking.com.br/api/stripe/webhook` → `STRIPE_WEBHOOK_SECRET` em Preview.
- [ ] **Production:** Live — `sk_live_…`, prices live, webhook na URL de produção → secret em Production.
- [ ] Checkout/portal usam `APP_URL` — conferir URLs por ambiente.
- [ ] IDs Stripe no Postgres do branch dev ≠ prod (isolados por banco).

---

## 4. Outras integrações

### Zernio

- [ ] Redirect OAuth: `${origin}/conectado` — aceitar domínio staging na Zernio.
- [ ] Opcional: API key / profile de teste só no Preview.

### Resend

- [ ] **Mesma** `RESEND_API_KEY` em Production e Preview.
- [ ] Links nos e-mails seguem `APP_URL` do deploy (staging vs prod).

### CRM / LLM / Cron

- [ ] Webhooks CRM: URL pública por host (`staging…` vs prod).
- [ ] LLM: opcional restringir fallback de agência no Preview.
- [ ] `CRON_SECRET` distinto se staging puder acionar rotas `/api/cron/*`.

---

## 5. Código e operação

- [ ] Não commitar `.env`; não colar secrets de Production em Preview.
- [ ] Após seed no branch dev: `npm run db:verify`.
- [ ] Promover código: `staging` → `production`; schema segue via migrate em cada banco.
- [ ] Opcional: banner “Staging” com `VERCEL_ENV === 'preview'`.

Um schema Prisma, **dois** Postgres (principal + branch) — um `vercel.json` por projeto.

### GitHub Actions

Workflows em `.github/workflows/` (mesmo espírito do **seajobs**: CI + migrate por branch).

| Workflow | Quando | O quê |
|----------|--------|--------|
| `ci.yml` | Push/PR em `staging` e `production` | Job **check**: lint, typegen, `tsc`, testes |
| `ci.yml` (mesmo run) | Após **check** verde: push com mudança em `prisma/**` ou **Run workflow** manual | Jobs **deploy-staging** / **deploy-production**: `npm run db:deploy` (Prisma no Postgres Supabase) |

**Secrets no repositório** (Settings → Secrets and variables → Actions):

| Secret | Valor |
|--------|--------|
| `DATABASE_URL_STAGING` | Pooler (6543) do branch dev — mesmo da Vercel Preview |
| `DIRECT_URL_STAGING` | Direct (5432) do branch dev |
| `DATABASE_URL_PRODUCTION` | Pooler do banco principal — mesmo da Vercel Production |
| `DIRECT_URL_PRODUCTION` | Direct do banco principal |

O workflow mapeia para `DATABASE_URL` / `DIRECT_URL` só no job (Prisma não precisa mudar).

Deploy manual: Actions → **CI** → **Run workflow** → escolher `staging` ou `production` (roda check + migrate).

**Migrations não rodam na Vercel** (`vercel-build` = `prisma generate` + `next build`). O migrate fica no job **deploy-*** do workflow **CI** (ou `npm run db:deploy` local).

Na Vercel, `DATABASE_URL` e `DIRECT_URL` ainda são obrigatórios em **runtime** (API/cron). Formato:

- Começar com `postgresql://` ou `postgres://` (sem aspas no dashboard).
- **Production:** pooler **6543** + `?pgbouncer=true` em `DATABASE_URL`; **Preview (staging):** URLs do **branch dev**, não do banco principal.

---

## 6. Ordem sugerida

1. Branch Supabase dev + connection strings na Vercel **Preview**.
2. Env Preview: `APP_URL` staging, `DATABASE_URL` do branch, Stripe test, demais vars.
3. Auth redirects + Google OAuth para `staging.casinha.seahubcoworking.com.br`.
4. Deploy branch `staging` → smoke test (login, provision, checkout test, webhook).
5. Env **Production**: banco principal, Stripe live, `APP_URL` prod, crons.
6. Deploy branch `production` → smoke test prod.
7. Cadastrar no GitHub os secrets `*_STAGING` e `*_PRODUCTION` (tabela acima).

---

## Matriz rápida (env × ambiente)

| Variável | Preview (`staging`) | Production (`production`) |
|----------|---------------------|---------------------------|
| `DATABASE_URL` / `DIRECT_URL` | Branch dev Supabase | Banco principal |
| `NEXT_PUBLIC_SUPABASE_*` | Projeto (igual) | Projeto (igual) |
| `APP_URL` | `https://staging.casinha.seahubcoworking.com.br` | URL de produção |
| `STRIPE_SECRET_KEY` | `sk_test_` | `sk_live_` |
| `STRIPE_WEBHOOK_SECRET` | Webhook staging | Webhook prod |
| `STRIPE_PRICE_*` | Test | Live |
| `RESEND_API_KEY` | Mesma conta | Mesma conta |
| `CRON_SECRET` | B (opcional) | A (crons Vercel) |
| `ZERNIO_*` | Teste (se houver) | Real |
