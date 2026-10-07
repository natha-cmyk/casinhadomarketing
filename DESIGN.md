---
version: alpha
name: Casinha do Marketing — Seahub
description: Design system iOS/Apple para o painel de marketing multi-tenant da Seahub.
colors:
  red: "#FF001E"
  cyan: "#00BBC5"
  ink: "#121111"
  bg: "#FFFFFF"
  surface: "#F5F5F7"
  surface-2: "#EDEDEC"
  label: "#1D1D1F"
  label-2: "#6E6E73"
  label-3: "#9A9AA0"
  excelente: "#2FB457"
  bom: "#00BBC5"
  atencao: "#FF9F0A"
  critico: "#FF001E"
  hairline: "rgba(0,0,0,.09)"
  hairline-2: "rgba(0,0,0,.14)"
  on-dark: "#FFFFFF"
  traffic-yellow: "#FEBC2E"
  traffic-green: "#28C840"
  cyan-text: "#0a8a91"
  green-text: "#0f7a37"
  red-text: "#c60018"
  amber-text: "#a6650a"
  purple-accent: "#8E5BE0"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif'
    fontSize: 14px
    lineHeight: 1.45
    fontWeight: 400
  page-title:
    fontSize: 26px
    fontWeight: 700
    letterSpacing: -0.5px
  card-title:
    fontSize: 14.5px
    fontWeight: 640
    letterSpacing: -0.1px
  kpi-value:
    fontSize: 25px
    fontWeight: 700
    letterSpacing: -0.6px
  eyebrow:
    fontSize: 12px
    fontWeight: 600
    letterSpacing: 0.04em
    textTransform: uppercase
  nav-group:
    fontSize: 11px
    fontWeight: 600
    letterSpacing: 0.04em
    textTransform: uppercase
rounded:
  lg: 14px
  md: 10px
  sm: 7px
  pill: 20px
  modal: 16px
  modal-wide: 20px
spacing:
  grid-gap: 16px
  content-x: 28px
  content-y: 26px
  sidebar-width: 248px
  view-max-width: 1080px
components:
  card:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
  card-pad-lg:
    padding: "22px 24px"
  btn-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.md}"
  btn-action:
    backgroundColor: "{colors.red}"
    textColor: "{colors.on-dark}"
  btn-link:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.label}"
    rounded: 9px
    padding: "8px 13px"
  focus-ring:
    backgroundColor: "rgba(0,187,197,.16)"
---

# DESIGN.md — Casinha do Marketing

Contrato visual para agentes e desenvolvedores. **Fonte normativa de valores:** YAML acima e `app/globals.css`. **Implementação:** `components/ui.tsx` + classes do shell. **Padrões de código:** `docs/padroes.md`.

Estética **iOS / Apple System**: superfícies claras, cards brancos, hairlines discretas, cantos arredondados (~14px), sombras suaves, muito respiro. Não é dark mode — o app inteiro roda em fundo claro (`--surface`).

## Overview

O layout autenticado segue um shell fixo de três zonas (`components/shell/Shell.tsx`):

```
┌─────────────┬──────────────────────────────────────┐
│  Sidebar    │  Toolbar (título + período + ações)  │
│  248px      ├──────────────────────────────────────┤
│             │  Content (.view, max 1080px)           │
│             │                                      │
└─────────────┴──────────────────────────────────────┘
                                    [AgentDock] ↗ canto
```

- **Sidebar** (`.sidebar`): navegação por grupos; item ativo com ícone vermelho.
- **Toolbar** (`.toolbar`): vidro fosco (`backdrop-filter` + branco 90%); título + controles de período.
- **Content** (`.content` → `.view`): área rolável; entrada com animação `rise` (280ms).
- **AgentDock** (`#agentDock`): bolha fixa canto inferior direito.

Páginas de auth (`AuthShell`) e legais usam layout centralizado fora do shell. Admin reutiliza classes `.sidebar` / `.nav-item` com marca ciano.

## Colors

### Marca e interação

