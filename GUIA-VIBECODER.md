# Guia do vibecoder — Casinha do Marketing

Você não precisa ser programador para mexer neste projeto.  
Seu trabalho é **descrever o que quer**, **pedir para o agente usar a skill certa**, e **conferir se ficou certo**.

Este guia mostra **o que falar** no Cursor (ou outro agente) no dia a dia.

---

## Em uma frase

> **Conversa → spec → tickets → implementação → revisão.**

As **skills do Matt Pocock** são “modos de trabalho” que o agente segue para não inventar processo diferente em cada tarefa.

---

## O que é uma “skill”?

Pense numa skill como um **manual de como fazer aquela tarefa**.

Em vez de “faz isso aí”, você diz:

```
Use a skill to-spec e ...
```

O agente lê o manual e segue o mesmo caminho sempre. Isso padroniza bugs, features e melhorias.

**Skills que você vai usar quase todo dia:**

| Você quer… | Peça assim |
|---|---|
| Transformar conversa em especificação | `to-spec` |
| Quebrar spec em passos pequenos | `to-tickets` |
| Codar os passos | `implement` |
| Revisar se ficou certo | `code-review` |
| Entender/priorizar um pedido confuso | `triage` |
| Feature grande e cheia de dúvidas | `wayfinder` |
| Tela lenta / app pesado | `vercel-react-best-practices` |
| Banco lento / query estranha | `supabase-postgres-best-practices` ou `prisma-client-api` |
| Refinar termos do produto | `grill-with-docs` |

Lista completa: `.agents/skills/README.md` (só se precisar).

---

## Onde o trabalho fica salvo

Tudo que você planeja com o agente vai para a pasta **`.scratch/`**:

```
.scratch/
  nome-da-feature/
    spec.md          ← o que vamos fazer (especificação)
    issues/
      01-primeiro.md ← passo 1
      02-segundo.md  ← passo 2
```

Você **não precisa criar isso manualmente**. As skills `to-spec` e `to-tickets` criam para você.

---

## Receita básica (qualquer coisa nova)

### 1. Explique o que quer (conversa normal)

Fale em português, como se estivesse mandando mensagem para um colega:

> “Quero que no painel Overview o filtro de período lembre a última escolha do usuário.”

### 2. Gere a spec

```
Use a skill to-spec.

Quero que no painel Overview o filtro de período (semana/mês/trimestre/ano)
lembre a última escolha do usuário quando ele voltar na página.
```

O agente grava em `.scratch/<nome>/spec.md`.

### 3. Quebre em passos

```
Use a skill to-tickets na spec em .scratch/<nome>/spec.md
```

Você recebe arquivos `01-...md`, `02-...md`, etc.

### 4. Implemente

```
Use a skill implement nos tickets em .scratch/<nome>/issues/
que estiverem com Status: ready-for-agent
```

O agente codifica, roda testes (`npm test`) e checagens.

### 5. Revise antes de considerar pronto

```
Use a skill code-review desde o commit <X> (ou desde main)
e compare com a spec em .scratch/<nome>/spec.md
```

Se a revisão apontar problema, peça correção e rode `code-review` de novo.

---

## Cenário: corrigir um bug

### Quando usar

Algo que **já existia** e **parou de funcionar** ou está errado.

### O que pedir

**Passo 1 — entender e classificar**

```
Use a skill triage.

Category: bug
Status: needs-triage

Bug: [descreva o que acontece]
Esperado: [o que deveria acontecer]
Onde vi: [qual tela / qual ação]
```

**Passo 2 — se o agente precisar de mais detalhes**, responda no chat. Quando estiver claro:

```
Mova para Status: ready-for-agent e use grilling se ainda faltar detalhe.
```

**Passo 3 — corrigir**

```
Use a skill implement no ticket .scratch/.../issues/01-....md
```

**Passo 4 — revisar**

```
Use a skill code-review desde main e confira se o bug foi resolvido
sem quebrar outras coisas.
```

### Dica

Se o bug é simples (typo, botão errado), pode pular `to-spec` e ir direto:

```
Use a skill implement: corrigir [bug]. Depois code-review desde main.
```

Para bugs em dados de cliente, sempre mencione **workspace** — cada cliente é isolado.

---

## Cenário: implementar uma feature

### Feature pequena (1–2 telas, poucas regras)

Siga a **receita básica** (to-spec → to-tickets → implement → code-review).

### Feature média (várias telas ou integração)

Mesma receita, mas depois do `to-tickets` confira se os passos fazem sentido:

```
Leia os tickets em .scratch/<nome>/issues/ e me diga se a ordem está lógica
antes de implementar.
```

### Feature grande (muita incerteza, “não sei por onde começar”)

```
Use a skill wayfinder.

Destino: [descreva o resultado final em uma frase]
Dúvidas: [liste o que não está claro]
```

O `wayfinder` cria um **mapa** (`map.md`) com perguntas/decisões, uma de cada vez.  
Resolva os tickets do mapa antes de implementar tudo de uma vez.

### Quando os termos estão confusos

