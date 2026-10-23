# WhatsApp com IA na GymFitness — Fase 1 (atendimento no ar)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** colocar o número oficial da academia no Deskcomm com uma IA respondendo o atendimento padrão e transferindo para uma pessoa quando necessário, sem ninguém atender pelo CRM.

**Architecture:** o Deskcomm já roda na VPS com WAHA, agente, base de conhecimento, aviso de caso e pausa automática da IA. A Fase 1 é operação e configuração, sem alterar o núcleo do Deskcomm e sem código novo no app. O celular da academia continua sendo o único aparelho que responde.

**Tech Stack:** Deskcomm (Next.js + Supabase + WAHA), agente de IA com RAG, aviso de caso por WhatsApp, app GymFitness (Next.js) apenas para links.

**Spec:** `docs/superpowers/specs/2026-10-23-whatsapp-ia-academia-design.md`

## Global Constraints

- Número oficial: `(22) 99778-7186` (`5522997787186`).
- Atendimento humano só pelo celular da academia. Sem WhatsApp Web, sem CRM.
- Ninguém atende pelo Deskcomm. Ele é motor e canal, não tela de atendimento.
- Não alterar o núcleo do Deskcomm nesta fase.
- Preços, horários e endereço exatamente como na spec, seção 8.
- A IA nunca confirma horário de experimental. A recepção confirma.
- A IA não dá conselho de saúde, não negocia desconto e não matricula.
- Nenhum disparo em massa nesta fase. Só resposta a quem chega.
- Respeitar `whatsapp_consent` e pedido de parada.
- Go-live só depois da bateria de testes em allowlist.

## Review Focus

- Pessoa pergunta desconto ou condição fora da tabela: a IA não inventa, transfere.
- Mensagem fora do horário: a IA não promete pessoa na hora.
- Humano responde pelo celular: a IA para e não responde por cima.
- Relato de lesão, dor ou saúde: a IA não orienta, transfere.
- Mensagem em grupo: a IA ignora.

---

### Task 1: Criar a organização GymFitness no Deskcomm

**Files:** nenhum (operação).

**Interfaces:**
- Consumes: instalação Deskcomm em `crm.i9base.com.br`, conta de plataforma `i9base.tech@gmail.com`.
- Produces: `organization_id` da GymFitness, que todas as tarefas seguintes usam.

- [ ] **Step 1: Criar a organização**

No Deskcomm, criar a organização **GymFitness Campos** com dono `i9base.tech@gmail.com`. Não usar a MahaFlow nem a i9BASE para os dados da academia.

- [ ] **Step 2: Verificar no banco**

```bash
cd /root/stacks/deskcomm
DBURL=$(grep '^SUPABASE_DB_URL=' .env | cut -d= -f2- | tr -d '"')
psql "$DBURL" -tAc "select id, display_name, slug, status from organizations where display_name ilike '%gymfitness%';"
```

Esperado: uma linha `GymFitness Campos | ... | active`.

- [ ] **Step 3: Registrar o id**

Anotar o `organization_id` no topo deste plano, na seção de execução, para as tarefas seguintes.

---

### Task 2: Conectar o número oficial

**Files:** nenhum (operação).

**Interfaces:**
- Consumes: `organization_id` da Task 1, celular da academia em mãos.
- Produces: `channel_session_id` ativo com o número `5522997787186`.

- [ ] **Step 1: Abrir a conexão**

No Deskcomm, entrar na organização GymFitness e abrir **Conectar WhatsApp** (`/onboarding/connect-whatsapp`). Gerar o QR.

- [ ] **Step 2: Escanear com o celular da academia**

No celular do número `(22) 99778-7186`: WhatsApp, Aparelhos conectados, Conectar aparelho, escanear o QR. Não desconectar o celular; ele continua funcionando.

- [ ] **Step 3: Verificar a sessão**