| Token | Uso |
|---|---|
| `--red` | Ação, destaque, eyebrow de página, marca (gradiente do `.brand .mark`), fila de agendamentos |
| `--cyan` | Links, foco, toggles ativos, bordas de seleção, preset de cenário |
| `--ink` | Texto forte, botões escuros (envio do agente, modo organizar ativo, salvar) |

### Superfícies e texto

| Token | Uso |
|---|---|
| `--bg` | Fundo da área principal (branco) |
| `--surface` | Fundo do app, cards secundários, insights, mini-stats |
| `--surface-2` | Superfície suave alternativa |
| `--label` | Texto principal |
| `--label-2` | Texto secundário, labels de KPI |
| `--label-3` | Metadados, hints, nav de grupo |

### Status (métricas)

Mapeados em `lib/scope.ts` → `StatusTier` → `<Pill tier="…">`:

| Tier | Token | Classe `.pill` | Significado |
|---|---|---|---|
| Excelente | `--excelente` | `.pill.exc` | Meta superada |
| Bom | `--bom` | `.pill.bom` | Dentro do esperado |
| Atenção | `--atencao` | `.pill.ate` | Abaixo do ideal |
| Crítico | `--critico` | `.pill.cri` | Urgente |

Chips de variação (`<Chip>` / `<DeltaChip>`): `.chip.up` (verde), `.chip.down` (vermelho), `.chip.flat` (neutro), `.chip.scn` (cenário, ciano).

### Hairlines e divisores

- `--hairline` — bordas de card, separadores de lista, sidebar.
- `--hairline-2` — bordas de input, botões outline, tabelas.

### Gradientes reservados

- **Marca:** `linear-gradient(150deg, var(--red), #c60018)` — logo sidebar.
- **Instagram:** `linear-gradient(120deg, #FF001E, #C13584 60%, #833AB4)` — `.btn-link.ig`, `.icon-btn.ig`.
- **Admin:** ciano `#00BBC5` → `#0a8a91` — marca do painel admin.

## Typography

- **Família:** pilha system Apple (`--font` em `globals.css`). Não usar Montserrat nem outra fonte customizada.
- **Base:** 14px, line-height 1.45, antialiased.
- **Números:** sempre com classe `.tnum` (tabular-nums) em KPIs, tabelas, barras e gráficos.
- **Hierarquia implementada:**

| Elemento | Classe / local | Tamanho | Peso |
|---|---|---|---|
| Título de página | `.page-head h2` | 26px | 700 |
| Eyebrow | `.page-head .eyebrow` | 12px uppercase | 600 |
| Título de card | `.card-head .t` | 14.5px | 640 |
| Valor KPI | `.kpi .val` | 25px | 700 |
| Toolbar | `.tb-title` | 15px | 640 |
| Nav item | `.nav-item` | 13.5px | 450–550 |
| Corpo insight | `.insight p` | 12.5px | 400 |

`PageHead` **não renderiza** `desc` sob o título (decisão de produto em `components/ui.tsx`).

## Layout

### Grid e espaçamento

- `.grid` — `display: grid; gap: 16px`.
- `.kpis` — 4 colunas; em ≤900px → 2; em ≤480px → 1.
- `.two-col` — 1fr 1fr; colapsa em 1 coluna no mobile.
- `.view` — `max-width: 1080px; margin: 0 auto`.
- `.content` — padding `26px 28px 60px` (reduz no mobile).

### Shell responsivo (≤900px)

- Sidebar off-canvas (`transform: translateX(-100%)`); `.menu-btn` + `.backdrop`.
- Toolbar esconde `.updated` e subtítulo.

### Widgets sociais

- `.si-flow` / `.si-flow-sm` — `repeat(auto-fit, minmax(320px|300px, 1fr))`.
- `.wb-grid` — 6 colunas editáveis; 2 em tablet; 1 em mobile (`WidgetBoard`).

## Elevation & Depth

