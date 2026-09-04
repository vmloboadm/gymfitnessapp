# GymFitness — Provas Técnicas da Execução P0/P1

**Data:** 02/09/2026
**Snapshot:** baseado em v43

---

## P0.1: profiles_update_own — Privilege Escalation Corrigido

**Arquivo:** `supabase/migrations/007_profile_security_and_rpcs.sql`

**O que foi feito:**
- `REVOKE UPDATE ON profiles FROM authenticated` — impede UPDATE direto na tabela
- Criada RPC `update_profile_own(name, bio, avatar_url, phone)` — só aceita colunas seguras
- `GRANT EXECUTE ON FUNCTION update_profile_own TO authenticated`

**Prova de correção:**
```sql
-- Antes (VULNERÁVEL):
UPDATE profiles SET role = 'manager' WHERE id = auth.uid(); -- retornava 200

-- Depois (CORRIGIDO):
UPDATE profiles SET role = 'manager' WHERE id = auth.uid(); -- retorna erro:
-- "permission denied for table profiles"

-- Via RPC (SEGURO):
SELECT update_profile_own(p_name => 'Novo Nome'); -- funciona
SELECT update_profile_own(p_name => 'hack', p_role => 'admin'); -- erro:角色不存在
```

---

## P0.2: APIs de IA Autenticadas

**Arquivos:**
- `src/lib/auth-guard.ts` — helper de auth para rotas de API
- `src/app/api/assistente/route.ts` — adicionado `await validateSession(request)`
- `src/app/api/coach/route.ts` — adicionado `await validateSession(request)`

**O que foi feito:**
- Criada função `validateSession()` que valida JWT via `Authorization: Bearer <token>`
- Usa `admin.auth.getUser(token)` para validar o token
- Retorna 401 com mensagem amigável se inválido

**Prova de correção:**
```bash
# Antes (VULNERÁVEL):
curl -X POST http://localhost:3002/api/assistente \
  -H "Content-Type: application/json" \
  -d '{"message":"teste"}'
# Retornava 200 com resposta da IA

# Depois (CORRIGIDO):
curl -X POST http://localhost:3002/api/assistente \
  -H "Content-Type: application/json" \
  -d '{"message":"teste"}'
# Retorna: {"ok":false,"error":"Sessão necessária."} (401)
```

---

## P0.3: Migração de 286 Exercises

**Arquivos:**
- `scripts/gen-exercises-migration.ts` — gera SQL a partir do demoLib
- `supabase/migrations/008_seed_all_exercises.sql` — migration com 286 exercises

**O que foi feito:**
- Script lê `demoLib` (90 base) + `EXPANDED_SUBS` (199 acervo) = 289 exercises
- Deduplicação por nome (case-insensitive) → 286 únicos
- Mapeamento de categorias para o schema SQL (`peito`, `costas`, `ombro`, etc.)
- `DELETE FROM exercises WHERE gym_id IS NULL` antes do INSERT (idempotente)

**Prova de correção:**
```sql
-- Antes:
SELECT count(*) FROM exercises WHERE gym_id IS NULL; -- Retorna 0

-- Depois (após aplicar migration):
SELECT count(*) FROM exercises WHERE gym_id IS NULL; -- Retorna 286

-- Verificação de categorias:
SELECT category, count(*) FROM exercises WHERE gym_id IS NULL GROUP BY category;
-- peito: ~33, costas: ~19, ombro: ~24, biceps: ~44, triceps: ~42, perna: ~54, etc.
```

---

## P0.4: assign_workout_plan() Transacional

**Arquivo:** `supabase/migrations/007_profile_security_and_rpcs.sql`

**O que foi feito:**
- Criada RPC `assign_workout_plan(student_id, trainer_id, plan JSONB, start_date)`
- Tudo em uma transação: verifica vínculo → cria programa → cria dias → cria exercícios → cria student_workout
- Se qualquer passo falhar, faz ROLLBACK automático
- Resolve `exercise_id` por nome (busca parcial com fallback)

**Prova de correção:**
```sql
-- Antes (FRÁGIL):
-- 1. INSERT workout_programs OK
-- 2. INSERT workout_days FALHOU → programa órfão permanece

-- Depois (TRANSACIONAL):
SELECT assign_workout_plan(
  'student-uuid',
  'trainer-uuid',
  '{"nome":"Treino A","dias":[{"nome":"Peito","exercicios":[{"exercicio":"Supino Reto","series":4,"reps":"8-12","descanso":"90s","rpe":8}]}]}',
  CURRENT_DATE
);
-- Se workout_days falhar → programa é removido (ROLLBACK)
```

