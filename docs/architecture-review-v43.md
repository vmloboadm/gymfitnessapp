# GymFitness — Revisão Arquitetural Completa (v43)

**Data:** 02/09/2026
**Snapshot:** 13d46bf
**Autor:** Opencode (Mimo v2.5 Free)
**Status:** EXECUÇÃO EM ANDAMENTO

---

## Resumo Executivo

Auditoria holística do GymFitness (Next.js 14 PWA) cobrindo segurança (RLS/API), dados (migração exercises), transacionalidade (RPCs), IA (validação/audit), offline (fila), dashboard (operacional) e visual (polish). Todos os achados classificados por severidade com plano de correção.

---

## P0 — CRÍTICO (Executar imediatamente)

### 1. profiles_update_own: Privilege Escalation

**Problema:** Policy permite UPDATE em todas as colunas, incluindo `role`, `gym_id`, `status`. Um aluno pode se promover a gestor.

**Prova técnica:**
```sql
-- Conectado como aluno (auth.uid() = aluno):
UPDATE profiles SET role = 'manager' WHERE id = auth.uid();
-- Retorna 200 se RLS não restringe colunas
```

**Fix:** Criar RPC `update_profile_own()` que só aceita colunas seguras (name, bio, avatar_url, password_changed_at).

**Migração:**
```sql
CREATE OR REPLACE FUNCTION update_profile_own(
  p_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET name = COALESCE(p_name, name),
      bio = COALESCE(p_bio, bio),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Revoke direto, forçar uso da RPC
REVOKE UPDATE ON profiles FROM authenticated;
GRANT EXECUTE ON FUNCTION update_profile_own TO authenticated;
```

**Verificação:** Testar que UPDATE com role/gym_id retorna erro.

---

### 2. APIs sem Autenticação

**Problema:** `/api/assistente` e `/api/coach` não validam JWT. Qualquer um pode chamar.

**Prova técnica:**
```bash
# Sem header Authorization:
curl -X POST http://localhost:3002/api/assistente \
  -H "Content-Type: application/json" \
  -d '{"prompt":"teste","mode":"aluno"}'
# Retorna 200 com resposta da IA
```

**Fix:** Middleware de auth em cada rota:
```typescript
// src/lib/auth-guard.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function requireAuth() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return session;
}
```

**Aplicar em:**
- `src/app/api/assistente/route.ts` — adicionar `await requireAuth()` no início
- `src/app/api/coach/route.ts` — idem

---

### 3. Migração 289 Exercises → Supabase Real

**Problema:** Tabela `exercises` do gym real está vazia (0 registros com gym_id real). Os 289 exercícios são hardcoded em `demoLib`.

**Prova técnica:**
```sql
SELECT count(*) FROM exercises WHERE gym_id = '00000000-0000-0000-0000-000000000001';
-- Retorna 0
```

**Fix:** Criar migration `002_seed_exercises.sql` com INSERT dos 289 exercises.

**Script:** Usar `gym-api.ts` → `seedExercises()` que lê `demoLib` e faz upsert.

---

### 4. assign_workout_plan(): RPC Transacional

**Problema:** Criação de plano não é atômica — dados órfãos se falhar no meio.

**Fix:**
```sql
CREATE OR REPLACE FUNCTION assign_workout_plan(
  p_student_id UUID,
  p_trainer_id UUID,
  p_plan JSONB,
  p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Verificar vínculo
  IF NOT EXISTS (
    SELECT 1 FROM student_trainers
    WHERE student_id = p_student_id AND trainer_id = p_trainer_id
  ) THEN
    RAISE EXCEPTION 'No trainer-student relationship';
  END IF;

  -- Inserir plano
  INSERT INTO workout_plans (student_id, trainer_id, ai_draft, start_date, status)
  VALUES (p_student_id, p_trainer_id, p_plan, p_start_date, 'assigned')
  RETURNING id INTO v_plan_id;

  -- Inserir workout_logs (um por dia)
  INSERT INTO workout_logs (student_id, plan_id, scheduled_date)
  SELECT p_student_id, v_plan_id,
         (p_start_date + (d.value::int - 1))::date
  FROM jsonb_array_elements_text(p_plan->'days') AS d;

  RETURN v_plan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_workout_plan TO authenticated;
```

---

## P1 — ALTO (Executar depois)

### 5. Fila Offline: Reescrita

**Problema:** `sync/route.ts` retorna `200` para todos os IDs, listener limpa fila inteira. Ações que falharam são perdidas.

**Fix:**
- Resposta `{ synced: string[], failed: { id: string, error: string }[] }`
- Backoff exponencial por item
- Dead-letter queue para 3+ falhas
- Idempotência: chave `action_id` (UUID por ação)

### 6. Validação Runtime do JSON da IA

**Problema:** Modelo pode retornar JSON inválido → crash no parse.

**Fix:**
```typescript
// lib/ai/validate.ts
import { z } from 'zod';

const WorkoutPlanSchema = z.object({
  name: z.string().min(1),
  days: z.array(z.object({
    exercises: z.array(z.object({
      name: z.string(),
      sets: z.number().min(1).max(20),
      reps: z.string(),
      rest: z.string(),
      rpe: z.number().min(1).max(10)
    }))
  }))
});

export function validateWorkoutPlan(data: unknown) {
  return WorkoutPlanSchema.safeParse(data);
}
```

### 7. Audit de IA

**Fix:** Tabela `ai_audit_logs`:
```sql
CREATE TABLE ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  purpose TEXT NOT NULL,
  model_used TEXT NOT NULL,
  tokens_in INT,
  tokens_out INT,
  latency_ms INT,
  success BOOLEAN DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## P2 — MÉDIO

### 8. Dashboard Operacional
- Gráfico de frequência semanal (Recharts)
- Comparativos temporais (vs semana anterior)
- Indicador de resposta do Co-Pilot

### 9. Testes RLS
- Script positivo/negativo
- Cross-tenant isolation
- Suite automatizada

### 10. Visual Polish
- Aplicar skills `frontend-perfection`, `data-density-dashboard`
- Microinterações, empty states, loading skeletons

---

## Snapshot de Verificação

| Check | Status |
|-------|--------|
| Smoke produção 8/8 | OK |
| Rotas 17/17 | OK |
| Zero JS errors | OK |
| Túnel ativo | OK |
| Login real funciona | OK |
| Treino principal do aluno | OK |
| Atribuição funciona | OK |

---

## Plano de Execução

| Fase | Itens | Prioridade |
|------|-------|------------|
| Fase 1 | #1 profiles RPC, #2 auth APIs, #3 exercises migration, #4 assign RPC | P0 |
| Fase 2 | #5 fila offline, #6 validação IA, #7 audit | P1 |
| Fase 3 | #8 dashboard, #9 RLS tests, #10 visual | P2 |
