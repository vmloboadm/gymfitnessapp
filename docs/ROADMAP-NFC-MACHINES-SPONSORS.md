# Frente: Máquinas + NFC + Patrocinadores

> Status: EM ANDAMENTO (fundação) + aguardando listagem do usuário.
> v1.14.0: sponsors + detalhe da máquina + histórico + entrada libera treino.

## 1. Listagem de maquinário (USUÁRIO VAI ENVIAR)
Quando a lista chegar, cadastrar via migration seed com:
- número/identificação do aparelho (ex.: `LEG-01`)
- nome oficial + categoria
- exercícios possíveis em cada aparelho
- `nfc_tag_url` / `qr_url` programados no chip físico

Template para a listagem (uma linha por aparelho):
```
numero | nome | categoria | exercicios (separados por ;) | observacao
LEG-01 | Leg press 45° | perna | Agachamento no leg press; Leg press pés altos; Panturrilha no leg press |
EST-01 | Esteira 1 | cardio | Caminhada; Corrida; Sprint | -
```

## 2. NFC / QR Code (fluxo já funciona, só apontar as tags)
- Tag física grava a URL: `https://gymfitnessapp-delta.vercel.app/app/checkin?maquina=<ID-ou-slug>`
- iPhone lê em segundo plano e abre o link; Android idem
- App reconhece por: `id`, `nfc_tag_url`, `qr_url` ou slug do nome
- `?maquina=entrada` = TAG DA ENTRADA → check-in de presença + **treino do dia liberado** (redirect `/treino`)
- Ao escanear aparelho: abre sessão do equipamento (`equipment_sessions`)
- Migração futura: gravar `nfc_tag_url` real de cada chip após a listagem

## 3. Biblioteca de máquinas (implementado v1.14.0)
- Rota `/maquina/[id]`: foto/nome/status + exercícios que usam o aparelho
  (via `exercises.equipment_id` + `equipment_variations`)
- Cada chip de exercício leva à máquina e vice-versa
- **Histórico por aparelho**: tempo, distância (cardio), carga, nota
  (salvo em `equipment_sessions.meta` + `workout_logs` quando aplicável)
- "Adicionar meu histórico de hoje" (opcional): ex. esteira → tempo + km

## 4. Patrocinadores (implementado v1.14.0)
- Tabela `sponsors` (global `gym_id=NULL` + por gym): nome, logo, desconto,
  valor mínimo, CTA (cupom/WhatsApp), ativo, ordem
- Página `/beneficios`: cards globais com botão **"Sou aluno GymFitness"**
  (mostra cupom ou abre WhatsApp do parceiro com mensagem pronta)
- Gestor cadastra edita e pausa parceiros direto na página
- Exemplos: "15% acima de R$ X" — texto livre por parceiro

## 5. Integrações com o que já funciona
- Sessão de aparelho alimenta presença (`Na academia agora`, dashboard gestor)
- Histórico da máquina aparece no Diário do progresso
- Check-in de entrada conta presença + streak
- Coach pode responder "como usar a máquina X" (biblioteca como contexto — futuro)
- Pendentes de verificação (37 exemplos) saem quando a lista real chegar
