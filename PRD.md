# PRD — Casinha do Marketing (Seahub)
**Versão:** 1.0 (blueprint → app) · **Autor:** time de marketing Seahub · **Alvo:** Next.js + Postgres no EasyPanel

> Este PRD descreve **tudo que a Casinha faz hoje** (já implementado no blueprint `casinha-do-marketing.html`). Use como guia lógico de construção. Onde houver dúvida de layout/comportamento, **o blueprint é a fonte de verdade**.

---

## 1. Visão & objetivo
A Casinha é o **sistema operacional de marketing** da Seahub: um painel único que reúne performance de redes, geração de leads, mídia paga, metas (OKR), calendário de conteúdo com agendamento, personas, concorrência e uma camada de personalização. É uma ferramenta **interna** (time de marketing + comercial), single-workspace (Seahub) por ora.

**Não-objetivos da v1 no EasyPanel:** ligar de verdade Zernio (publicação/analytics/ads) e OpenClaw (agentes/IA). Esses ficam como *seams* mockados.

## 2. Usuários
- **Nathã** (marketing/lead) — usa tudo, configura o ambiente.
- Time (Giovana, Arthur, Regis, etc.) — consomem painéis, calendário, metas.
- Sem multi-tenant por ora (1 workspace). Auth simples pode entrar depois (gate por senha, estilo Panteão).

## 3. Arquitetura
- **Front:** Next.js (App Router) + Tailwind. Um **shell** com sidebar (navegação) + toolbar (título + switcher de período) + área de conteúdo.
- **Estado de UI:** store Zustand espelhando o `state` do blueprint (view atual, período/ano/mês/trimestre, filtros, flags de edição, modal de post, agente aberto, etc.).
- **Persistência:** Postgres via Prisma. Entidades no §6.
- **Integrações (depois):** Zernio (API unificada de redes) e OpenClaw (MCP de agentes).

## 4. Navegação (sidebar) — grupos e itens
- **Visão geral:** Painel
- **Canais:** Instagram + (dinâmico) TikTok, X/Twitter, Facebook, LinkedIn, YouTube, Threads, Reddit, Pinterest, Bluesky, Snapchat, Google Business — **só aparecem os que estiverem ativos** em Personalização → Redes & canais (grupo Social).
- **Comercial:** Geração por Canais · Canais Pagos · Metas 2026
- **Operação:** Calendário
- **Estratégia:** Persona & Público · Concorrência
- **Configuração:** Personalização

Cada item da nav tem ícone + label. O painel de rede social só existe se a rede estiver ligada.

## 5. Cross-cutting (regras que valem para vários painéis)

### 5.1 Filtro universal de período
Toolbar tem um switcher **Semana · Mês · Trimestre · Ano** + seletor de ano (2024/2025/2026) e de mês. **Todo painel de dados respeita o período selecionado** (Painel, Instagram, Canais Pagos, Geração, Metas, painéis de rede). Helper central `scopeVal(monthly[12], cfg)`: mês → `monthly[m]`; trimestre → soma do trimestre; ano → soma total; semana → valor da semana (quando houver série semanal). Rótulo do escopo via `scopeLabelText`. Padrão de abertura: `mês` do ano corrente.

### 5.2 Configuração de indicadores por painel
Em Personalização → **Indicadores dos painéis**, cada painel é um **acordeão recolhível** (recolhido por padrão) com indicadores **agrupados por tipo** e um contador "ligados/total". Ligar/desligar um indicador **mostra/esconde** o bloco correspondente no painel. Ex.: Painel → grupos "KPIs do topo" (Seguidores, Leads, Investimento, MRR — cada um liga/desliga), "Gráficos", "Redes sociais", "Navegação & leitura". Instagram, Metas e cada rede social têm seus próprios grupos.

### 5.3 Bolha de agentes (canto inferior direito)
Bolha flutuante fixa em todas as telas. **Troca de agente conforme a seção**: Poseidon (Painel, Canais Pagos, Geração, Concorrência), Apollo (Calendário, Instagram e redes sociais), Athena (Metas), Dionísio (Persona & Público). Abre um chat com: intro do agente, 3 sugestões contextuais, campo de envio. **Resposta é stub** (ecoa a pergunta + cita a seção). *Seam OpenClaw:* na produção cada envio chama o agente correspondente no OpenClaw. Rodapé: "Preview · respostas reais via OpenClaw".

### 5.4 Ecossistema de canais (Zernio)
Personalização → **Redes & canais** lista **23 canais em 3 grupos**: **Social** (12), **Conversas** (WhatsApp, Telegram, Discord, Slack), **Ads** (Meta, Google, LinkedIn, TikTok, Pinterest, X, OpenAI Ads). Ligar via toggle. *Seam Zernio:* conexão real é OAuth hospedado da Zernio (1 clique, sem app review). Social liga painel; Conversas/Ads entram em calendário/contas e mídia paga.

