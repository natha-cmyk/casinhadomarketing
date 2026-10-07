# Casinha do Marketing — Seahub

Painel de marketing **multi-tenant** (workspace): redes sociais, mídia paga, geração de leads, OKR, calendário, personas, concorrência, billing e agentes LLM.

## Stack

- **Next.js 16** (App Router) + TypeScript + **Tailwind v4**
- **Prisma 6** + **PostgreSQL** (Supabase: pooler + direct URL)
- **Supabase Auth** · **Stripe** (assinatura) · **Zustand** (UI)
- Gráficos SVG em `components/Chart.tsx` · ícones `lucide-react`

> Prisma fixado no v6: o v7 removeu `url` do datasource. Não subir sem ADR de migração.

## Rodar local

```bash
npm install
npx prisma generate
npm run dev          # http://localhost:3000
```

Node **22.x** (`package.json` → `engines`).

## Variáveis de ambiente

Copie `.env.example` para `.env`. Mínimo para desenvolvimento:

- `DATABASE_URL` / `DIRECT_URL` — Postgres (pooler 6543 + direct 5432 no Supabase)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — auth

Integrações e produção: ver comentários em `.env.example` e `grep process.env` no código.

## Banco

```bash
npx prisma migrate dev    # primeira vez local
npm run db:seed
npm run db:verify         # valida números do seed (offline)
npm run db:studio
```

Deploy: `npm run vercel-build` ou `npm run db:migrate && npm run db:seed && npm run start`.

## Estrutura

```
app/(app)/          painel do cliente
app/admin/          operação interna
app/login|cadastro|onboarding|auth
app/api/            persistência, zernio, stripe, crm, agents, cron
components/shell    Sidebar, Toolbar, AgentDock
components/views    uma view por seção
lib/                auth, prisma, store, zernio, llm, stripe, scope, seed-data
prisma/             schema + migrations + seed
docs/historico/     documentação antiga (não seguir)
```

## Documentação para agentes

Contrato canônico: [`AGENTS.md`](AGENTS.md). **Vibecoder (não-programador):** [`GUIA-VIBECODER.md`](GUIA-VIBECODER.md). Design: [`DESIGN.md`](DESIGN.md). Arquitetura: [`docs/arquitetura.md`](docs/arquitetura.md). Padrões: [`docs/padroes.md`](docs/padroes.md). Skills: [`.agents/skills/README.md`](.agents/skills/README.md). `docs/historico/` é **arquivo** — não usar como spec.

## Scripts

| Script | Faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | popula tabelas |
| `npm run db:verify` | valida seed |
| `vercel-build` | migrate + build (Vercel) |
