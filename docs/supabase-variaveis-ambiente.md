# Onde pegar cada variável (Supabase + Vercel + GitHub)

Projeto: **`xedauupeuxxegunwtxem`**. Auth é **único**; Postgres **staging** = database branch **dev**; **produção** = banco **primary**.

Use o painel **Connect** (ícone de plug) e, para staging, selecione o **branch** antes de copiar as URIs.

---

## 1. Supabase → Auth (mesmo valor em staging e produção)

| Variável | Vercel Production | Vercel Preview | GitHub |
|----------|-------------------|----------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Config | Config | — (não precisa) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config | Config | — |

**Onde:** Dashboard → **Project Settings** → **API** (ou MCP / tool `get_project_url` + `get_publishable_keys`).

| Campo Supabase | Variável |
|----------------|----------|
| Project URL `https://xedauupeuxxegunwtxem.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon** / **publishable** key (`eyJ…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Tipo na Vercel: **Config** (não Secret).

---

## 2. Postgres — STAGING (branch dev)

No dashboard: **Branches** → branch de dev (ex. `dev`) → **Connect**.

### `DATABASE_URL` (app / pooler Transaction)

| Destino | Nome |
|---------|------|
| Vercel **Preview** | `DATABASE_URL` |
| GitHub Actions | `DATABASE_URL_STAGING` |

**Copiar:** Connect → **ORMs** → **Prisma** → bloco **Transaction pooler** (ou “Connection pooling” mode **Transaction**).

| Deve ter | Não pode |
|----------|----------|
| Porta **6543** | Porta **6542** (typo) |
| `?pgbouncer=true` no final | Só `db.*.supabase.co:5432` sem pooler |

Formato típico (senha com `@` → `%40`):

```text
postgresql://postgres.[REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres?pgbouncer=true
```

Ou, se o painel do branch mostrar host `db.xedauupeuxxegunwtxem.supabase.co`:

```text
postgresql://postgres:[SENHA]@db.xedauupeuxxegunwtxem.supabase.co:6543/postgres?pgbouncer=true
```

### `DIRECT_URL` (migrate / Prisma `directUrl`)

| Destino | Nome |
|---------|------|
| Vercel **Preview** | `DIRECT_URL` |
| GitHub Actions | `DIRECT_URL_STAGING` |

**Copiar:** Connect → **Prisma** → **Session pooler** (porta **5432**, host `*.pooler.supabase.com`).

| Ambiente | Recomendação |
|----------|----------------|
| **GitHub Actions** | **Obrigatório** Session pooler — `db.*.supabase.co:5432` costuma dar **P1001** |
| Vercel runtime | Pode usar o mesmo Session pooler que no GitHub |

Formato típico:

```text
postgresql://postgres.[REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:5432/postgres
```

**Não** use para `DIRECT_URL` no CI a aba “Direct connection” (`db.xedauupeuxxegunwtxem.supabase.co:5432`) se o migrate falhar no Actions.

---

## 3. Postgres — PRODUÇÃO (primary)

**Connect** no projeto **sem** selecionar branch (banco principal).

| Variável Vercel **Production** | Secret GitHub |
|-------------------------------|---------------|
| `DATABASE_URL` | `DATABASE_URL_PRODUCTION` |
| `DIRECT_URL` | `DIRECT_URL_PRODUCTION` |

Mesmas regras: **6543** + `pgbouncer=true` vs **Session 5432** pooler. Hosts/credenciais do **primary** ≠ branch dev.

---

## 4. URLs do app (não vêm do Supabase)

| Variável | Vercel Preview (branch `staging`) | Vercel Production (branch `main`) |
|----------|-----------------------------------|----------------------------------------|
| `APP_URL` | `https://staging.casinha.seahubcoworking.com.br` | URL pública de produção |
| `NEXT_PUBLIC_APP_URL` | igual `APP_URL` | igual `APP_URL` |

Secret no servidor; `NEXT_PUBLIC_*` = Config na Vercel.

---

## 5. Checklist por destino

### Vercel → Environment **Preview**

- [ ] `DATABASE_URL` — branch dev, **6543**, `pgbouncer=true`
- [ ] `DIRECT_URL` — branch dev, Session pooler **5432**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `APP_URL` / `NEXT_PUBLIC_APP_URL` — staging
- [ ] Stripe **test**, etc.

### Vercel → Environment **Production**

- [ ] `DATABASE_URL` / `DIRECT_URL` — **primary**
- [ ] `NEXT_PUBLIC_SUPABASE_*` — iguais ao Preview
- [ ] `APP_URL` — produção
- [ ] Stripe **live**, etc.

### GitHub → Repository secrets

- [ ] `DATABASE_URL_STAGING` = mesmo valor que `DATABASE_URL` da Preview
- [ ] `DIRECT_URL_STAGING` = mesmo que `DIRECT_URL` da Preview
- [ ] `DATABASE_URL_PRODUCTION` / `DIRECT_URL_PRODUCTION` = par da Production

---

## 6. Validar com MCP no Cursor

Se **Settings → Tools & MCP** mostra **supabase** conectado, neste chat peça:

1. *“Use o MCP Supabase: `list_branches` e diga qual é o branch de dev.”*
2. *“`get_project_url` e `get_publishable_keys` para as env `NEXT_PUBLIC_*`.”*
3. *“Quais tabelas existem no branch dev vs primary?”* (`list_tables` em cada contexto, se o cliente permitir trocar branch.)

O agente **só** enxerga o MCP se o servidor aparecer na sessão (às vezes é preciso **novo chat** após OAuth).

**Teste local (sem expor senha no chat):**

```bash
export DATABASE_URL='...' DIRECT_URL='...'
node scripts/assert-db-env.mjs && npm run db:deploy
```

---

## 7. Erros que você já viu

| Sintoma | Causa | Correção |
|---------|--------|----------|
| `…:6542` | Porta errada | **6543** no `DATABASE_URL` |
| P1001 em `db.*:5432` no Actions | Direct host no CI | `DIRECT_URL_*` = **Session pooler** |
| `protocol postgresql://` | Secret vazio ou sem protocolo | Colar URI completa do Connect |