## 6. Modelo de dados (Prisma)
Entidades **persistidas** (o usuário edita):
- **EnvConfig** (singleton do workspace): `redes` (JSON: {id→bool}), `paineis` (JSON: {panel→{indId→bool}}), `contas` (JSON: {id→bool} das redes conectadas p/ publish), `cfgOpen`/`impOpen` (JSON de UI, opcional).
- **Perfil** (singleton): `empresa`, `segmento`, `cidade`, `site`, `canais` (String[]), `produtos` (String[]), `relacao` (JSON: {"canal|produto"→bool}), `kitArquivo` (nome do PDF do Panteão, opcional).
- **Post** (calendário): `data` (Date), `hora`, `titulo`, `canal`, `perfil`, `colab`, `pilar`, `formato`, `funil`, `legenda`, `cta`, `hashtags`, `arquivo`, `status` (rascunho|agendado|publicado|falhou), `contas` (String[] de redes-alvo).
- **Fonte** (dados importados): `nome`, `tipo` (csv|xlsx|pdf), `campos` (Int), `usados` (Int), `linhas` (Int), `pendente` (Bool).
- **Objetivo/Area/KR** (OKR): Objetivo (texto, singleton) · Area (`nome`, `ordem`) · KR (`areaId`, `kr`, `alvo`, `un`, `tag`, `resp`, `ordem`).
- **Persona:** `tag`, `handle`, `emoji`, `cover`, `nome`, `representa`, `comunica`, `dores` (String[]), `canais`, `gatilho`, `stats` (JSON [[v,l]]), `foto` (opcional), `ordem`.
- **Concorrente:** `nome`, `ig`, `linkedin` (Bool), `youtube` (Bool), `dominio`, `categoria` (espaco|marca|certificado|cobranca), `iconOverride` (String, opcional: URL/emoji/"IG:").

Dados **de seed / read-mostly** (vêm do blueprint; podem ficar em tabela ou em `lib/seed`):
- **Instagram mensal** por ano (seguidores, visualizações, engajamento) — multi-perfil.
- **ADS** — lista de frentes por ano, cada uma com arrays mensais de `leads/vendas/receita/invest` (canal × produto).
- **LEADS_M** — total de leads por mês/ano (2026 real: `[423,244,303,242,271,221,200,...]`). Anos antigos: só anual em `CANAIS`.
- **CANAIS** — geração anual por produto × canal (2024/2025/2026; 2026 = 6 produtos, 1.904 leads).
- **MRR / KPIs de persona** — R$ 374,6k MRR, 1.301 contratos, conv. 39,4%, receita por produto.

> **Todos esses valores já estão no blueprint.** Extraia e semeie verbatim.

## 7. Especificação por seção

### 7.1 Painel (overview)
Resumo executivo do escopo selecionado. Blocos (cada um ligável na config):
- **KPIs do topo:** Seguidores (fim do escopo), Leads gerados (soma do escopo), Investimento pago (+ ROAS), MRR atual. YoY só quando período = Ano.
- **Gráficos:** Leads por ano e Seguidores por ano (2024–2026).
- **Redes sociais:** mini-card por rede ativa (KPIs-topo + clique abre o painel da rede; rede sem dados mostra "conecte via Zernio").
- **Navegação & leitura:** atalhos clicáveis + leitura rápida (texto) do escopo.
Subtítulo do header mostra o rótulo do escopo (ex.: "Julho 2026").

### 7.2 Instagram
Multi-perfil (Seahub + outros). Indicadores (ligáveis): seguidores (novos/saída/líquido), rendimento orgânico, atividades no perfil & visitas ao site, seguidores vs. não-seguidores. Views por período. Top conteúdos e audiência são seed. *Conexão nativa via Zernio depois.*

### 7.3 Geração por Canais
Card "Geral no período" (YoY) + 1 card por produto (2026: Escritório Virtual 473, Salas de reunião/atendimento/coworking 795, Auditórios 330, Salas Privativas & Coworking 248, Seabox 35, SeaOffice 23 = 1.904 YTD). Quebra por canal (Site, Loja, Programa de Parceria, Indicação, Redes Sociais, Orgânico, Cliente Ativo, Prospecção, Comunidade, Eventos…).

### 7.4 Canais Pagos
KPIs (Investimento, Receita+ROAS, Vendas+conversão, CAC) **seguindo o período**. Tabela **canal × produto** com colunas que se adaptam ao período (célula editável no modo mês, `data-metric`). Gráfico "métrica por canal" do escopo. Escala de status (excelente/bom/atenção/crítico). Frentes: Google Ads, Meta Ads, Programa de Parceria.