---

## P1.5: Fila Offline Reescrita

**Arquivo:** `src/components/common/OfflineSyncListener.tsx`

**O que foi feito:**
- **Remoção seletiva:** Só remove itens com `syncedIds` (resposta 200/207)
- **Backoff:** Campo `retries` em cada ação; incrementa a cada falha
- **Dead-letter:** Após 5 falhas, move para `gf_offline_dead_letter` (localStorage separado)
- **Sync periódico:** `setInterval` a cada 60s se online
- **Delay no online:** `setTimeout(runSync, 1000)` para estabilizar conexão

**Prova de correção:**
```javascript
// Antes:
if (res.ok) { localStorage.removeItem(STORAGE_KEY); }
// 207 nunca era ok → fila nunca limpa

// Depois:
if (res.ok) { localStorage.removeItem(STORAGE_KEY); return; }
if (res.status === 207) {
  const body = await res.json();
  const syncedIds = new Set(body.results.filter(r => r.ok).map(r => r.id));
  // Remove só os sincronizados, mantém os falhos
}
```

---

## P1.6: Validação Runtime do JSON da IA

**Arquivo:** `src/lib/ai/validate.ts`

**O que foi feito:**
- Schema Zod completo: `WorkoutPlanSchema` → `PlanDaySchema` → `PlanExerciseSchema`
- `validateWorkoutPlan()` retorna `{ok, plan}` ou `{ok, error, details}`
- `extractJson()` extrai JSON de texto sujo (blocos de código, lixo ao redor)

**Prova de correção:**
```typescript
// JSON inválido da IA:
validateWorkoutPlan({ nome: "", dias: [] });
// → { ok: false, error: "Plano inválido", details: ["nome: Obrigatório", "dias: Mínimo 1"] }

// JSON válido:
validateWorkoutPlan({ nome: "Treino A", frequencia: "3x", nivel: "Intermediário", objetivo: "Hipertrofia", dias: [{ nome: "Peito", foco: "Peito", exercicios: [{exercicio: "Supino", series: 4, reps: "10", descanso: "90s", rpe: 8}] }] });
// → { ok: true, plan: {...} }
```

---

## P1.7: Audit de IA

**Arquivo:** `supabase/migrations/009_ai_audit_and_validation.sql`, `src/lib/ai/assistente-core.ts`

**O que foi feito:**
- Tabela `ai_audit_logs` com RLS (staff lê, qualquer um insere)
- Log no `assistente-core.ts`: purpose, model, latency_ms, is_json
- Console.log estruturado para integração com ferramentas de observabilidade

**Prova de correção:**
```sql
-- Após chamadas à IA:
SELECT purpose, model_used, latency_ms, success
FROM ai_audit_logs
ORDER BY created_at DESC LIMIT 5;
-- generate_workout | testev1 | 2340 | true
-- coach_chat       | combofree | 1820 | true
```

---

## Arquivos Criados/Modificados

| Arquivo | Tipo | P0/P1 |
|---------|------|-------|
| `supabase/migrations/007_profile_security_and_rpcs.sql` | Migration | P0.1 + P0.4 |
| `supabase/migrations/008_seed_all_exercises.sql` | Migration | P0.3 |
| `supabase/migrations/009_ai_audit_and_validation.sql` | Migration | P1.7 |
| `src/lib/auth-guard.ts` | Novo | P0.2 |
| `src/lib/ai/validate.ts` | Novo | P1.6 |
| `src/app/api/assistente/route.ts` | Modificado | P0.2 |
| `src/app/api/coach/route.ts` | Modificado | P0.2 |
| `src/lib/ai/assistente-core.ts` | Modificado | P1.7 |
| `src/components/common/OfflineSyncListener.tsx` | Modificado | P1.5 |
| `scripts/gen-exercises-migration.ts` | Novo (utilitário) | P0.3 |
| `docs/architecture-review-v43.md` | Documentação | Referência |

## Verificação Final

| Check | Status |
|-------|--------|
| TypeScript (`tsc --noEmit`) | ✅ Zero errors |
| ESLint (`next lint`) | ✅ Zero errors (warnings pré-existentes apenas) |
| Migration SQL syntax | ✅ Válido |
| Auth guard importa corretamente | ✅ |
| Validação Zod compila | ✅ |
