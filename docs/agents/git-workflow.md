# Git — branches, agentes e releases

Contrato para **humanos e agentes de IA** (implement, TDD, code-review). Ambientes: `docs/ambientes-staging-producao.md`.

## Branches

| Branch | Papel | Deploy Vercel | Quem mexe |
|--------|--------|---------------|-----------|
| **`main`** | **Produção** (após QA) | Production | Release aprovada; **não** é branch de feature |
| **`staging`** | Integração + **QA** | Preview (`staging.casinha…`) | Merge de features validadas localmente |
| **`feat/*`, `fix/*`, …** | Trabalho isolado | — (opcional preview por PR) | Desenvolvimento |

**CI (GitHub Actions):** push/PR em `staging` e `main` — ver `.github/workflows/ci.yml`. Migrate staging no push em `staging`; migrate produção no push em `main`.

## Fluxo para `feat/*` (sempre via staging)

Novos recursos e refactors relevantes **não** vão direto para `main`.

```text
1. git fetch origin
2. git checkout main && git pull origin main
3. git checkout -b feat/<slug>
4. desenvolver (+ skill implement / tdd nos seams)
5. npm run lint && npx tsc --noEmit && npm test && npm run build
6. git add … && git commit -m "…"
7. git fetch origin && git checkout staging && git pull origin staging
8. git merge feat/<slug>
9. git push origin staging          # Preview + CI migrate (se paths de DB)
10. QA em https://staging.casinha.seahubcoworking.com.br
11. (humano) após OK: merge staging → main + push main → produção
```

## Fluxo para `fix/*` (padrão: staging; hotfix: main)

Correções seguem o **mesmo caminho que `feat/*`** (merge em `staging` + QA) **por padrão**.

**Exceção — hotfix em produção:** quando o usuário pedir correção urgente em prod (ou “pode ir direto no main”), após o passo 6:

```text
7. git checkout main && git pull origin main
8. git merge fix/<slug>
9. git push origin main             # produção + migrate prod (se DB)
10. (recomendado) git checkout staging && git merge main && git push origin staging
    # mantém staging alinhada com prod
```

Use hotfix direto em `main` só para **`fix/*`** e com pedido explícito — não para `feat/*`.

### O que agentes **devem** fazer

- Partir de **`main` atualizado** ao criar branch de trabalho.
- Commits apenas na **branch de feature** (ou na `staging` **só** após merge explícito da feature, passo 8).
- **`feat/*`:** ao concluir → **merge em `staging` + `git push origin staging`**.
- **`fix/*`:** padrão igual a `feat/*`; se o usuário pedir **hotfix / direto em produção** → merge em **`main` + push `main`**, depois alinhar **`staging`** com `main` quando possível.
- Migrations: seguir `docs/migrations.md`; push em `staging` aplica migrate no banco **dev** (secrets `*_STAGING`).

### O que agentes **não** devem fazer

- **`git push origin main`** com **`feat/*`** (sempre passar por `staging`/QA antes).
- Merge de **`feat/*` direto em `main`**.
- **`fix/*` → `main`** sem pedido explícito do usuário (hotfix/urgente).
- Pular **`staging`** em features “para ir mais rápido”.

### Release para produção (humano / explícito)

Só depois do OK do QA:

```bash
git checkout main && git pull origin main
git merge staging
git push origin main
```

Agentes só executam este passo se o usuário pedir **release para produção** ou **merge para main**.

## Nomenclatura de branches

- `feat/<ticket-ou-slug>` — funcionalidade
- `fix/<ticket-ou-slug>` — correção (hotfix pode ir a `main` se necessário — ver acima)
- `chore/<slug>` — CI, docs, tooling (ainda assim integrar via `staging` se afeta o app deployado)

Use slug curto em kebab-case, alinhado à pasta em `.scratch/<feature>/` quando existir.

## Conflitos e staging suja

Antes do merge da feature (passo 8), `staging` deve estar atualizada (`git pull origin staging`). Se a feature depende de outra ainda não mergeada, alinhar com o time ou integrar a outra branch primeiro.

## Checklist rápido (agente)

- [ ] Branch criada a partir de `main` atualizado
- [ ] Definição de pronto (`AGENTS.md`) verde
- [ ] Commits na branch de feature (mensagem clara, PT ou EN consistente com o repo)
- [ ] `feat/*`: merge em `staging` + push `staging`
- [ ] `fix/*`: `staging` por padrão; ou `main` + push se hotfix pedido, depois alinhar `staging`
- [ ] **Não** push `feat/*` em `main`

## Referências

- Ambientes e URLs: `docs/ambientes-staging-producao.md`
- Migrations / CI: `docs/migrations.md`, `.github/workflows/ci.yml`
- Implementação: `.agents/skills/implement/SKILL.md`, `.agents/skills/tdd/SKILL.md`