Ex.: “perfil”, “workspace”, “conta Zernio” misturados:

```
Use a skill grill-with-docs para alinhar os termos antes do to-spec.
```

Isso atualiza o `GLOSSARY.md` — vocabulário oficial do produto.

---

## Cenário: melhorar performance

Performance tem **dois lugares** comuns. Peça a skill certa:

### Tela lenta, app pesado, muita re-renderização

```
Use a skill vercel-react-best-practices.

Problema: [ex.: calendário demora para abrir]
Onde: [qual view / rota]
O que já tentamos: [se houver]
```

### Banco lento, migration, muitos dados

```
Use a skill supabase-postgres-best-practices.

Problema: [ex.: listagem de posts demora]
Tabela/rota: [se souber]
```

### Consultas no código (Prisma)

```
Use a skill prisma-client-api.

Otimize a query que alimenta [tela/API] sem mudar o comportamento visível.
```

Depois de qualquer melhoria de performance:

```
Use a skill code-review desde main e confirme que não mudamos comportamento
só para “ficar rápido”.
```

---

## Cenário: mudar visual / textos da interface

| O quê | Skill / doc |
|---|---|
| Cores, cards, layout Seahub | Leia `DESIGN.md` e peça implementação |
| Texto de marketing do site | `copywriting` |
| Texto **dentro do painel** | Descreva em PT-BR; use termo **"LLM"** (nunca “IA” genérico) |

Exemplo:

```
Siga o DESIGN.md. Ajuste o card de KPI no Overview para [descreva].
Depois code-review desde main.
```

---

## Comandos prontos (copiar e colar)

**Nova feature**

```
Use a skill to-spec: [descrição]
```

```
Use a skill to-tickets na spec .scratch/[nome]/spec.md
```

```
Use a skill implement nos tickets ready-for-agent em .scratch/[nome]/issues/
```

```
Use a skill code-review desde main com spec .scratch/[nome]/spec.md
```

**Bug**

```
Use a skill triage. Bug: [X]. Esperado: [Y]. Tela: [Z].
```

```
Use a skill implement no ticket [caminho do .md]
```

**Performance**

```
Use a skill vercel-react-best-practices: [problema na UI]
```

**Não sei qual skill usar**

```
Qual skill do Matt Pocock devo usar para: [descreva a situação]?
```

---

## Como saber se ficou pronto

O agente deve conseguir rodar (ou você pede para rodar):

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Se mexeu em dados de seed: `npm run db:verify`.

**Você não precisa entender cada linha** — só pergunte:

```
Todos os comandos de "pronto" passaram? Se não, corrija e me mostre o que falhou.
```

---

## O que pedir ajuda humana (dev de verdade)

Peça revisão de pessoa quando o agente mencionar:

- **RLS** / políticas de banco / migration
- **Stripe**, cobrança, planos
- **Zernio** (integração de redes)
- Mudança que afeta **todos os workspaces** de uma vez
- Dúvida de **segurança** (login, permissões, vazamento de dados)

Para o resto, o fluxo com skills costuma ser suficiente.

---

## O que evitar

1. **“Faz aí” sem skill** — funciona uma vez, bagunça na próxima.
2. **Pular a spec em feature grande** — o agente inventa escopo.
3. **Ignorar `code-review`** — é o controle de qualidade.
4. **Usar `docs/historico/` como referência** — é arquivo antigo, não vale.
5. **Misturar clientes** — cada workspace é um cliente; dados não podem vazar.

---

## Palavras que aparecem no projeto

| Termo | Significado simples |
|---|---|
| **Workspace** | Um cliente/empresa no sistema |
| **View** | Uma seção do painel (Overview, Instagram, Ads…) |
| **Spec** | Documento do que vamos fazer |
| **Ticket** | Um passo pequeno da implementação |
| **LLM** | Os assistentes conversacionais do produto |
| **Seam** | “Ponto de teste” — lugar seguro para o agente validar código |

Mais termos: `GLOSSARY.md`.

---

## Fluxo visual (cola na parede)

```
     ┌─────────────┐
     │  Você descreve │
     └──────┬──────┘
            ▼
     ┌─────────────┐
     │   to-spec    │ → .scratch/.../spec.md
     └──────┬──────┘
            ▼
     ┌─────────────┐
     │  to-tickets  │ → issues/01, 02, 03...
     └──────┬──────┘
            ▼
     ┌─────────────┐
     │  implement   │ → código + testes
     └──────┬──────┘
            ▼
     ┌─────────────┐
     │ code-review  │ → está certo?
     └─────────────┘
```

Feature enorme ou muita dúvida? Comece com **`wayfinder`** em vez de `to-spec`.

---

## Referências (se o agente precisar)

| Arquivo | Para quê |
|---|---|
| `AGENTS.md` | Regras gerais do projeto |
| `DESIGN.md` | Visual Seahub |
| `.scratch/README.md` | Formato de specs e tickets |
| `.agents/skills/README.md` | Índice de todas as skills |

---

**Resumo:** sempre nomeie a skill no pedido. O agente faz o trabalho pesado; você dirige o produto.