```bash
cd /root/stacks/deskcomm
DBURL=$(grep '^SUPABASE_DB_URL=' .env | cut -d= -f2- | tr -d '"')
psql "$DBURL" -tAc "select cs.id, cs.status, cs.waha_session_name, cs.metadata->>'ai_gate' from channel_sessions cs where cs.organization_id = '<ORG_ID>';"
```

Esperado: `status` conectado e `ai_gate` em `allowlist` (o canal nasce fechado).

- [ ] **Step 4: Teste de recebimento**

De outro celular, enviar "oi" para o número da academia. Verificar no Deskcomm que a mensagem entrou e que a IA ainda **não** respondeu (canal em allowlist).

---

### Task 3: Publicar a base de conhecimento

**Files:** nenhum (operação).

**Interfaces:**
- Consumes: `organization_id`.
- Produces: fonte de conhecimento indexada, usada pelo agente da Task 4.

- [ ] **Step 1: Criar a fonte**

No Deskcomm, em **IA > Base de conhecimento**, criar uma fonte de texto chamada `Academia GymFitness` com o conteúdo da spec, seção 8: horários, planos, formas de pagamento, modalidades, endereço e regras de experimental.

- [ ] **Step 2: Reindexar**

Publicar e reindexar a fonte.

- [ ] **Step 3: Verificar os trechos**

```bash
cd /root/stacks/deskcomm
DBURL=$(grep '^SUPABASE_DB_URL=' .env | cut -d= -f2- | tr -d '"')
psql "$DBURL" -tAc "select name, status, last_index_status, chunks_count from ai_knowledge_sources where organization_id = '<ORG_ID>';"
```

Esperado: `Academia GymFitness | pronta | indexado | N` com N maior que zero.

- [ ] **Step 4: Conferir conteúdo**

Abrir a prévia e confirmar que aparecem horário, preço, endereço e pagamento. Corrigir antes de seguir.

---

### Task 4: Criar e publicar o agente

**Files:** nenhum (operação).

**Interfaces:**
- Consumes: base da Task 3, credencial de IA da organização.
- Produces: agente publicado e ligado ao canal da Task 2.

- [ ] **Step 1: Garantir a credencial de IA**

Em **IA > Credenciais**, cadastrar a chave da OpenRouter da organização e validar. Sem credencial válida o agente não responde.

- [ ] **Step 2: Criar o agente**

Criar o agente **Atendimento GymFitness** com o prompt da spec, seção 9. Regras obrigatórias no prompt: não inventar, não negociar desconto, não dar conselho de saúde, não confirmar horário, pedir nome e oferecer experimental, transferir quando não souber.

- [ ] **Step 3: Ligar a base**

Vincular a fonte da Task 3 ao agente.

- [ ] **Step 4: Publicar**

Publicar a versão do agente e ligar ao canal da Task 2.

- [ ] **Step 5: Testar uma pergunta**

De um número de teste, perguntar "qual o horário de sábado?". Esperado: resposta com 8h às 13h.

---

### Task 5: Configurar o aviso de transferência

**Files:** nenhum (operação).

**Interfaces:**
- Consumes: canal da Task 2.
- Produces: aviso de caso entregue no WhatsApp do Claudeir.

- [ ] **Step 1: Configurar o destino**

Em **IA > Casos > Avisos**, ligar o aviso de caso para `+5522997548860` (Claudeir), usando o canal da academia. Ativar a resposta por WhatsApp.

- [ ] **Step 2: Verificar a configuração**

```bash
cd /root/stacks/deskcomm
DBURL=$(grep '^SUPABASE_DB_URL=' .env | cut -d= -f2- | tr -d '"')
psql "$DBURL" -tAc "select organization_id, telefone_destino, ligado, resposta_whatsapp_habilitada from config_aviso_de_caso where organization_id = '<ORG_ID>';"
```

Esperado: `+5522997548860 | t | t`.

- [ ] **Step 3: Testar a transferência**

