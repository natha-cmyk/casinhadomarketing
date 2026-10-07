# Padrões de código (standards)

Fonte de verdade para o eixo **Standards** da skill `code-review` e para agentes de IA.

## Ordem de leitura

1. **`AGENTS.md`** — contrato do projeto (stack, tenancy, proibições, definição de pronto)
2. **`docs/padroes.md`** — padrões de página, view, API, Prisma, testes
3. **`.cursor/rules/`** — regras por glob (`00-projeto.mdc`, `api.mdc`, `prisma.mdc`, `views.mdc`)
4. **`DESIGN.md`** — UI Seahub (não substituir por auditorias genéricas de a11y)
5. **`GLOSSARY.md`** — vocabulário de domínio (usar os termos definidos)
6. **`docs/adr/`** — decisões arquiteturais; não contradizer sem explicitar

## O que o linter já cobre

`npm run lint` e `npx tsc --noEmit` — não repetir no review manual o que o tooling já garante.

## Testes

- Runner: **Vitest** (`npm test`)
- Preferir seams em `lib/` (funções puras, parsers, escopo) antes de E2E
- Testar comportamento pela interface pública, não detalhes de implementação
- Skill **`tdd`** para o loop red-green nos seams acordados

## Não usar como spec

`docs/historico/` — material arquivado apenas.
