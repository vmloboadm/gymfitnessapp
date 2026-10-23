# WhatsApp com IA na GymFitness Campos — desenho

Data: 23/10/2026
Status: aguardando aprovação do Vini

## 1. Contexto

O app já tem um número oficial da academia cadastrado para links manuais
(`(22) 99778-7186`), mas hoje ele só serve para abrir o WhatsApp com uma
mensagem pronta. Quem responde é uma pessoa, quando consegue.

O Deskcomm já roda na nossa VPS com o motor de WhatsApp (WAHA), agente de IA,
base de conhecimento, transferência para humano e pausa automática da IA quando
uma pessoa responde pelo celular.

O celular do número fica na academia, em geral com o Claudeir, às vezes com a
Rebeca, e também toca a playlist. Ninguém vai atender pelo CRM. Quem responde
no dia a dia é a IA; uma pessoa entra só quando necessário, pelo próprio
WhatsApp do celular.

## 2. Objetivos

1. Conectar o número oficial da academia ao Deskcomm como aparelho vinculado,
   sem tirar o celular do uso normal.
2. IA respondendo 24 horas por dia o atendimento padrão: horário, planos,
   modalidades, endereço e aula experimental.
3. Transferir para uma pessoa quando a conversa sair do padrão, com a pessoa
   respondendo pelo celular.
4. A IA pausar sozinha quando a pessoa responder, sem resposta duplicada.
5. Trazer o contato para perto: pedir o nome, entender o objetivo e oferecer
   aula experimental.
6. Avisar a equipe no app quando precisar de uma pessoa, sem depender do CRM.
7. No app do aluno: atalho para falar no WhatsApp e, para quem já é aluno,
   agendar aula experimental das modalidades pelo app.

## 3. Não objetivos

- Ninguém atende pelo CRM. Não vamos construir caixa de entrada no Deskcomm
  nem treinar a equipe para usar a interface dele.
- A IA não fecha pagamento, não matricula e não emite cobrança.
- A IA não dá conselho médico, diagnóstico, orientação de lesão ou promessa de
  resultado.
- A IA não expõe dado de um aluno para outra pessoa.
- Não haverá disparo em massa nesta fase. Só atendimento de quem chega.
- O chat interno do app (aluno com staff) continua como é, separado do WhatsApp.

## 4. Anti-objetivos

Falha é:

- a IA responder por cima de uma pessoa que assumiu;
- a IA inventar preço, horário ou modalidade;
- o cliente pedir ajuda e ninguém ficar sabendo;
- o número cair e a equipe só descobrir pelo cliente;
- mensagem automática incomodando aluno fora de contexto.

## 5. Restrições

- Número existente: `(22) 99778-7186`. Entra como dispositivo vinculado, o
  celular continua funcionando.
- WAHA e Deskcomm já rodam na VPS; cada organização tem a sua sessão de
  WhatsApp.
- O app é Next.js na Vercel com Supabase próprio. Não tem servidor persistente;
  por isso a fase 1 não depende de webhook. Se a fase 3 precisar receber
  evento, será por rota pública com validação de assinatura.
- LGPD: usar `profiles.whatsapp_consent`, respeitar pedido de parada e não
  guardar dado sensível na conversa.
- As modalidades novas têm previsão para 20/11. A IA deve dizer "previsão", não
  "a partir do dia 20 já tem".
- O plano chamado "embarcado" precisa de confirmação do que é antes de entrar
  na base.

## 6. Abordagens consideradas

### 6.1 Tudo no Deskcomm

Número, IA, base e atendimento humano dentro do Deskcomm.

- Bom: entrega mais rápida, usa tudo que já existe.
- Ruim: a conversa não nasce no app, e a equipe teria que usar o CRM. Foi
  descartado pelo Vini.

### 6.2 Tudo no app

Construir a IA, a base e a caixa de entrada dentro do app, usando o Deskcomm só
como conexão do WhatsApp.

