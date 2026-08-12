# Plano — Ambientes vazios + configuração de indicadores por workspace

## Objetivo
Cada ambiente (workspace) nasce **vazio**. Os dados reais vêm de **contas conectadas via Zernio**, por **indicador que o usuário escolhe**. A **Personalização** vira o centro de configuração. Experiência de insights rica e por cliente.

## Princípio
- **Sem conexão / sem config → estado vazio** com CTA ("conecte via Personalização").
- Nada de números fixos da Seahub em nenhum painel.
- O que é **real (Zernio)** vs **manual (CRUD/import)** vs **fase futura** está explícito abaixo.

## Fontes de dado por painel

| Painel | Fonte | Como fica |
|---|---|---|
| **Instagram** | Zernio `analytics/instagram/account-insights` | ✅ feito (real ou vazio) |
| **Redes sociais** (TikTok/LinkedIn/YouTube/Facebook…) | Zernio `analytics/{platform}/account-insights` | mesmo padrão do Instagram (SocialView genérico) |
| **Painel (overview)** | agrega as contas conectadas (seguidores totais, alcance, views…) | KPIs reais + gráficos por conta; vazio se nada conectado |
| **Canais Pagos** | Zernio ads (Meta/Google) — connect ads + analytics | **Fase B** (ads analytics tem contrato próprio) |
| **Geração por Canais** | leads — não é métrica social | **manual / import CSV** (ou vazio) |
| **Persona & Público** | CRM/estudo — não vem do Zernio | **CRUD por workspace** (começa vazio; usuário cadastra) |
| **Concorrência** | manual | **CRUD por workspace** (começa vazio) |

## Catálogo de indicadores (social · Zernio)
Por conta conectada, expor os que a plataforma/plano permite (o resto vem `unavailableMetrics`):
- **Instagram:** seguidores, alcance, impressões, visualizações, contas engajadas, interações, curtidas, comentários, salvos, visitas ao perfil; + histórico de seguidores; + demografia.
- **Facebook:** fãs/seguidores, alcance, impressões, engajamento; page-insights; earnings.
- **TikTok:** seguidores, curtidas, nº de vídeos, ganho/perda de seguidores (API pública limita a isso).
- **YouTube:** inscritos, views, tempo de exibição.
- **LinkedIn:** seguidores, impressões, cliques, engajamento (por organização).

## Personalização → "Indicadores"
- Reaproveita a infra existente (`EnvConfig.paineis` = `{painel:{indId:bool}}`).
- Para cada **conta conectada**, lista os indicadores do catálogo com toggle "mostrar no painel".
- Os painéis renderizam só os indicadores ligados **e disponíveis** (conta tem + plano permite).

## Estados vazios (por painel, sem conexão/config)
- Ícone + título + CTA "Conecte [rede] / configure em Personalização".
- Consistente com o que o Instagram já faz.

## O que sai (remoção do seed nos painéis)
- `lib/seed-data.ts` deixa de alimentar Painel/Geração/Ads/Persona/Concorrência/SocialView.
- Mantém-se só como referência/histórico (não renderiza).

## Faseamento
- **Fase A (núcleo real):** Painel (agregado) + redes sociais (Instagram ✅ + Facebook/TikTok/YouTube/LinkedIn no mesmo padrão) puxando Zernio; estados vazios; Personalização → Indicadores por conta. Persona/Concorrência viram CRUD vazio por workspace.
- **Fase B:** Canais Pagos com ads analytics (Meta/Google) do Zernio.
- **Fase C:** Geração (leads manual/import) + polimento.

## Decisões a confirmar
1. **Persona/Concorrência:** viram **CRUD manual por workspace** (começa vazio)? (hoje são seed estático + edição in-memory)
2. **Geração/Canais Pagos:** por ora **vazio + "em breve/importe"**, ou já quer entrada manual?
3. **Fase A agora** (Painel + redes sociais reais + Personalização Indicadores) e B/C depois?
