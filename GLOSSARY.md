# Glossário — Casinha do Marketing

Termos usados no código. Skill de referência: **`.agents/skills/domain-modeling`** (formato ADR/glossário).

| Termo | Significado | Onde no código |
|---|---|---|
| **Workspace** | Tenant — um cliente/ambiente isolado. Tudo que é “dado do cliente” tem `workspaceId`. | `prisma/schema.prisma` → `Workspace` |
| **User** | Usuário logado; `id` = UUID do Supabase `auth.users`. | `lib/auth.ts` |
| **Membership** | Vínculo User ↔ Workspace (`owner` \| `member`). | `provision.ts`, `Invite` |
| **Perfil** | Dados de marca do workspace (empresa, cidade, canais, produtos). **Não** é profile da Zernio. | `model Perfil` |
| **Profile (Zernio)** | Agrupador de contas conectadas na integração. 1 conta por rede por profile. | `Workspace.zernioProfileId`, `WorkspaceProfile` |
| **WorkspaceProfile** | Profile Zernio extra no mesmo workspace (multi-conta da mesma rede). | `lib/profiles.ts` |
| **EnvConfig** | Toggles de redes, indicadores, contas, layout de widgets, config de agentes. | `app/api/config` |
| **Seed / seed-data** | Datasets read-mostly de referência Seahub (`lib/seed-data.ts`). **Não** é o estado inicial automático de todo workspace novo. | `lib/seed-data.ts`, `prisma/seed.ts` |
| **LLM** | Camada de agentes conversacionais (BYO por workspace). Dizer **"LLM"** na UI. | `lib/llm.ts`, `LlmConfig` |
| **Agente** | Um dos quatro assistentes (Poseidon, Apollo, Athena, Dionísio). | `lib/agents-meta.ts` |
| **View** (UI) | Id de seção do painel (`overview`, `instagram`, `ads`, …) mapeado à rota em `lib/nav.ts`. | `viewForPath`, `pathForView` |
| **Escopo / período** | Filtro temporal semana \| mês \| trimestre \| ano. | `lib/scope.ts` |
| **Admin** | Superadmin da plataforma (allowlist `ADMIN_EMAILS`), não confundir com `owner` do workspace. | `lib/admin.ts`, `app/admin/` |
