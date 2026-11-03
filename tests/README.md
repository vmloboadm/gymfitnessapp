# Testes

| Comando | O que roda | Onde |
|---|---|---|
| `npm test` | Regras do app em TypeScript (streak de reserva, datas de São Paulo, sessão de treino, fila offline, dia de treino). Sem rede, ~1s. | Também roda **dentro do build da Vercel**: se falhar, o deploy para e a versão anterior continua no ar. |
| `npm run test:db` | Regras do banco (check-in, fechamento em 3h, `day_streak` com reposição, conquistas, ranking) num Postgres 17 no Docker com o esquema de produção. | Só na VPS (precisa de Docker). |
| `npm run test:all` | `tsc` + os dois acima. | **Rodar antes de todo push no main.** |
| `npm run test:db:snapshot -- 0NN` | Atualiza `supabase/test/` a partir de produção (estrutura, catálogo de conquistas e biblioteca global de exercícios; nenhum dado de aluno). `0NN` = última migration aplicada em produção. | Depois de aplicar migration nova em produção. |

## Migration nova

1. Escreva `supabase/migrations/0NN_*.sql` e um teste em `tests/db/` que falhe sem ela.
2. `npm run test:db` — migrations com número maior que `supabase/test/SNAPSHOT_MIGRATION` são aplicadas por cima do esquema automaticamente.
3. Verde → aplica em produção → `npm run test:db:snapshot -- 0NN`.

## Como os testes são escritos

- `tests/unit/*.test.mts`: `node:test`, relógio fixo com `mock.timers` (quarta 04/11/2026, 10h SP). Imports `~/` funcionam como no Next (`tests/setup/`).
- `tests/db/*.test.mts`: cada teste roda numa transação com ROLLBACK (`withTx`). `h.as(id)` faz o papel do usuário logado (`auth.uid()`). Como `day_streak` usa `now()` de verdade, os cenários são montados em dias relativos a hoje.
- Todo teste foi conferido quebrando a regra de propósito e vendo o teste falhar.