- Bom: controle total e dado do aluno à mão.
- Ruim: duplica motor de IA, handoff e histórico que já existem; muito mais
  tempo e risco. Descartado.

### 6.3 Híbrido (escolhido)

O Deskcomm é o motor: conecta o número, roda a IA, guarda a base e faz a
transferência. O app fica com o que é do aluno: atalho para o WhatsApp,
agendamento de experimental e aviso para a equipe.

- Bom: entrega rápido, não joga trabalho fora e a equipe continua no WhatsApp.
- Ruim: existem duas casas (app e Deskcomm), então a operação precisa de um
  checklist claro de quem é dono de quê.

Ajuste decidido pelo Vini: ninguém atende pelo CRM. O Deskcomm é motor e canal,
não tela de atendimento.

## 7. Arquitetura

```
Cliente no WhatsApp
      |
      v
Número (22) 99778-7186  ->  WAHA / Deskcomm  ->  Agente de IA + base
                                    |
                                    |  humano responde pelo celular
                                    v
                          Deskcomm pausa a IA (60 min, renovando)
                                    |
                                    |  precisa de humano
                                    v
                 aviso de caso no WhatsApp  ->  celular do Claudeir/Rebeca
                                    |
                                    v
                 Claudeir/Rebeca respondem pelo número oficial

Aluno logado no app  ->  pedido de aula experimental  ->  staff confirma
```

Peças:

- **Organização "GymFitness Campos" no Deskcomm**, separada da MahaFlow e da
  i9BASE, para não misturar aluno com lead de outro negócio.
- **Canal de WhatsApp** com o número oficial.
- **Base de conhecimento** versionada com os dados da seção 8.
- **Agente** com a persona e as regras da seção 9.
- **Aviso de caso** do Deskcomm, que já existe: quando a IA transfere, o
  Deskcomm manda uma mensagem de WhatsApp para um número configurado da equipe,
  com resumo, motivo e última mensagem do cliente. Não exige alterar o
  Deskcomm.
- **App**: links para o número oficial e, na fase 2, tela de agendamento de
  experimental.

Não vamos alterar o núcleo do Deskcomm nesta fase. Usamos o que já está
publicado e testado, para não colocar em risco a MahaFlow e a i9BASE, que rodam
na mesma instalação.

## 8. Base de conhecimento

### 8.1 Horários

- Segunda a sexta: 5h às 22h
- Sábado: 8h às 13h
- Domingo: 9h às 13h

### 8.2 Planos

| Plano | Valor |
|---|---|
| Mensal | R$ 109,90 |
| Família (2 ou mais parentes) | R$ 99,90 por pessoa |
| 3x na semana ou embarcado | R$ 89,90 |
| Trimestral | R$ 89,90 por mês (R$ 269,00 os 3 meses) |
| Diária | R$ 20,00 |
| Personal + academia 3x na semana | R$ 399,00 por mês |
| Personal + academia 5x na semana | R$ 499,00 por mês |

Pendente: o que é o plano "embarcado" e quais formas de pagamento a academia
aceita. Sem isso, a IA não deve citar o "embarcado" nem prometer forma de
pagamento.

### 8.3 Modalidades

- Hoje: musculação.
- Previsão para 20/11: dança, funcional, localizada, hit boxe, ballet infantil,
  artes marciais e funcional kids.
- Funcional kids também para quem já treina e tem filho, para não precisar
  deixar a criança em casa.

### 8.4 Aula experimental

- Quem ainda não é aluno: experimental na recepção ou pelo WhatsApp, com a
  recepção confirmando o horário.
- Quem já é aluno e usa o app: agenda a experimental de modalidade pelo app.
- A IA nunca confirma horário sozinha. Ela coleta nome, objetivo e melhor
  horário, e diz que a recepção confirma.

### 8.5 Endereço e contato

Pendente: endereço completo, ponto de referência e formas de pagamento. A IA
não deve improvisar.