De um número de teste, pedir "quero falar com uma pessoa". Esperado: a IA avisa que chamou a equipe e o Claudeir recebe o aviso no WhatsApp. Responder "ok" e confirmar o registro.

---

### Task 6: Bateria de testes em allowlist

**Files:** nenhum (operação).

**Interfaces:**
- Consumes: agente publicado, canal conectado, aviso configurado.
- Produces: evidência de que a IA responde certo e transfere nos casos previstos.

- [ ] **Step 1: Fechar o canal para teste**

Em **Canal > Acesso da IA**, colocar em modo pré-go-live com os números de teste: Vinicius, Claudeir, Rebeca e Daiana.

- [ ] **Step 2: Rodar as perguntas**

De cada número de teste, enviar e conferir:

1. Horário de sábado e domingo.
2. Mensalidade.
3. Plano família.
4. Plano 3x na semana.
5. Embarcado (15 dias).
6. Trimestral.
7. Diária.
8. Personal + academia 3x e 5x.
9. Formas de pagamento.
10. Endereço.
11. Modalidades de hoje.
12. Modalidades previstas e a data.
13. Funcional kids para quem tem filho.
14. Aula experimental para aluno que já usa o app.
15. Aula experimental para quem não é aluno.
16. "Tem desconto?" (deve transferir).
17. "Estou com dor no ombro, posso treinar?" (deve transferir).
18. "Quero falar com uma pessoa" (deve transferir).
19. "Qual o Wi-Fi?" (não está na base, deve transferir).
20. Mensagem em grupo (deve ignorar).

- [ ] **Step 3: Testar a pausa**

Do número de teste, iniciar uma conversa. Responder pelo celular da academia. Verificar que a IA **não** responde mais por 60 minutos e que renova a cada mensagem humana.

- [ ] **Step 4: Registrar o resultado**

Anotar no plano as respostas erradas e corrigir a base ou o prompt antes do go-live.

---

### Task 7: Abrir para o público

**Files:** nenhum (operação).

**Interfaces:**
- Consumes: testes da Task 6 aprovados.
- Produces: canal aberto respondendo clientes reais.

- [ ] **Step 1: Abrir o acesso**

Em **Canal > Acesso da IA**, mudar para **aberto**.

- [ ] **Step 2: Acompanhar as primeiras 24 horas**

Conferir: mensagens recebidas, respostas da IA, transferências, avisos entregues e alguma resposta errada.

- [ ] **Step 3: Corrigir na hora**

Preço ou horário errado: corrigir a base e republicar o agente. Transferência sem aviso: conferir o destino.

---

### Task 8: Runbook e links do app

**Files:**
- Create: `docs/runbooks/whatsapp-ia-academia.md`
- Verify: `src/lib/whatsapp.ts` e variável `NEXT_PUBLIC_GYM_WHATSAPP`

**Interfaces:**
- Consumes: operação da Fase 1.
- Produces: documentação para o Vinicius operar sozinho.

- [ ] **Step 1: Conferir o link no app**

No app, abrir **Perfil > Falar com a academia** e confirmar que abre o WhatsApp `5522997787186`. Conferir também a variável na Vercel.

- [ ] **Step 2: Escrever o runbook**

Criar `docs/runbooks/whatsapp-ia-academia.md` com: como reconectar o WhatsApp, como atualizar preço na base, como ver os avisos de caso, o que fazer se a IA errar, e quem avisar.

- [ ] **Step 3: Commit**

```bash
cd /root/gymfitnessapp
git add docs/runbooks/whatsapp-ia-academia.md
git commit -m "docs: runbook do WhatsApp com IA da academia"
```

---

## Fora desta fase

- Agendamento de modalidades no app (Fase 2, plano próprio).
- Disparos automáticos por evento (Fase 3).
- Aviso no app para Rebeca e Daiana (Fase 2).
- Qualquer alteração no núcleo do Deskcomm.
