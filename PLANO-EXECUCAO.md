# Plano de execução — 1 dia (EasyPanel + Claude Code)

> Meta: sair do blueprint HTML e ter a Casinha **no ar no EasyPanel**, navegável, com visual fiel, seed real e persistência dos 4 núcleos (config, perfil, posts, OKR). Integrações reais (Zernio/OpenClaw) ficam como stub. Ordem = deployável primeiro, persistência depois, polimento por último.

**Como rodar com o Claude Code:** abra a pasta do projeto, coloque `CLAUDE.md`, `PRD.md`, este arquivo e `casinha-do-marketing.html` na raiz, e vá pedindo bloco a bloco (não peça "faz tudo" — peça um bloco, valide, siga). Faça commit ao fim de cada bloco.

---

## Pré-requisitos (antes de começar)
- Conta no EasyPanel com um servidor conectado.
- Node 20+, `npx`, git local.
- Prompt inicial pro Claude Code: *"Leia CLAUDE.md e PRD.md. Vamos executar o PLANO-EXECUCAO.md bloco a bloco. Comece pelo Bloco 0."*

---

## Bloco 0 — Esqueleto no ar (≈1h)
- [ ] `create-next-app` (App Router, TS, Tailwind, ESLint).
- [ ] Instalar: `prisma @prisma/client zustand recharts lucide-react`.
- [ ] `prisma init` (provider postgresql). Criar `schema.prisma` vazio com datasource.
- [ ] Página placeholder "Casinha no ar".
- [ ] **EasyPanel:** criar projeto → serviço **Postgres** (anotar host/porta/credenciais internas) → serviço **App** apontando pro repositório (build Nixpacks). Setar `DATABASE_URL` (rede interna do EasyPanel). Deploy.
- [ ] ✅ Checkpoint: URL do EasyPanel abre o placeholder.

## Bloco 1 — Design system + shell (≈1h30)
- [ ] Tokens da Seahub no `tailwind.config` + `globals.css` (cores, Montserrat via next/font, radius, sombras, `.tnum`).
- [ ] Componentes base: `Card`, `KpiCard`, `Badge`, `Chip`, `Pill(status)`, `Switch`, `Segmented`, `PageHead`, `Insight`.
- [ ] **Shell:** `Sidebar` (grupos/itens do PRD §4, itens de rede social condicionais), `Toolbar` (título + `PeriodSwitcher` semana/mês/trimestre/ano + ano/mês), layout com área de conteúdo.
- [ ] Roteamento das seções (páginas vazias por enquanto).
- [ ] Store Zustand espelhando `state` do blueprint (view via rota; period/year/month/quarter; filtros; flags de edição; postModal; agentOpen; etc.).
- [ ] Helpers em `lib/`: `fmt`, `money`, `pct`, `kfmt`, `scopeVal`, `scopeLabelText`, `deltaChip`. (Copiar do blueprint.)
- [ ] ✅ Checkpoint: navegação e visual do shell batem com o blueprint. Deploy.

## Bloco 2 — Seed real + Prisma (≈1h)
- [ ] `schema.prisma` com as entidades do PRD §6 (EnvConfig, Perfil, Post, Fonte, Objetivo/Area/KR, Persona, Concorrente). Read-mostly (Instagram/ADS/CANAIS/LEADS_M/MRR) pode ficar em `lib/seed-data.ts` (mais rápido) ou tabelas — escolher `lib/seed-data.ts` para o dia.
- [ ] Extrair **verbatim** do blueprint todos os datasets (LEADS_M, ADS, CANAIS, IG mensal, OKR2026, personas, COMP/concorrentes) para `lib/seed-data.ts` + `prisma/seed.ts`.
- [ ] `prisma migrate dev` + `prisma db seed`. Rodar seed no deploy do EasyPanel (`migrate deploy` + `db seed`).
- [ ] ✅ Checkpoint: banco populado com os números reais (1.904 leads 2026, OKR, personas, 24 concorrentes).