| Token / classe | Uso |
|---|---|
| `--shadow-card` | Cards, mini-stats, tiles de conexão |
| `--shadow-pop` | Modais, auth card, sidebar mobile |
| `.toolbar` | Vidro: `backdrop-filter: saturate(180%) blur(18px)` |
| `.pm-back` | Overlay modal: `rgba(0,0,0,.34)` |
| `.ag-panel` | Sombra forte do dock de agentes |

Profundidade vem de **borda hairline + sombra leve**, não de elevação Material pesada.

## Shapes

| Token | px | Uso típico |
|---|---|---|
| `--r-lg` | 14 | Cards, modais, tiles |
| `--r-md` | 10 | Insights, drop zones, icon-btn |
| `--r-sm` | 7 | Nav items, chips internos |
| pill / badge | 20px radius | Chips, pills de status, tags LIVE |

Botões circulares: FAB do agente (52px), avatares (32px), dots de persona.

## Components

### Primitivos React (`components/ui.tsx`)

Reutilize estes antes de inventar markup novo:

| Componente | Classes CSS | Quando usar |
|---|---|---|
| `Card` | `.card`, `.pad-lg` | Bloco de conteúdo padrão |
| `CardHead` | `.card-head` | Título + badge + ação à direita |
| `KpiCard` | `.card.kpi` | Métrica grande + comparação |
| `PageHead` | `.page-head` | Topo de seção (eyebrow + h2) |
| `Segmented` | `.seg`, `.seg.small` | Switcher semana/mês/trimestre, toggles |
| `Chip` / `DeltaChip` | `.chip.*` | Variação % ou cenário |
| `Pill` | `.pill.*` | Status excelente/bom/atenção/crítico |
| `BarRow` | `.bar-row` | Barras horizontais com label + valor |
| `MiniStat` | `.mini .m` | Grid de mini métricas |
| `Insight` | `.insight` | Callout com ícone colorido |
| `IconBtn` | `.icon-btn` | Ações na toolbar (tooltip `data-tip`) |
| `Switch` | `.switch` | Toggle iOS (verde quando `.on`) |
| `Badge` | `.badge` | Tag ciano em card-head |

Botões de texto: `.btn-link` (outline neutro). Estado ativo escuro: `.btn-link.on` (fundo `--ink`).

### Shell

| Peça | Arquivo | Padrão |
|---|---|---|
| Sidebar | `components/shell/Sidebar.tsx` | `NAV` de `lib/nav.ts`; redes condicionais por `redes` ativas |
| Toolbar | `components/shell/Toolbar.tsx` | Título + `Segmented` período + seletores ano/mês |
| AgentDock | `components/shell/AgentDock.tsx` | FAB + painel `.ag-panel`; 4 agentes com cor própria |
| Spinner | `components/Spinner.tsx` | `.spin-wrap` enquanto `hydrated === false` |

### Gráficos

- SVG gerado em `lib/charts.ts`, renderizado por `<Chart svg={…} />`.
- Tooltip global: `components/ChartTooltips.tsx` (`.chart-tip` escuro fixo).
- Legenda: `.legend` com quadrados coloridos ou traço tracejado.

### Tabelas

- `.tbl-scroll` + `table.data` — cabeçalho sticky, números à direita, primeira coluna à esquerda.
- `.cell-edit` — célula editável inline (hover surface, focus ciano).
- `.stick` — coluna fixa à esquerda em tabelas largas (ADS, metas).

### Formulários

- `.field-lbl` + `.field-edit` — input padrão.
- Focus: `border-color: var(--cyan)` + `box-shadow: 0 0 0 3px rgba(0,187,197,.16)`.
- Chips editáveis: `.chips-edit`, `.chip-rm`, `.chip-input`.
- Toggle de configuração: `.toggle-row` + `<Switch>`.

### Calendário de conteúdo

- Grid mensal: `.cc-grid`, `.cc-cell`, `.post-chip` com borda esquerda por status:
  - `.st-publicado` verde · `.st-agendado` ciano · `.st-rascunho` tracejado · `.st-falhou` âmbar · `.st-cancelado` vermelho
