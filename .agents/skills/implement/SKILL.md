---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Read **`docs/agents/git-workflow.md`** before starting. Default git flow:

1. `git fetch origin` → `git checkout main` → `git pull origin main`
2. `git checkout -b feat/<slug>` (or `fix/<slug>`) unless the user already put you on a branch
3. Implement on that branch only

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end (`AGENTS.md` → definição de pronto).

Once done, use /code-review to review the work.

Commit on the **feature branch** (never commit new feature work directly on `main`).

When shipping: **`feat/*`** → merge into **`staging`** + `git push origin staging` (QA). **`fix/*`** → same by default; if the user asks for a **hotfix** or direct prod fix → merge into **`main`** + `git push origin main`, then merge `main` into **`staging`** and push `staging` to realign. Never push **`feat/*`** straight to `main`. Production release of validated work: merge `staging` → `main` only when the user requests it after QA.
