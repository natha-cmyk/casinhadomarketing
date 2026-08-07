# Casinha do Marketing — Seahub

Painel/SO de marketing da **Seahub Coworking** (Natal/RN): redes sociais, mídia paga, geração de leads, OKR, calendário de conteúdo, personas e concorrência. Porte do blueprint `casinha-do-marketing.html` para app real (Next.js + Postgres).

## Stack
- **Next.js 16** (App Router) + TypeScript + **Tailwind v4**
- **Zustand** (estado de UI) · **Prisma 6** + **PostgreSQL**
- Gráficos SVG próprios (portados do blueprint) · Montserrat via `next/font`

> **Prisma fixado no v6** de propósito: o v7 removeu `url` do datasource. Não subir sem migrar o schema.

## Rodar local
```bash
npm install
npx prisma generate
npm run dev          # http://localhost:3000
```
Sem banco configurado, a app roda 100% com o **seed em memória** (`lib/seed-data.ts`) — nada persiste entre reloads. Persistência liga quando o Postgres estiver conectado (abaixo).

## Variáveis de ambiente (`.env`)
Copie de `.env.example`:
```
DATABASE_URL=   # Postgres (Supabase: pooler 6543 + ?pgbouncer=true)
DIRECT_URL=     # conexão direta (Supabase: 5432) — usada por prisma migrate
ZERNIO_API_KEY= # integrações futuras (ver INTEGRACOES.md)
ZERNIO_PROFILE_ID=
OPENCLAW_URL=
OPENCLAW_TOKEN=
```

## Banco de dados (Supabase ou Postgres)
1. **Supabase** → crie um projeto → *Project Settings → Database → Connection string*:
   - `DATABASE_URL` = **Transaction pooler** (host `...pooler...`, porta `6543`) + `?pgbouncer=true`
   - `DIRECT_URL` = **conexão direta** (porta `5432`)
   - (Postgres simples/local/EasyPanel: aponte os dois para a mesma URL.)
2. Primeira vez (cria a migration e aplica):
   ```bash
   npx prisma migrate dev --name init
   npm run db:seed          # popula dados reais (OKR, personas, 24 concorrentes, posts)
   ```
3. Confira: `npm run db:studio` (ou `npm run db:verify` valida os números offline).

O que persiste (o resto é seed read-only): **EnvConfig** (redes/indicadores/contas), **Perfil/Ambiente + matriz**, **Posts** do calendário, **OKR** (editor). Auto-save debounced; recarregar mantém as edições.

## Scripts
| Script | Faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate deploy` (produção; migrations já criadas) |
| `npm run db:seed` | popula tabelas editáveis |
| `npm run db:verify` | valida números do seed sem banco |
| `npm run db:studio` | Prisma Studio |

## Deploy no EasyPanel
- **Serviço Postgres** (ou use o Supabase direto) → pegue a URL interna.
- **Serviço App** (Next.js, build Nixpacks) apontando pro repositório. Env: `DATABASE_URL`, `DIRECT_URL` (+ `ZERNIO_*`/`OPENCLAW_*` vazios).
- Comando de deploy/start roda migrations + seed:
  ```bash
  npx prisma migrate deploy && npx prisma db seed && npm run start
  ```

## Integrações (stub por ora)
Zernio (contas/publish/analytics/ads) e OpenClaw (agentes/interpretação de arquivos) estão marcados `// TODO(zernio)` / `// TODO(openclaw)` e respondem mock. Mapa de ligação em [`INTEGRACOES.md`](INTEGRACOES.md).

## Estrutura
```
app/            rotas (painel, instagram, geracao, ads, metas, calendario,
                persona, concorrencia, personalizacao, canal/[rede]) + api/*
components/     shell (Sidebar/Toolbar/AgentDock), ui, views/*, Chart, Hydrator
lib/            store (Zustand), seed-data, scope, format, charts, nav, api, prisma
prisma/         schema.prisma + seed.ts
```
Fonte de verdade visual/lógica: `casinha-do-marketing.html`. Especificação: `PRD.md`.