## 9. Comportamento do agente

- Português do Brasil, acolhedor, direto, sem gíria forçada, sem emoji em
  excesso.
- Se apresenta como atendimento da GymFitness.
- Responde a dúvida, confirma o entendimento e convida para a experimental.
- Pergunta o nome cedo e usa o nome depois.
- Pergunta o objetivo (emagrecer, ganhar massa, saúde, condicionamento).
- Pergunta o melhor horário para a experimental.
- Sempre deixa a porta aberta para falar com uma pessoa.
- Se a resposta não estiver na base, não inventa: transfere.
- Não promete preço diferente da tabela, desconto, vaga garantida ou resultado.
- Não dá orientação de treino, dieta ou saúde.
- Se a pessoa pedir para parar, para e registra.

Fluxo base:

1. Saudação e identificação.
2. Entender o que a pessoa quer.
3. Responder com a base.
4. Convidar para a experimental.
5. Pegar nome, objetivo e melhor horário.
6. Dizer que a recepção confirma.
7. Encerrar cordial, sem insistência.

## 10. Transferência para humano

Gatilhos:

- pedido explícito de falar com uma pessoa;
- reclamação, cancelamento ou pedido de reembolso;
- negociação de preço ou desconto;
- assunto de saúde, lesão ou medicação;
- assunto jurídico ou agressividade;
- dúvida que não está na base;
- duas tentativas sem resolver.

Mecânica:

1. A IA avisa o cliente que chamou a equipe.
2. O Deskcomm registra a passagem com motivo e resumo.
3. O Deskcomm manda o aviso de caso por WhatsApp para o número configurado da
   equipe, com nome, motivo e última mensagem.
4. A pessoa responde pelo número oficial, do celular da academia ou de um
   WhatsApp Web vinculado ao mesmo número.
5. O Deskcomm pausa a IA por 60 minutos naquela conversa, renovando a cada
   mensagem humana.
6. Se ninguém responder, a IA volta depois do prazo, sem falar por cima.

Ponto importante: a resposta precisa sair do número oficial. Se a pessoa
responder do WhatsApp pessoal, a IA não pausa e o cliente passa a falar em
outro número. Para atender de fora da academia, a saída é manter um WhatsApp
Web vinculado ao número oficial num computador.

Fora do horário de funcionamento, a IA não promete resposta imediata: diz que
a recepção confirma no próximo horário de atendimento. O aviso continua sendo
enviado, mas a equipe responde quando abrir.

O aviso de caso do Deskcomm tem um destino por organização. Precisamos escolher
o número principal (Claudeir ou Rebeca). O outro pode ser avisado pelo app numa
fase seguinte.

## 11. Integração com o app

### Fase 1 — MVP (atendimento no ar)

- Criar a organização da academia no Deskcomm.
- Conectar o número como aparelho vinculado (QR, com o celular em mãos).
- Publicar a base e o agente.
- Configurar o aviso de caso para o número principal da equipe.
- Subir com o gate da IA em allowlist (só os números de teste da equipe) e
  abrir para todos depois da bateria de testes.
- Ajustar os textos e links do app para o número oficial.
- Checklist de operação: reconexão do WhatsApp, atualização de preço, teste de
  base, quem faz o quê.

### Fase 2 — agendamento de modalidades no app (até 20/11)

- Catálogo de modalidades e horários.
- Tela "Agende sua aula de modalidades" para o aluno logado.
- Pedido cai para o staff confirmar, com aviso no app.
- Regra de capacidade por horário, para não lotar.
- Card no feed ou no treino divulgando a novidade.

### Fase 3 — disparos automáticos e relatório

- Mensagens disparadas por evento do app via API do Deskcomm: treino
  publicado, check-in, retorno ao cadastro.
- Opt-in, limite por pessoa e horário permitido.
- Relatório de atendimento: volume, motivos, quantos viraram experimental,
  quantos precisaram de humano.

## 12. Dados e LGPD

