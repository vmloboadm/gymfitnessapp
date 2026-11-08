# Retenção do aluno — design

Data: 08/11/2026
Status: aguardando aprovação

## 1. Por quê

Dados de 08/11:

| Métrica | Valor |
|---|---|
| Alunos no app | 67 |
| Sem ficha ativa | 48 (72%) |
| Entraram nos últimos 30 dias | 46 |
| Treinaram nos últimos 7 dias | 6 |
| Logaram nos últimos 7 dias | 6 |
| Push ativo | 4 |
| Cadastros sem aprovação | 13 (11 destraváveis, 2 com laudo pendente) |

O padrão: o aluno entra uma vez, não vê treino e não volta. A campanha de WhatsApp
com CTA de conversa teve 5 respostas em 13 envios (38%) e **nenhuma virou ficha**.
A conversa não fecha o ciclo.

O app já tem as peças: escolha de treino base pelo próprio aluno (mig 074),
mutirão de fichas para o personal (mig 073), push, instalação de PWA e barra de
configuração. O que falta é ligá-las na ordem certa.

## 2. Objetivo

Fazer o aluno novo sair da conversa (ou da primeira entrada) **com um treino na
mão e um motivo para voltar**.

Metas em 14 dias:

- 80% dos alunos aprovados com ficha ativa (hoje 28%).
- 30% com pelo menos 1 treino em 7 dias (hoje 9%).
- 60% dos que respondem no WhatsApp com ficha em 48h (hoje 0%).

## 3. Não-objetivos

- Disparo em massa ou aumento de volume no WhatsApp.
- Mudar preço, plano ou cobrança.
- Redesenho do app.
- Aplicar ficha em quem tem restrição médica sem laudo.

## 4. Restrições

- WhatsApp: máximo 25 mensagens de campanha/dia, 2 por lote, 9h–20h, sem domingo,
  freio após 5 falhas, sem link repetido.
- Nada de acesso entre academias; RLS intacta.
- Produção: mudanças de banco por migration com teste e prova de falha.
- Ficha genérica nunca substitui ficha do personal.

## 5. Fase B — mutirão de fichas (primeiro, é 1 clique)

Já existe a tela `personal/treino-inicial` com o botão "Aplicar agora para N
alunos sem ficha" (`assign_starter_plans_bulk`, mig 073). Ela pega alunos
aprovados, sem risco médico, sem ficha: **31 hoje**.

Passos:

1. Rodar o mutirão (staff clica ou eu executo a mesma regra por SQL).
2. Aprovar os 11 cadastros destraváveis e rodar de novo (mais 11).
3. Conferir: toda ficha criada tem dias e exercícios; o aluno recebe aviso.

Resultado esperado: 48 sem ficha → ~6 (só os 2 com laudo e os que entrarem depois).

Risco: ficha genérica não conversar com o objetivo do aluno. Mitigação: o aluno
pode pedir ajuste pelo `PersonalSupportBox`, e a ficha é editável.

## 6. Fase A — a resposta do WhatsApp vira ficha

1. **Contexto no agente:** quando o aluno responde à campanha ("1", "2x", "noite",
   "quero"), a IA reconhece a pergunta que fez, responde no mesmo assunto e manda
   o link `gymfitnesscampos.com.br/app/treino` (onde o picker abre para quem está
   sem ficha).
2. **Aprovação:** aprovar os 11 (sem risco médico) para o picker não recusar com
   `nao_aprovado`.
3. **Fila de retomada:** nova campanha `retomada-treino` para quem recebeu
   `treino-pronto` e, 2 dias depois, continua sem ficha e sem check-in.
   Um segundo toque em 5 dias. Mesmo teto, mesmos horários, mesmas variações.
4. **Medição:** contar respostas, fichas criadas em 48h e primeiro treino.

Fora do escopo: a IA montar treino. Ela entrega o caminho; a ficha vem do modelo.

## 7. Fase C — primeira entrada que segura

1. **Fluxo único de primeira vez:** depois da aprovação, uma tela só —
   "escolha seu treino" (reusa `StarterPicker`), "ative os avisos" (reusa
   `AppSetupBar`), "sua meta dos próximos 7 dias" (3 treinos).
2. **Deep link:** o link do WhatsApp cai direto nessa tela.
3. **Meta semanal na home:** progresso 0/3, 1/3… com o mesmo Resolver do treino.
4. **Push:** pedir permissão só depois do primeiro treino concluído (hoje o
   pedido aparece cedo e é adiado; 4 de 67 aceitaram).

Métrica: % que escolhe treino na primeira sessão e % que ativa push.

## 8. Como medimos

Consulta semanal (já usada neste diagnóstico): alunos com ficha, logados 7d,
check-ins 7d, push, respostas da campanha e fichas criadas após resposta.

## 9. Ordem

1. **B** — hoje (1 clique + 11 aprovações).
2. **A** — esta semana (agente + fila de retomada).
3. **C** — próximo sprint.

B e A podem rodar juntos; C depende de A estar medindo.

## 10. Decisões do construtor

- Reusar `StarterPicker`, `AppSetupBar` e `assign_starter_plans_bulk` em vez de
  criar telas novas.
- A fila de retomada usa o mesmo `whatsapp_outbox` e o mesmo drip, com nome de
  campanha próprio.
- Não criar chat novo: a conversa continua no CRM.
