# Plano — Conexão TOTAL com a Zernio (captura de dados + dashboards)

## Objetivo
Registrar e puxar **todos os dados possíveis** da Zernio por workspace, de forma **rápida** (sem esperar a API a cada abertura de painel) e construir **dashboards de analytics** ricos.

## Diagnóstico do que falta hoje
- Analytics é buscado **ao vivo** a cada abertura de painel → lento (2–5s) e sem histórico.
- Só usamos `account-insights` (parte das métricas). Não usamos: **follower-history**, **demographics**, **per-post**, **page-insights (FB)**, **ads**, **inbox**.
- Sem **webhooks** (dado não atualiza sozinho; sem eventos de publish/sync).
- Connect não trata **fluxos multi-step** (Facebook select-page, Instagram facebook_login select-account).
- **Dependência de plano:** `account-insights`, ads e várias métricas exigem os **add-ons Analytics/Ads** da Zernio. No **free** vêm limitados. A arquitetura abaixo funciona já; o volume de dados enche com o **upgrade**.

## Arquitetura proposta
1. **Persistir no nosso banco (Supabase) um cache de analytics por workspace** — novas tabelas Prisma:
   - `SocialAccount` (espelha as contas conectadas: workspaceId, zernioAccountId, platform, handle, displayName, followersCount, meta Json, lastSyncAt).
   - `AnalyticsSnapshot` (workspaceId, accountId, platform, metric, date, value) — série temporal por métrica/dia.
   - `AnalyticsMeta` (últimos totais/valores por conta+métrica para KPIs rápidos).
   → Painéis leem do **nosso banco** (rápido), não da Zernio a cada vez.
2. **Sync sob demanda + TTL** — ao abrir um painel/entrar, se o cache está velho (> X h), dispara um sync em background que chama a Zernio e grava. Primeira carga usa o que tiver; atualiza quando chega.
3. **Puxar tudo o que o plano permite**, por plataforma: account-insights (todas as métricas), follower-history, demographics; FB page-insights; (ads e per-post nas fases seguintes).
4. **Webhooks** (`/api/webhooks/zernio`, HMAC `X-Zernio-Signature`): registrar via `/v1/webhooks/settings` → receber `account.ads.initial_sync_completed`, publish status, etc. → atualizar o banco/`Post.status` sem polling.
5. **Connect multi-step**: tratar select-page (FB) e select-account (IG facebook_login) — endpoints `/connect/{platform}/select-*` com o token do callback.
6. **Dashboards**: com os dados persistidos, montar visões ricas — evolução (linha), comparação de períodos, demografia (audiência), top posts, e um overview agregando redes.

## Faseamento
- **Fase 1 — Cache + velocidade (base de tudo):** tabelas `SocialAccount`/`AnalyticsSnapshot` + rota de sync (`/api/zernio/sync`) + painéis lendo do banco (rápido). Puxa account-insights + follower-history. *Resolve a lentidão e destrava dashboards.*
- **Fase 2 — Cobertura:** demographics, FB page-insights, per-post; e o **connect multi-step**.
- **Fase 3 — Webhooks:** atualização automática (publish/sync).
- **Fase 4 — Dashboards ricos:** telas de evolução/comparação/audiência/top posts, overview agregado.
- **Ads (paralelo):** quando o Ads add-on estiver ativo — Canais Pagos com dados reais.

## Decisões a confirmar
1. **Cache no banco** (Fase 1) é o caminho? (recomendo — resolve lentidão + histórico)
2. **Upgrade do plano Zernio** (Analytics/Ads add-ons) — confirmar que vem, pois é o que libera o volume de dados. Construímos a arquitetura já; enche com o upgrade.
3. **Ordem:** Fase 1 agora (cache + velocidade + dashboards base), depois 2–4?

## Relacionado (pendências já registradas)
- Metas como **widget** (objetivo central + KRs com progresso/mensal/evolução) — item próprio.
- Multi-workspace + seletor de ambiente + import por ambiente.
- Concorrente: foto+infos do IG via Apify.