- Usar `whatsapp_consent` como base para qualquer envio ativo.
- Respeitar "pare", "não quero mais" e similares.
- A IA não pede nem usa dado de saúde. Se a pessoa contar por conta própria, a
  conversa é transferida e o conteúdo fica no histórico sob a retenção padrão;
  o resumo que chega para a equipe não repete detalhe clínico.
- Não expor valor ou plano de um aluno para outra pessoa.
- Guardar o mínimo no app: telefone, nome, motivo da transferência e status.
- Retenção padrão do Deskcomm para histórico; exportação e exclusão a pedido.
- A sincronização do opt-out do WhatsApp com `whatsapp_consent` fica para a
  fase 3, quando existirem envios ativos do app.

## 13. Riscos

| Risco | Mitigação |
|---|---|
| Número bloqueado por spam | Fase 1 só responde quem chega; nada de lista fria |
| IA inventar preço | Base versionada, teste com perguntas reais antes de publicar |
| IA responder por cima do humano | Pausa automática do Deskcomm, validada em teste |
| Pessoa responder do número pessoal | Regra de operação: responder só pelo número oficial; WhatsApp Web vinculado num computador |
| Celular sem internet | WhatsApp vinculado segue funcionando por um período; checklist de reconexão |
| Cliente sem resposta | Aviso de caso no WhatsApp com resumo e motivo |
| Custo de IA | Monitorar volume e custo por conversa na fase 1 |

## 14. Critérios de sucesso

- Pelo menos 90% das perguntas padrão resolvidas sem pessoa, em uma amostra de
  50 conversas reais.
- Zero resposta da IA depois de uma pessoa assumir.
- Primeira resposta em menos de 10 segundos.
- Toda transferência com notificação registrada no app.
- Nenhum preço ou horário errado em auditoria semanal da base.

## 15. Decisões que dependem do Vini

1. O número oficial é `(22) 99778-7186`? Quem pode escanear o QR (Claudeir,
   Rebeca ou os dois)?
2. Endereço completo e formas de pagamento aceitas.
3. O que é o plano "embarcado".
4. Quem é o destino principal do aviso de transferência? O Deskcomm manda para
   um número por organização.
5. A atendente virtual tem nome próprio ou assina "atendimento GymFitness"?
6. A IA pode negociar desconto? Proposta: não, transfere.
7. A IA pode matricular ou só agendar experimental? Proposta: só agendar.
8. Quem responde quando precisa de uma pessoa: só do celular da academia ou
   também de um WhatsApp Web vinculado ao número oficial num computador?
9. O número recebe conversa pessoal, de fornecedor ou grupo? A IA pode
   responder todo mundo ou só contatos que não são da equipe?
10. Quem opera o Deskcomm depois do go-live (reconectar o WhatsApp, atualizar
    preço, acompanhar aviso que ninguém respondeu)?
11. Para a fase 2: horários e capacidade de cada modalidade, e se o aluno pode
    agendar para um filho ou só para ele.

### 15.1 Decisões que eu tomei (confira)

- **Fase 1 sem registro novo de lead no app.** O contato e a conversa ficam no
  Deskcomm, que já é o CRM. O pedido de experimental com status e confirmação
  entra na fase 2, junto com o agendamento.
- **Fase 2 só para o titular da conta.** Criança (funcional kids, ballet) é
  agendada pela recepção, para não criar cadastro de dependente e consentimento
  de menor agora.
- **Fora do horário**, a IA não promete pessoa na hora. Diz que a recepção
  confirma quando abrir.
- **Go-live controlado**: o canal sobe com o gate da IA em allowlist, testa com
  os números da equipe e só depois abre para o público.

## 16. Em aberto para quem for construir

- Modelo de dados de modalidade, horário e pedido de experimental.
- Se a configuração do agente será pela interface do Deskcomm ou por API.
- Como medir custo por conversa.
- Formato exato do aviso de caso e como o resumo é montado.
