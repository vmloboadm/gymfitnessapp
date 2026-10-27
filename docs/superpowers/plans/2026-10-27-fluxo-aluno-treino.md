# Plano: corrigir o fluxo de treino do aluno

## Contexto

O aluno precisa de um fluxo unico entre Home, calendario, check-in e treino. A
programacao do personal e a fonte da verdade. O plano ativo manda; `daysSelected`
e a semana; `available_days` e apenas fallback. Nao criar tabela nova de agenda.

Causas confirmadas:

1. `workout_logs.session_id` tem FK para `equipment_sessions`, mas o app grava
   `workout_sessions.id`. O insert inteiro falha e a fila offline repete o erro.
2. `slot_checks.program_id` aponta para `workout_programs`, mas o app grava
   `student_workouts.id`. A tabela esta vazia e a rotacao nunca avanca.
3. Home e Treino usam sequencia fixa/rotacao, nao o dia programado. A Home diz
   "faltou ontem" em dia nao programado.
4. `totalToday` conta exercicios de todos os dias do programa; `finishedToday`
   nunca fecha.
5. Check-in chama `startDaySession` (cronometro de treino) e check-out chama
   `endWorkoutSession` (encerra o treino).
6. Finalizacao espera rede antes de encerrar o cronometro; resumo e feedback
   ficam fora da viewport; seta do topo minimiza em vez de expandir.
7. Planos ativos de outras alunas apontam para programas "Bruna Gomes"; copias
   mantem `ai_draft.nome` da Bruna.

## Tarefas

### Tarefa 1: persistencia de logs e slot checks

- Migration `workout_logs.workout_session_id` com FK para `workout_sessions`.
- `workout_logs.session_id` continua sendo a sessao de equipamento.
- `workout_logs` recebe IDs gerados no cliente; a fila offline vira outbox.
- O sync trata duplicidade por PK como sucesso e nao repete insert.
- `slot_checks` usa `workout_programs.id`; `student_workouts.id` fica so em
  `workout_sessions.workout_id` e `workout_logs.workout_id`.
- Expor `programId` no plano do aluno.
- Teste: `node scripts/verify-workout-db.mjs` falha antes, passa depois.

Aceite: insert de log com `workout_session_id` valido passa em transacao; insert
de slot check com `program_id` de programa passa; nenhum insert usa o ID errado.

### Tarefa 2: separar check-in de treino

- `doEntry`: grava `checkins`, marca dia liberado, nao inicia cronometro.
- `doExit`: grava `saida`, nao encerra treino; avisa se ha treino em andamento.
- Tela de check-in usa `gymEntry.checked_at` para entrada e tempo na academia.
- Home diferencia "na academia" de "de treino".
- Teste: `node --experimental-strip-types --test src/lib/workout/training-day.test.ts`
  cobre o resolvedor de estado e o check-in nao inicia sessao.

Aceite: check-in nao cria `gymfit_session_v1`; inicio do treino cria; check-out
nao remove a sessao de treino.

### Tarefa 3: estado unico da programacao

- Resolvedor puro `src/lib/workout/training-day.ts`.
- Provider `src/components/providers/StudentTrainingProvider.tsx`.
- Home usa o mesmo slot/dia do Treino; `daysSelected` manda; `available_days`
  fallback; rotacao so sem dias fixos.
- Home: dia nao programado = descanso, sem "faltou"; dia programado perdido =
  pendente com o dia certo; meta semanal = dias do plano.
- Teste unitario do resolvedor com domingo de descanso, segunda programada,
  terca perdida, plano sem `daysSelected` e fallback.

Aceite: Home e Treino mostram o mesmo treino no mesmo dia; domingo nao mostra
falta; terca perdida aparece como pendente.

### Tarefa 4: tela de treino simples

- Card "Treino de hoje" com CTA antes da ficha.
- Ficha completa atras de "Ver ficha completa".
- Dia de descanso tem CTA secundario "Treinar mesmo assim".
- Concluido hoje usa o total do treino do dia.
- Teste de componente/visual com Playwright mobile.

Aceite: em 390x844 o botao inicia sem rolar a ficha; ficha completa so abre por
acao explicita.

### Tarefa 5: durante e depois do treino

- Seta do topo expande resumo de exercicios; minimizar fica no resumo.
- Cronometro total congela no finalizar; descanso para.
- Conclusao encerra sessao local e mostra resumo antes da rede; persistencia em
  background com outbox.
- Resumo compacto com CTA fixo; RPE/nota opcionais; RewardModal nao abre sozinho.
- Feedback atual e salvo no resumo; sheet so para sessoes antigas.
- Teste: finalizar com rede lenta; resumo aparece; cronometro para; sem duplicar.

Aceite: finalizar duas vezes nao duplica; feedback pode ser pulado; Home mostra
concluido; offline sincroniza depois.

### Tarefa 6: nomes de planos (Bruna)

- Dry-run dos planos ativos com nome de outra aluna.
- Clonar por aluna, copiar dias/exercicios e `slot_checks`, aposentar o antigo,
  ativar a copia; nao renomear o plano da Bruna.
- `assignCopiedPlan` sanitiza `ai_draft.nome` e nomes de outras alunas.
- UI de repetir mostra o nome final por aluna.
- Teste: dry-run lista afetadas; depois, `PersonalWorkouts` nao mostra nome de
  outra aluna.

Aceite: Thalia, Marilia, Juliana, Raquel e Mariana veem o proprio nome; Bruna
continua no plano dela.

### Tarefa 7: verificacao e deploy

- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- `node --experimental-strip-types --test` nos testes do resolvedor.
- `node scripts/verify-workout-db.mjs` no banco.
- Playwright mobile: check-in, treino, iniciar, marcar series, expandir,
  finalizar, pular feedback, Home.
- Deploy Vercel e teste real com aluno de teste descartavel.

## Fora de escopo

- Nao alterar exercicios, series, repeticoes ou ordem do personal.
- Nao criar segunda fonte de agenda.
- Nao criar regra de preco/limite/beneficio.
- Nao ligar aviso automatico de treino concluido.
- Nao mexer em `profiles.vencimento`.
