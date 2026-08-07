# INTEGRAÇÕES — Zernio & OpenClaw (etapa pós dia-1)

> Todos os pontos abaixo estão **stubados** no blueprint/na app (marcados `// TODO(zernio)` / `// TODO(openclaw)`).
> Este doc mapeia **onde** cada seam vive, **o que faz hoje** e **como ligar** de verdade.
> Confirmar parâmetros exatos em **docs.zernio.com** (aqui está a forma do SDK, não o contrato final).

## Variáveis de ambiente (EasyPanel)
```
ZERNIO_API_KEY=        # chave da conta Zernio
ZERNIO_PROFILE_ID=     # "profile" da Zernio que agrupa as contas conectadas
OPENCLAW_URL=          # base URL do OpenClaw (agentes + interpretação)
OPENCLAW_TOKEN=        # auth do OpenClaw, se houver
```
SDK: `npm i @zernio/node`. Toda chamada Zernio roda **no servidor** (Route Handler `/api/...`), nunca no cliente (a chave é secreta).

---

## Zernio — o que é
API unificada de social/mensageria/ads: **15 canais + 7 ad networks**, OAuth **hospedado** (sem criar dev app de cada rede, sem app review), webhooks (sem polling) e **MCP** (280+ tools) que o OpenClaw consome. É o **backbone de dados e de publicação**.

### Endpoints usados
| Endpoint | Uso na Casinha |
|---|---|
| `GET/POST /connect/{platform}` | conectar contas (retorna `authUrl` p/ OAuth) |
| `POST /posts` | publicar/agendar (texto+mídia, N plataformas numa chamada) |
| `GET /analytics` | métricas unificadas (seguidores, alcance, impressões, cliques, views) |
| `POST /ads/boost` | impulsionar post em ad network |
| `POST /webhooks/settings` | receber "publicado/falhou" (atualiza `Post.status`) |
| `GET /inbox/conversations` | DMs/comentários (futuro — grupo Conversas) |

---

## Mapa por tela

### 1. Personalização → Redes & canais (toggles) + Calendário → Contas conectadas
**Hoje:** toggle liga/desliga em `EnvConfig.redes`/`contas` (só booleano).
**Ligar:** ao conectar uma rede, chamar Zernio `/connect` e guardar o `accountId` retornado.
```ts
// /api/contas/connect  (server)
const { authUrl } = await zernio.accounts.connect({ platform, profileId: env.ZERNIO_PROFILE_ID });
// redireciona o usuário p/ authUrl; no callback, salvar accountId em EnvConfig.contas[platform] = { on:true, accountId }
```
Trocar `EnvConfig.contas` de `{id:bool}` para `{id:{on,accountId}}` quando ligar (o schema usa Json, então é compatível).

### 2. Calendário → "Publicar agora" / status "Agendado"
**Hoje:** só muda `Post.status` (stub).
**Ligar:** ao salvar como Agendado (data futura) ou clicar Publicar agora, criar o post na Zernio nas `Post.contas`.
```ts
// /api/posts/publish
const res = await zernio.posts.create({
  content: post.legenda,
  mediaItems: post.arquivo ? [{ type: inferType(post.arquivo), url: mediaUrl }] : [],
  platforms: post.contas.map(id => ({ platform: id, accountId: contas[id].accountId })),
  // scheduledFor: post.data+post.hora  → quando for agendado
});
// guardar res.id em Post.zernioPostId; status = 'agendado'|'publicado'
```
**Webhook** `/api/webhooks/zernio` → em "published" seta `Post.status='publicado'`; em "failed" seta `'falhou'` + `errorMsg`. (Sem polling.)

### 3. Painéis de rede (Instagram, TikTok, LinkedIn, YouTube, …) + mini-cards do Painel
**Hoje:** dados de exemplo (SOC) / placeholder "conecte via Zernio".
**Ligar:** puxar métricas reais por conta conectada e substituir o seed.
```ts
// /api/analytics?platform=instagram&range=...
const data = await zernio.analytics.get({ accountId, metrics:['followers','reach','impressions','views','engagement'], from, to });
```
Cachear por período (respeitar o filtro semana/mês/trimestre/ano da toolbar). Popular `SocialPanel` e os mini-cards do Painel.

