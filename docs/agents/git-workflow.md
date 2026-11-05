# Git — branches, agentes e releases

Contrato para **humanos e agentes de IA** (implement, TDD, code-review). Ambientes: `docs/ambientes-staging-producao.md`.

## Branches

| Branch | Papel | Deploy Vercel | Quem mexe |
|--------|--------|---------------|-----------|
| **`main`** | **Produção** (após QA) | Production | Release da **branch aprovada** (`feat/*` / `fix/*`); **não** é branch de feature |
| **`staging`** | Integração + **QA** | Preview (`staging.casinha…`) | Merge de features para testar; **nunca** promove para `main` |
| **`feat/*`, `fix/*`, …** | Trabalho isolado | — (opcional preview por PR) | Desenvolvimento |

**CI (GitHub Actions):** push/PR em `staging` e `main` — ver `.github/workflows/ci.yml`. Migrate staging no push em `staging`; migrate produção no push em `main`.

**Regra de promoção:** `staging` acumula trabalho em validação. Produção recebe **somente** o merge da branch **`feat/<slug>`** ou **`fix/<slug>`** que passou no QA — **nunca** `git merge staging` em `main`.

## Fluxo para `feat/*` (QA em staging, release pela branch da feature)

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
10. QA em https://staging.casinha.seahubcoworking.com.br (valida essa feature em staging)
11. (humano) após OK: atualizar feat/<slug> com main se necessário, então merge feat/<slug> → main + push main → produção
    # proibido: merge staging → main
```

## Fluxo para `fix/*` (padrão: staging + QA; release pela branch; hotfix: main)

Correções seguem o **mesmo caminho que `feat/*`** (merge em `staging` + QA) **por padrão**. Após OK no QA, produção via **`git merge fix/<slug>`** em `main` — **não** via `staging`.

**Exceção — hotfix em produção:** quando o usuário pedir correção urgente em prod (ou “pode ir direto no main”), após o passo 6 **sem** passar pelo QA em staging:

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
- **`feat/*`:** ao concluir desenvolvimento → **merge em `staging` + `git push origin staging`** (QA).
- **`feat/*` / `fix/*` (após QA):** release em produção = **merge da branch `feat/<slug>` ou `fix/<slug>` em `main` + push `main`** quando o usuário pedir release — **nunca** merge de `staging` em `main`.
- **`fix/*`:** padrão igual a `feat/*` para QA; se o usuário pedir **hotfix / direto em produção** → merge em **`main` + push `main`**, depois alinhar **`staging`** com `main` quando possível.
- Migrations: seguir `docs/migrations.md`; push em `staging` aplica migrate no banco **dev** (secrets `*_STAGING`); push em `main` aplica migrate em produção.

### O que agentes **não** devem fazer

- **`git merge staging`** (ou equivalente) **em `main`** — **nunca**, em nenhum fluxo.
- **`git push origin main`** com **`feat/*`** sem QA em `staging` (exceto se o usuário pedir release explícita **da branch da feature** após QA).
- Merge de **`feat/*` direto em `main`** antes do QA em `staging`.
- **`fix/*` → `main`** sem pedido explícito do usuário quando for hotfix/urgente (fora do fluxo QA → merge da branch `fix/*`).
- Pular **`staging`** em features “para ir mais rápido”.

### Release para produção (humano / explícito)

Só depois do OK do QA na `staging` (ou hotfix conforme acima). Use a **branch da feature/fix aprovada**, não `staging`:

```bash
git fetch origin
git checkout main && git pull origin main
git checkout feat/<slug> && git pull origin feat/<slug>
# se main avançou desde o início da feature: git merge main  (na feat/<slug>), resolver conflitos, testar
git checkout main && git merge feat/<slug>
git push origin main
```

Substitua `feat/<slug>` por `fix/<slug>` quando for correção validada em staging.

Agentes só executam release em **`main`** se o usuário pedir **release para produção** ou **merge para main** — e **sempre** mergeando a branch de trabalho aprovada, **nunca** `staging`.

## Nomenclatura de branches

- `feat/<ticket-ou-slug>` — funcionalidade
- `fix/<ticket-ou-slug>` — correção (hotfix pode ir a `main` se necessário — ver acima)
- `chore/<slug>` — CI, docs, tooling (ainda assim integrar via `staging` se afeta o app deployado)

Use slug curto em kebab-case, alinhado à pasta em `.scratch/<feature>/` quando existir.

## Conflitos e staging suja

Antes do merge da feature em `staging` (passo 8), `staging` deve estar atualizada (`git pull origin staging`). Se a feature depende de outra ainda não mergeada, alinhar com o time ou integrar a outra branch primeiro.

`staging` pode conter **várias** features em paralelo; ao promover para produção, só entra em `main` o que está na branch **`feat/*` / `fix/*`** aprovada no QA — não o snapshot inteiro de `staging`.

## Checklist rápido (agente)

- [ ] Branch criada a partir de `main` atualizado
- [ ] Definição de pronto (`AGENTS.md`) verde
- [ ] Commits na branch de feature (mensagem clara, PT ou EN consistente com o repo)
- [ ] `feat/*`: merge em `staging` + push `staging` (QA)
- [ ] Release prod: merge **`feat/<slug>` ou `fix/<slug>`** em `main` — **não** merge `staging` → `main`
- [ ] `fix/*`: `staging` + QA por padrão; ou hotfix `fix/<slug>` → `main` se pedido, depois alinhar `staging`
- [ ] **Não** `git merge staging` em `main`

## Referências

- Ambientes e URLs: `docs/ambientes-staging-producao.md`
- Migrations / CI: `docs/migrations.md`, `.github/workflows/ci.yml`
- Implementação: `.agents/skills/implement/SKILL.md`, `.agents/skills/tdd/SKILL.md`
