# CLAUDE.md — Casinha do Marketing (Seahub)

> Este arquivo orienta o Claude Code. Leia-o inteiro antes de começar.
> **Fonte de verdade visual e lógica:** `casinha-do-marketing.html` (o blueprint). Replique 1:1 a UI, o comportamento e os dados dele.
> **Especificação funcional:** `PRD.md`. **Plano de execução:** `PLANO-EXECUCAO.md`.

## O que estamos construindo
A **Casinha do Marketing** é o painel/SO de marketing da Seahub Coworking (Natal/RN). Hoje existe como um HTML único de ~1.900 linhas (vanilla JS) totalmente funcional. Sua missão é **portar esse blueprint para uma app real** (Next.js + Postgres) e **hospedar no EasyPanel**, mantendo o visual e a lógica idênticos, trocando o estado in-memory por persistência em banco onde o PRD indicar.

## Stack (decidida — não trocar sem avisar)
- **Next.js 15 (App Router) + TypeScript**
- **Tailwind CSS** (design tokens da Seahub — ver abaixo)
- **Prisma + PostgreSQL** (o Postgres roda como serviço no EasyPanel)
- **Zustand** para estado de UI (espelha o objeto `state` do blueprint)
- **Recharts** para gráficos (o blueprint usa SVG custom simples; Recharts serve e acelera)
- **lucide-react** para ícones (o blueprint tem ícones inline; pode manter os inline onde forem específicos de marca de rede)

## Princípios de trabalho (importante)
1. **Portar, não reinventar.** Cada função `viewX()` do blueprint vira um componente/página React. O objeto `state` global vira uma store Zustand com os mesmos campos. O mapa `VIEWS` vira o roteamento.
2. **Dados de seed = o blueprint.** Todos os dados reais (leads mensais, OKR, personas, concorrentes, ADS, Instagram) já estão embutidos no HTML. **Extraia e porte verbatim** para um seed do Prisma. Não invente números.
3. **Fidelidade visual.** Estética iOS/Apple System: cards brancos, cantos arredondados (~14–16px), sombras suaves, hairlines, tipografia Montserrat, muito respiro. Compare com o blueprint.
4. **Edições cirúrgicas, PT-BR.** Toda a copy é em português do Brasil. Componha em componentes pequenos e reutilizáveis.
5. **Seams de integração ficam stub.** Zernio (contas, publish, analytics, ads) e OpenClaw (agentes, interpretação de arquivos) **não** são ligados agora — deixe as funções/endpoints marcados com `// TODO(zernio)` / `// TODO(openclaw)` retornando mock, exatamente como o blueprint faz ("Publicar agora" só muda status; agente responde stub).
6. **Deploy cedo.** Suba um "hello world" no EasyPanel na primeira hora e faça deploy contínuo.

## Design tokens (Seahub)
```
--red:      #FF001E   /* ação, destaque */
--cyan:     #00BBC5   /* interativo, links */
--ink:      #121111   /* texto forte, botões escuros */
--cream:    #EDEDEC   /* superfície suave */
--white:    #FFFFFF
/* status */ excelente:#2FB457  bom:#00BBC5  atencao:#FF9F0A  critico:#FF001E
Fonte: Montserrat (400/500/600/700/800). Números com tabular-nums.
```
Regra de marca: usar sempre **"LLM"** (nunca "motor de IA"). SeaHealth é produto **descontinuado** — só dado histórico, não citar em comunicação.

## Estrutura de pastas sugerida
```
/app
  /(painel)/page.tsx              → Painel (overview)
  /instagram/page.tsx
  /geracao/page.tsx               → Geração por Canais
  /ads/page.tsx                   → Canais Pagos
  /metas/page.tsx
  /calendario/page.tsx
  /canal/[rede]/page.tsx          → painéis de rede (tiktok, linkedin, x, ...)
  /persona/page.tsx
  /concorrencia/page.tsx
  /personalizacao/page.tsx
  /api/...                        → rotas de persistência (config, posts, okr, ...)
/components  (Sidebar, Toolbar, KpiCard, BarChart, PeriodSwitcher, AgentBubble, ...)
/lib        (store zustand, prisma client, seed data, helpers: fmt/money/pct/scopeVal)
/prisma     (schema.prisma, seed.ts)
```

## EasyPanel
- 1 serviço **App** (Next.js, build Nixpacks ou Dockerfile) + 1 serviço **Postgres**.
- `DATABASE_URL` vem do serviço Postgres do EasyPanel (rede interna).
- Variáveis futuras (deixar previstas, vazias por ora): `ZERNIO_API_KEY`, `OPENCLAW_URL`.
- `prisma migrate deploy` + `prisma db seed` no start/deploy.

## Ordem de execução
Siga `PLANO-EXECUCAO.md` (blocos de 1 dia). Regra de ouro: **deployável e navegável primeiro; persistência e polimento depois; integrações reais por último.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
