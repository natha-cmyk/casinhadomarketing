# Issue tracker local (`.scratch/`)

Specs e tickets em markdown. Convenção completa: [`docs/agents/issue-tracker.md`](../docs/agents/issue-tracker.md).

## Estrutura

```
.scratch/
  minha-feature/
    spec.md                 ← especificação da feature
    issues/
      01-primeiro-passo.md   ← um ticket por arquivo, numerados a partir de 01
      02-segundo-passo.md
```

## Exemplo de ticket

```markdown
Category: enhancement
Status: ready-for-agent

## Descrição

Adicionar filtro de período (semana/mês/trimestre/ano) no dashboard overview.

## Critérios

- Usar `lib/scope.ts` e o store Zustand existente
- Respeitar tenancy (`workspaceId`)

## Comments

```

## Triage (categoria + estado)

Ver [`docs/agents/triage-labels.md`](../docs/agents/triage-labels.md):

- **Category:** `bug` · `enhancement`
- **Status:** `needs-triage` · `needs-info` · `ready-for-agent` · `ready-for-human` · `wontfix`

## Fluxo sugerido (skills Matt Pocock)

1. `/to-spec` — conversa → `spec.md`
2. `/to-tickets` — spec → `issues/01-*.md` …
3. `/implement` — implementa tickets `ready-for-agent`
4. `/code-review` — revisa diff vs spec

Para features grandes: `/wayfinder` cria `map.md` + tickets de decisão.
