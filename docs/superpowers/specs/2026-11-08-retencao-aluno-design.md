# Retenção do aluno — design

Data: 08/11/2026
Status: parte A executada; B e C em aberto

## 0. O que mudou depois do CRM (08/11)

Lendo as conversas da última semana, o padrão apareceu:

- 30/10, aluna Sabrina: *"instalei o app mas não sei o que fazer"*. A IA
  respondeu que **"o treino é montado por um instrutor e liberado no app"** e
  registrou um "pedido de liberação". Conclusão dela: estava esperando
  liberação. O app, de fato, recusava a escolha porque o cadastro não estava
  aprovado.
- As 3 mensagens de treino que estavam na fila para segunda eram justamente de
  **alunas não aprovadas**. Receberiam "seu treino está pronto" e o app diria
  "falta a recepção confirmar".
- A IA nunca soube que o aluno escolhe treino pronto sozinho (mig 074). O
  prompt dela era de 26/10, anterior ao fluxo.

Regra nova, que vale para tudo: **não se fala de treino com quem não consegue
treinar**. Só recebe mensagem de treino quem está aprovado, ativo e sem laudo
pendente. E toda mensagem de treino leva o link do app.

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
| Cadastros sem aprovação | 13 → 2 (só os com laudo) |

## 2. Objetivo

Fazer o aluno novo sair da conversa (ou da primeira entrada) **com um treino na
mão e um motivo para voltar**.

Metas em 14 dias:

- 80% dos alunos aprovados com ficha ativa.
- 30% com pelo menos 1 treino em 7 dias.
- 60% dos que respondem no WhatsApp com ficha em 48h.

## 3. Não-objetivos

- Disparo em massa ou aumento de volume no WhatsApp.
- Mudar preço, plano ou cobrança.
- Redesenho do app.
- Aplicar ficha em quem tem restrição médica sem laudo.

## 4. Restrições

- WhatsApp: máximo 25 mensagens de campanha/dia, 2 por lote, 9h–20h, sem
  domingo, freio após 5 falhas.
- Nada de acesso entre academias; RLS intacta.
- Produção: mudança de banco por migration com teste e prova de falha.

## 5. Fase A — feito em 08/11

1. **Link em toda mensagem de treino.** 6 variações da campanha `treino-pronto`
   levam `https://gymfitnesscampos.com.br/app/treino` junto com a pergunta.
2. **Elegibilidade.** `enqueue_starter_campaign` e o drip só consideram aluno
   aprovado, ativo e sem risco médico. Quem não pode escolher não recebe.
3. **Fila de retomada** `retomada-treino`: recebeu, 2 dias depois segue sem
   ficha e sem check-in → um lembrete com o link. Cron diário às 8h55.
4. **Aviso de treino aplicado** `treino-aplicado`: quem acabou de ganhar ficha
   recebe "seu treino já está no app" com o link. O mutirão do personal agora
   enfileira esse aviso sozinho.
5. **App.** Aluno não aprovado não vê mais a lista de treinos que vai falhar:
   vê "falta a recepção confirmar seu cadastro" com botão de WhatsApp.
6. **Agente do CRM (v5).** Sabe que o aluno escolhe treino pronto no app, que
   não existe "liberação pelo instrutor", e manda o link quando o assunto é
   treino.
7. **Aprovação.** Os 11 cadastros destraváveis foram aprovados. A aprovação
   aplica o treino inicial automaticamente (trigger da mig 073), então os 11
   já estão com ficha. Os 2 com laudo (Gerson e Caio) seguem pendentes, como
   deve ser.

## 6. Fase B — mutirão

A aprovação já aplicou ficha nos 11. Restam ~20 aprovados sem ficha, que já
receberam o convite para escolher. Eles entram na retomada em 2 dias. Se ainda
não escolherem, o botão "Aplicar agora para N alunos sem ficha" resolve em um
clique e agora avisa o aluno no WhatsApp.

Decisão: não aplicar ficha genérica em todos de uma vez enquanto o caminho de
escolha está funcionando. Ficha genérica é o plano B.

## 7. Fase C — primeira entrada (próximo sprint)

1. Uma tela só na primeira vez: escolher treino, ativar avisos, meta de 3
   treinos na semana.
2. Pedir push só depois do primeiro treino concluído.
3. Meta semanal na home com progresso 0/3, 1/3.

## 8. Como medimos

Semanalmente: alunos com ficha, logados 7d, check-ins 7d, push, respostas da
campanha, fichas criadas em 48h após resposta e primeiro treino.

## 9. Riscos

- Link repetido no WhatsApp pode aumentar o sinal de spam. Mitigação: teto de
  25/dia, 2 por lote, 9h–20h, sem domingo, texto variado, um único domínio.
- Ficha genérica não conversar com o objetivo. Mitigação: o aluno pode pedir
  ajuste pelo app e a ficha é editável.
- Aprovação automática de treino não substitui avaliação. O laudo continua
  bloqueando.