## Bloco 3 — Painéis de leitura (≈2h)  ← o grosso do porte
Portar as views que são majoritariamente leitura, já respeitando o **filtro de período** (`scopeVal`):
- [ ] **Painel** (§7.1): KPIs do escopo, gráficos por ano, mini-cards de rede, atalhos, insight; blocos ligáveis pela config.
- [ ] **Instagram** (§7.2) + **painéis de rede** (§7.7, componente genérico `SocialPanel` com placeholder p/ redes sem dado).
- [ ] **Geração** (§7.3): card geral + por produto.
- [ ] **Canais Pagos** (§7.4): KPIs + tabela canal×produto seguindo o período + gráfico.
- [ ] **Persona** (§7.8): KPIs + receita por produto + **carrossel Tinder** + insights.
- [ ] **Concorrência** (§7.9): grid filtrável + cards (logo Clearbit + fallback).
- [ ] ✅ Checkpoint: todas essas telas idênticas ao blueprint, com o switcher de período funcionando. Deploy.

## Bloco 4 — Persistência dos núcleos (≈2h)
Rotas `/api/*` (Route Handlers) + Prisma, ligando o que o usuário edita:
- [ ] **EnvConfig:** GET/PUT (redes on/off, indicadores por painel, contas conectadas). Ligar Personalização → Redes & canais + Indicadores dos painéis + as barras de conta do calendário.
- [ ] **Perfil/Ambiente:** GET/PUT (empresa/segmento/cidade/site, canais[], produtos[], relação matriz).
- [ ] **Posts:** CRUD (calendário: criar/editar/excluir, status, contas-alvo). Grid + modal + fila lendo do banco.
- [ ] **OKR:** CRUD de Objetivo/Area/KR (modo editor de Metas).
- [ ] ✅ Checkpoint: recarregar a página mantém tudo (não é mais in-memory). Deploy.

## Bloco 5 — Interações & seams (≈1h)
- [ ] **Config de indicadores** (acordeão recolhível, contadores, gating dos blocos).
- [ ] **Editor de Metas** (toggle, +KR/+área/remover).
- [ ] **Importe seus dados:** parser CSV real no cliente (detecta campos/tipos → seleciona → vira `Fonte`); XLSX/PDF marcam pendente. Kit Panteão = upload de nome (extração backend = TODO).
- [ ] **Bolha de agentes** (contextual por seção, sugestões, resposta stub). `// TODO(openclaw)`.
- [ ] **Publish/Contas:** "Conectar" e "Publicar agora" como stub. `// TODO(zernio)`.
- [ ] Concorrência: editar ícone (URL/emoji) persistido em `Concorrente.iconOverride`; "Puxar do IG" stub.
- [ ] ✅ Checkpoint: paridade funcional com o blueprint (com seams marcados). Deploy final do dia.

## Bloco 6 — QA & fechamento (≈30min)
- [ ] Passar por todas as telas: zero erro de console, visual fiel, período dirigindo dados, persistência ok.
- [ ] Conferir aceite do PRD §9.
- [ ] README curto: como rodar local, variáveis, como fazer deploy no EasyPanel.
- [ ] Marcar os TODOs de integração (Zernio/OpenClaw) num `INTEGRACOES.md` para a próxima etapa.

---

## Se o dia apertar (corte de escopo, nessa ordem de prioridade)
1. Mantém: Bloco 0–3 (no ar + visual + leitura) e persistência de **Posts** e **EnvConfig**.
2. Adia: persistência de OKR (deixa seed read-only 1 dia a mais) e o parser CSV.
3. Nunca adia: deploy no EasyPanel e o seed real (é o que dá "vida" ao painel).

## Próxima etapa (fora do dia 1) — Integrações
- **Zernio:** `/connect/{platform}` (OAuth hospedado) para Contas; `/posts` para publish/agendamento; `/analytics` para popular os painéis de rede e Canais Pagos com dado real; `/ads/boost`. Guardar `ZERNIO_API_KEY` no EasyPanel.
- **OpenClaw:** endpoint por agente (Poseidon/Apollo/Athena/Dionísio) + interpretação de arquivos (XLSX/PDF). Trocar os stubs da bolha e do import.
- **Auth:** gate simples (senha) ou NextAuth, se for expor além do time.