### 4. Canais Pagos (mídia paga)
**Hoje:** ADS de seed (Google/Meta/Parceria).
**Ligar:** métricas de ad networks via `/analytics` (Meta/Google/etc.) e **impulsionar** via `/ads/boost`.
```ts
await zernio.ads.boost({ postId: post.zernioPostId, network:'meta', budget, days });
```
Manter a tabela canal×produto; a fonte vira Zernio em vez do seed.

### 5. Concorrência → "Puxar do IG"
**Hoje:** aplica avatar com gradiente (stub) em `Concorrente.iconOverride='IG:<handle>'`.
**Ligar:** buscar a foto/infos públicas do perfil via Zernio (account info) ou serviço equivalente; salvar a URL real em `iconOverride`. Confirmar em docs se `/analytics`/account expõe `profilePicture`.

---

## OpenClaw — o que é
Roda os 4 agentes da Seahub (**Poseidon, Apollo, Athena, Dionísio**) e consegue usar o **MCP da Zernio** (postar, ler analytics, rodar ads em linguagem natural). É a camada de IA.

### 6. Bolha de agentes (todas as telas)
**Hoje:** resposta stub que ecoa a pergunta + cita a seção.
**Ligar:** cada envio chama o agente correspondente à seção, passando contexto (métricas visíveis, período, dados da tela).
```ts
// /api/agent  { agent: 'poseidon'|'apollo'|'athena'|'dionisio', message, context }
const r = await fetch(`${env.OPENCLAW_URL}/agents/${agent}`, {
  method:'POST',
  headers:{ Authorization:`Bearer ${env.OPENCLAW_TOKEN}` },
  body: JSON.stringify({ message, context /* KPIs do escopo, seção, etc. */ })
});
```
Mapa agente↔seção: Poseidon (Painel, Canais Pagos, Geração, Concorrência) · Apollo (Calendário, Instagram, redes sociais) · Athena (Metas) · Dionísio (Persona & Público). Como o OpenClaw fala com a Zernio (MCP), Poseidon consegue puxar analytics, Apollo consegue postar, etc.

### 7. Importe seus dados → XLSX/PDF + kit do Panteão
**Hoje:** CSV parseado no cliente (real); XLSX/PDF marcam `Fonte.pendente=true`; kit só guarda o nome.
**Ligar:** mandar o arquivo pro OpenClaw, que **lê o conteúdo, sugere quais campos importam e o mapeamento** pros indicadores. Kit do Panteão: OpenClaw extrai e pré-preenche Ambiente/canais/produtos.
```ts
// /api/fontes/interpret  (multipart → OpenClaw)
const sugestao = await openclaw.interpret({ file, hint:'quais campos viram indicadores' });
// devolve campos + tipos + mapeamento sugerido → usuário confirma
```

---

## Ordem sugerida de ligação (pós dia-1)
1. **Contas (Zernio /connect)** — sem contas, nada flui. Guardar accountIds.
2. **Publicação (/posts + webhook)** — o calendário passa a publicar de verdade.
3. **Analytics (/analytics)** — painéis de rede e Canais Pagos com dado real (tira o "exemplo").
4. **Agentes (OpenClaw)** — liga a bolha; agentes usam o MCP da Zernio.
5. **Interpretação de arquivos (OpenClaw)** — XLSX/PDF + kit do Panteão.
6. **Ads boost / Inbox / WhatsApp** — conforme a necessidade.

## Notas
- Nunca expor `ZERNIO_API_KEY`/`OPENCLAW_TOKEN` no cliente — tudo via Route Handlers.
- Respeitar o **filtro de período** ao pedir analytics (passar `from/to` do escopo).
- Guardar `zernioPostId` no Post e reagir por **webhook** (não fazer polling).
- Zernio é **white-label** e usa só APIs oficiais das plataformas (não derruba alcance / não bane conta).
