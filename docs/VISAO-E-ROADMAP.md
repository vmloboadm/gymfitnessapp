# GymFitness: visão e roadmap

> Documento vivo. Toda ideia nova entra na **Caixa de ideias** e sobe para as fases quando for avaliada.
> Status: 💡 ideia · 🔍 avaliar · ✅ pronto pra fazer · 🚧 fazendo · 🟢 no ar

## A visão (03/11/2026)

A ideia original era "a academia dá **treino personalizado** para cada aluno". Na prática isso dependia do
personal trabalhar de graça: em 02/11, 40 dos 54 alunos aprovados estavam sem ficha, e a primeira ficha
levava ~13 dias.

**Reformulação:**

1. **O básico é grátis e instantâneo.** Treinos prontos (AB, ABC, ABCD, ABCDE, masculino e feminino): o
   aluno escolhe e treina no mesmo dia. 🟢
2. **O personalizado é o produto.** Acompanhamento e hora-aula do personal são vendidos **dentro do app**. O
   personal ganha dinheiro com o app em vez de perder tempo nele.
3. **Uma moeda da academia** (fichas/saldo): o aluno carrega dinheiro e compra hora-aula, produto, kit,
   desafio. E **ganha fichas treinando** (check-in, conquistas, streak, recordes = cashback).
4. **Marketplace de parceiros e produtos próprios** (RootsVibe, suplementos, kits).
5. **Desafios pagos com comunidade** (grupo de WhatsApp + coach de IA 24h).
6. **Rede de academias** compartilhando vendedores, infraestrutura e comunidade.

**Em uma frase:** o app não *dá* treino personalizado, ele **vende** treino personalizado, e tudo o mais que
o aluno compra para treinar, numa moeda própria que ele também ganha treinando.

**Posicionamento:** startup de comunidade fitness **phygital**: *"compra no app, vive no presencial"*.
Rede social que monetiza, divulga e tem público, na escala de um Wellhub (ou equivalente), mas nascida dentro
da academia de verdade (Campos dos Goytacazes → RJ → Brasil).

## Fases

| # | Fase | Status | Depende de |
|---|------|--------|-----------|
| 1 | **Vitrine do personal**: planos de acompanhamento no perfil do personal; aluno escolhe e chama no WhatsApp com o plano e o preço | 🚧 | — |
| 2 | **Carteira + Pix com divisão automática**: aluno paga o plano do personal no app; personal recebe direto, academia fica com % | 🔍 | conversa com PagBank |
| 3 | **Fichas/cashback**: conquistas, check-in, streak e recordes creditam fichas (separado dos pontos de ranking), com teto mensal; só valem no ecossistema | 💡 | definir valor da ficha |
| 4 | **Loja da academia**: produtos pagos com saldo/Pix/fichas, retirada na recepção | 💡 | fase 2 |
| 5 | **Maquininha na recepção ligada ao aluno**: QR do app identifica o aluno na compra presencial → cashback | 💡 | PagBank (integração da maquininha) |
| 6 | **Marketplace de parceiros**: evolução de *Benefícios* (hoje cupons); trocar fichas por produtos e kits | 💡 | fase 3 |
| 7 | **RootsVibe**: kits de sachê pré-treino fitoterápico (guaraná, gengibre, beterraba, semente de uva…) com nutri parceira assinando as fórmulas | 💡 | ANVISA, nutri, fornecedor |
| 8 | **Desafios pagos**: inscrição em fichas, grupo de WhatsApp do desafio, coach de IA respondendo 24h | 💡 | fase 3, WhatsApp oficial |
| 9 | **Parcerias com personais e nutris**: perfis de vendedor, agenda, avaliações | 💡 | fase 2 |
| 10 | **Rede multi-academia**: vendedores, parceiros e comunidade compartilhados entre academias | 💡 | base técnica, fases 2–6 |

## Decisões tomadas

- **03/11/2026**: começar pelo mais factível que funcione já (fase 1, sem dinheiro real); registrar o resto.
- **03/11/2026**: pagamento do personal com **divisão automática** (personal recebe direto, academia fica com %).
- **03/11/2026**: meio de pagamento: **PagBank**, via amigo representante (parceiro, pode ajudar na venda).
  **Asaas** só como última opção.
- **03/11/2026**: treinos prontos grátis; aluno não espera o personal para começar.

## Pauta da conversa com o representante PagBank

1. API de **Pix com divisão automática (split)** por recebedor? Como funciona o estorno com split?
2. Cada personal precisa de **conta/cadastro de recebedor**? Pode ser pessoa física (MEI)? Quanto tempo leva?
3. **Taxas**: Pix, cartão de crédito (à vista e parcelado), débito; prazo de recebimento.
4. **Assinatura/recorrência** (plano mensal do personal, mensalidade da academia).
5. **Maquininha integrada ao app**: dá para identificar o aluno na venda presencial (QR, CPF, link de
   pagamento)? Existe API/webhook das vendas da maquininha?
6. **Webhook** de confirmação de pagamento e **sandbox** para teste.
7. **Link de pagamento/checkout** pronto (para começar sem integração profunda).
8. Modelo de **parceria/comissão** do representante e possibilidade de ele ajudar a vender o app para outras academias.

## Riscos a avaliar

- **Saldo pré-pago**: manter como crédito de uso fechado no ecossistema (não sacável, não transferível entre
  pessoas) para não virar arranjo de pagamento regulado pelo Banco Central. Validar com contador/jurídico.
- **Fitoterápicos (RootsVibe)**: regularização na ANVISA, rotulagem, alegações de saúde ("dá energia" etc.),
  nutri responsável técnica.
- **Coach de IA em grupo de WhatsApp**: a integração atual (WAHA) não é oficial e o número pode ser banido;
  avaliar a API oficial do WhatsApp para grupos.
- **LGPD**: dados de compra e de saúde; consentimento para usar em ofertas.
- **Nota fiscal**: da academia e de cada personal/parceiro.
- **Base técnica**: antes de mexer com dinheiro, concluir as etapas 3–4 do reforço (React Query no treino,
  quebrar telas gigantes). Toda regra de saldo com testes de banco e mutação; webhook idempotente.

## Caixa de ideias

> Anote aqui, com data. Depois avaliamos e movemos para as fases.

- 03/11: ranking de quem mais comprou/treinou ganha brinde de parceiro.
- 03/11: personal com selo de avaliação dos alunos (estrelas) na vitrine.
- 03/11: pacote "treino + nutri + kit RootsVibe" em combo.
- _(sua próxima ideia aqui)_
