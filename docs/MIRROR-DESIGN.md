# Ticket 9 — Design do espelho (VERSÃO SIMPLIFICADA)

> Decisão: sem captura de câmera (`getUserMedia` removido do escopo).
> Motivo: câmera frontal se comporta diferente em iPhone vs Android vs
> navegador vs app instalado — risco alto, retorno baixo nesta fase.
> O marketing grátis funciona igual com cartão compartilhável.

## O que o aluno vê em `/mirror`

Cartão estilo "post" (fundo escuro + borda laranja da marca):

```
┌─────────────────────────────────┐
│  ● GymFitness Campos      12:40 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │   💪 TREINEI HOJE         │  │
│  │   3x esta semana          │  │
│  │   55 min · 320 kcal*      │  │
│  │                           │  │
│  └───────────────────────────┘  │
│  ♡ 124   💬 18    #GymFitness   │
│  [Compartilhar]  [Copiar texto] │
└─────────────────────────────────┘
```

\* kcal = estimativa (min × 6), marcada como estimativa.

## Dados (tudo já existe no app, nada novo no banco)

| Campo | Fonte |
|-------|-------|
| Nome do aluno | `profiles.name` (useAuth) |
| Treinos na semana | `workout_sessions` (completed, últimos 7 dias) |
| Tempo de hoje | `workout_sessions` / `equipment_sessions` de hoje |
| Hashtag | fixa `#GymFitnessCampos` |

## Compartilhar (sem câmera)

1. **Web Share API** (`navigator.share`) — abre o sheet nativo
   (WhatsApp, Instagram, etc.). Funciona em iPhone Safari e Android Chrome.
2. **Fallback**: copia o texto (`navigator.clipboard`) + toast
   "Texto copiado! Cole no Instagram/WhatsApp."
3. O aluno tira a **selfie no espelho físico** com o próprio celular
   e cola o texto do app na legenda — zero dependência de API de câmera.

## Parte física (fora do app, na academia)

- Adesivo/moldura no espelho com: logo + `#GymFitnessCampos` + QR
  apontando para `/mirror` (o QR abre o cartão pronto pra compartilhar).
- Custo: 1 impressão. Sem eletrônica, sem tablet no espelho.

## Teste (Ticket 10)

- E2E headless: cartão renderiza, dados carregam, botão existe.
- **Teste físico iPhone + Android: PENDENTE DO USUÁRIO** (não há
  celular físico neste ambiente). O ticket 10 será reportado como
  "implementado, aguardando validação física" — sem câmera envolvida,
  o risco residual é só visual (layout em tela pequena).