- Modal de post: `.pm-back` → `.pm` (até 760–940px); variante `.pm-wide` com preview lateral ≥820px.
- Fila de agendamentos: `.fila-card` com topo vermelho (`border-top: 3px solid var(--red)`).
- Barra de contas: `.conta-bar.conta-dark` (fundo `#121111`).

### Personalização

- Seções colapsáveis: `.psec` com `border-left: 3px solid var(--psec-accent)`.
- Acordeões de indicadores: `.acc` / `.acc-h` / `.acc-body`.
- Importação: `.drop` (dashed), `.file-chip`, `.fonte-map`.
- Conexões: `.conx-grid2` + `.conx-sq` (cards quadrados por rede).

### Persona & Concorrência

- Persona carrossel: `.ptinder` (foto + corpo); dots `.pt-dot.on` expandem.
- Cards concorrente: `.comp-grid` → `.comp-card`; logo `.comp-logo` com Clearbit ou inicial.

### Agentes (dock)

- FAB: `.ag-fab` cor do agente (`--agc`).
- Bolhas: `.ag-bubble` (bot cinza surface; usuário `--ink` branco).
- Sugestões: `.ag-chip`.
- Markdown no bot: `.ag-md` com headings `h4–h6`.

### Auth e páginas legais

- `AuthShell`: `.auth-wrap` → `.auth-card` centralizado; marca gradiente vermelho→ciano.
- Erro: `.auth-err` (vermelho suave). Sucesso: `.auth-ok` (verde suave).
- Legal: `.legal-wrap` → `.legal-card` (max 760px).

### Estados vazios e loading

- `.empty` — ícone + h3 + p; centralizado.
- `.spin` — borda vermelha no topo (loader da marca).
- `.soon` — badge âmbar “em construção” (`ScaffoldHero`).

## Motion

- Entrada de view: `@keyframes rise` 280ms ease.
- Transições de hover/focus: ~120–150ms.
- `prefers-reduced-motion: reduce` desliga animações e transições globalmente.
- `:focus-visible` — outline 2px `--cyan`, offset 2px.

## Do's and Don'ts

### Do

- Usar classes de `app/globals.css` e primitivos de `components/ui.tsx`.
- Aplicar `.tnum` em todo número de métrica, tabela ou gráfico.
- Manter cards brancos com hairline + `--shadow-card` sobre fundo `--surface`.
- Usar `--cyan` para foco, links e estado selecionado; `--red` para destaque de marca e alertas.
- Compor páginas com `.grid` + `Card` + `CardHead`; título com `PageHead`.
- Respeitar `max-width: 1080px` na área de conteúdo.
- Copy em **PT-BR**; na UI, dizer **"LLM"** (nunca "motor de IA").
- Ícones de rede: SVG inline via `<Ic name="…" />` (`components/Ic.tsx` + `lib/nav.ts`).

### Don't

- Não introduzir Tailwind utility classes como sistema primário — o design vive no CSS global + classes semânticas.
- Não usar Montserrat, Inter como fonte principal, ou paleta genérica de dashboard (slate/gray Tailwind).
- Não criar cards com `shadow-xl` pesado, bordas grossas ou cantos 4px estilo Material.
- Não expor nomes de fornecedores na UI (erros neutros, como em `lib/zernio.ts`).
- Não renderizar subtítulo em `PageHead` — a prop `desc` existe só por compatibilidade.
- Não usar biblioteca de charts externa — seguir `lib/charts.ts` + `<Chart />`.
- Não inventar novos tiers de status fora de `exc | bom | ate | cri`.

## Referência rápida de arquivos

| O quê | Onde |
|---|---|
| Tokens + todas as classes | `app/globals.css` |
| Componentes React base | `components/ui.tsx` |
| Shell do painel | `components/shell/` |
| Gráficos SVG | `lib/charts.ts`, `components/Chart.tsx` |
| Classificadores de status | `lib/scope.ts` (`StatusTier`, `Pill`) |
| Cores dos agentes | `lib/agents-meta.ts` (`cor` por agente) |
| Auth layout | `components/AuthShell.tsx` |