### 7.5 Metas 2026 (OKR)
Objetivo do ano no topo. KRs **agrupados por 4 áreas** (Marketing, Comunidade, Comercial/Imobiliário, Eficiência/Operação), cada card com alvo/unidade/descrição/tag/responsável. **Modo Editor** (toggle "✎ Editar"): edita objetivo, nome de área, cada KR; **+ Novo KR** por área, **+ Nova área**, remover KR/área. Persistir em Objetivo/Area/KR. Fonte real: lista ClickUp "SEAHUB OKR 2026".

### 7.6 Calendário de conteúdo (estilo mLabs)
- **Grid mensal** (Dom–Sáb) com navegação de mês; feriados/eventos como contexto.
- **Barra "Contas conectadas"** (fundo preto) — social + conversas (16 canais), Conectar/Desconectar (*seam Zernio OAuth*).
- **Novo post** (modal): capa/arquivo, canal, formato, perfil, perfil colaborador, data/hora, título, pilar/categoria, funil, legenda, CTA, hashtags, **Publicar em** (contas conectadas), **status** (rascunho→agendado→publicado→falhou), **Publicar agora** (*seam*: só muda status).
- **Filtro por status** (Todos/Rascunho/Agendado/Publicado) + chips do grid com borda por status.
- **Fila de agendamentos** (fundo com topo vermelho): próximos agendados (cross-mês) com contas-alvo e "Publicar agora".
- Multi-perfil: post com perfil colaborador aparece nos dois perfis no filtro.

### 7.7 Painéis de rede social (dinâmicos)
Ao ligar uma rede social em Personalização, entra um painel `/canal/[rede]`: KPIs próprios da rede + gráfico de evolução + top conteúdos. Rede com dados de exemplo (TikTok, LinkedIn, YouTube) vs. **placeholder** ("Sem dados ainda — conecte via Zernio") nas demais. Cada rede tem seus indicadores ligáveis na config.

### 7.8 Persona & Público
- KPIs (clientes, contratos, MRR, conversão) + **Receita por produto** (Sala Privativa é a margem, EF é volume).
- **Explorador "Tinder":** um card por persona (P0 marca + P1–P4 por produto) com **foto configurável** (URL; emoji como fallback), navegação ‹ › + dots, e painel completo: quem representa, o que comunica, dores (chips), canais, gatilho de conversão, stats.
- **Insights estratégicos** (silêncio é a maior perda; base ativa converte melhor; parceria é o melhor canal; saúde pronta pra comprar).

### 7.9 Concorrência
Grid filtrável por linha de negócio (Geral/Espaço&EV/Registro de Marca/Certificado Digital/Cobrança), 24 players. Cada card: logo (Clearbit por domínio + fallback inicial), nome, @, presença por canal (ícone colorido = tem). **Ícone editável** (✎): colar **URL/emoji** ou **"Puxar do IG"** (*seam*: aplica avatar com gradiente do Instagram; foto real vem do backend).

### 7.10 Personalização (centro de controle)
- **Importe seus dados** (acordeão colapsado): kit do Panteão (PDF, *extração no backend*) + Fontes de dados (CSV lido no cliente → detecta campos/tipos → seleciona quais usar; XLSX/PDF *interpretados no backend/OpenClaw*).
- **Ambiente:** empresa/marca, segmento, cidade, site.
- **Canais trabalhados** + **Produtos & serviços** (chips editáveis) + **Relação canais × produtos** (matriz de marcação que conecta os dois).
- **Redes & canais:** 23 toggles em Social/Conversas/Ads (§5.4).
- **Indicadores dos painéis:** acordeões por painel (§5.2).

## 8. Regras de negócio & constantes
- Leads mensais reais só de 2026; anos antigos = anual.
- Marca: cores/typografia do §Design; "LLM" sempre; SeaHealth descontinuado.
- Persona/OKR/concorrentes vêm do estudo real (Conexa + Chatwoot + ClickUp) — já no blueprint.
- Status de post e de KR usam as cores de status da marca.

## 9. Aceite (v1 no EasyPanel)
1. App no ar no EasyPanel, navegável, visual fiel ao blueprint.
2. Postgres conectado; seed populado com os dados reais do blueprint.
3. Persistência funcionando para: **EnvConfig** (redes/indicadores/contas), **Perfil/Ambiente + matriz**, **Posts do calendário**, **OKR (editor)**.
4. Filtro de período dirigindo os painéis; config de indicadores mostrando/escondendo blocos.
5. Bolha de agentes e ações de publish/import funcionando como **stub** (seams marcados).
6. Zero erro de console.
