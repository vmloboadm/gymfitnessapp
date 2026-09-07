# Frente futura: WhatsApp integrado ao app

> Status: PLANEJADA — olhar depois. Não implementar até o número oficial existir.
> Dono: aguardando número WhatsApp oficial da academia.

## Objetivo
Número oficial da GymFitness vinculado ao app, com envios automáticos e manuais
integrados ao fluxo (não só links `wa.me` manuais como hoje).

## Pré-requisitos já prontos no app
- `whatsapp_consent` (LGPD) coletado no onboarding → `profiles.whatsapp_consent`
- Radar de retenção (`computeRadar`) — detecta sumidos 3/7/14+ dias
- `student_subscriptions` — base de mensalidade/vencimento
- Fila do personal + `daysSelected` do plano — gatilhos de mensagem
- Links `wa.me` manuais já usados (StudentSheet, radar, summary)

## Decisões em aberto (na hora de implementar)
1. **Provedor**: Meta WhatsApp Cloud API direto vs. provedor (Evolution API, etc.)
2. **Número**: oficial da academia (recomendado: número dedicado, não pessoal)
3. **Templates Meta**: cadastrar e aprovar modelos (cobrança, win-back, avisos)

## Mensagens planejadas
| Gatilho | Mensagem | Tipo |
|---|---|---|
| Mensalidade a vencer (D-3) | cobrança amigável + valor + Pix | automática |
| Mensalidade vencida | cobrança + link regularização | automática |
| Pagamento confirmado | recibo + incentivo | automática |
| Sumido 3 dias | "sentimos sua falta" leve | automática |
| Sumido 7/14 dias | win-back + oferta de retorno | automática |
| Novo plano atribuído | "seu treino novo chegou no app" | automática |
| Relatório pronto | "sua evolução de 15 dias saiu" | automática |
| Streak 7/30 dias | parabéns + dopamina | automática |
| Lembrete dia de treino | baseado nos `daysSelected` | automática |
| Botão manual do personal | texto livre pré-preenchido | manual (hoje: `wa.me`) |

## Requisitos técnicos (quando for fazer)
- [ ] Variáveis de ambiente: provedor, token, phone_number_id
- [ ] Tabela `whatsapp_outbox` (fila: to, template, params, status, retries, sent_at)
- [ ] Job/cron de disparo + respeito a `whatsapp_consent = true` e opt-out (`STOP`)
- [ ] Logs de envio por aluno (auditoria LGPD)
- [ ] Webhook de respostas → opcional: caixa de entrada no app
- [ ] Webhook de status (entregue/lido/falha) → métricas
- [ ] Tela do gestor: projeção de mensagens do mês + custo estimado
- [ ] Nunca expor conteúdo financeiro a `trainer` (seguir regra da v1.13.0)

## Refinamentos futuros (backlog geral, fora do WhatsApp)
- [ ] Responsável do aluno (campo `student_trainers` como "responsável", sem exclusividade)
- [ ] Histórico de versões do plano visível ao aluno (v1 → v2)
- [ ] Relatório de evolução gerado pelo staff (PDF/compartilhável)
- [ ] Lista real de máquinas da academia (substituir os 37 exemplos `pending`)
- [ ] onboarding: revisar copy dos steps com dados reais de uso
