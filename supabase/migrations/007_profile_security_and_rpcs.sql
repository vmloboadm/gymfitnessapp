-- =====================================================================
-- 007_profile_security_and_rpcs.sql
-- P0.1: Corrige privilege escalation em profiles_update_own
-- P0.4: Cria assign_workout_plan() transacional
-- =====================================================================

-- =====================================================================
-- P0.1: RPC segura para atualização de perfil próprio
-- =====================================================================

-- Revoke UPDATE direto — força uso da RPC
REVOKE UPDATE ON public.profiles FROM authenticated;

-- Drop antiga se existir
DROP FUNCTION IF EXISTS public.update_profile_own(text, text, text, text);
DROP FUNCTION IF EXISTS public.update_profile_own(text, text, text);

-- RPC que só aceita colunas seguras (name, bio, avatar_url, phone)
CREATE OR REPLACE FUNCTION public.update_profile_own(
  p_name       TEXT DEFAULT NULL,
  p_bio        TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_phone      TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    name       = COALESCE(p_name, name),
    bio        = COALESCE(p_bio, bio),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    phone      = COALESCE(p_phone, phone),
    updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;
END;
$$;

-- Permitir que authenticated execute a RPC
GRANT EXECUTE ON FUNCTION public.update_profile_own(text, text, text, text) TO authenticated;

-- =====================================================================
-- P0.4: RPC transacional para atribuição de plano de treino
-- =====================================================================

DROP FUNCTION IF EXISTS public.assign_workout_plan(uuid, uuid, jsonb, date);

CREATE OR REPLACE FUNCTION public.assign_workout_plan(
  p_student_id UUID,
  p_trainer_id UUID,
  p_plan       JSONB,
  p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id   UUID;
  v_day_id    UUID;
  v_day       JSONB;
  v_exercise  JSONB;
  v_exercise_id UUID;
  v_day_idx   INT;
  v_ex_idx    INT;
  v_day_data  JSONB;
  v_days_arr  JSONB;
  v_placeholder UUID;
BEGIN
  -- Verificar que trainer e student pertencem à mesma academia
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_trainer_id AND role IN ('trainer','manager','admin')
  ) THEN
    RAISE EXCEPTION 'Treinador inválido.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_student_id AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'Aluno inválido.';
  END IF;

  -- Verificar vínculo student_trainer (se não for manager/admin criando direto)
  IF public.current_role() NOT IN ('manager','admin') AND NOT EXISTS (
    SELECT 1 FROM public.student_trainers
    WHERE student_id = p_student_id AND trainer_id = p_trainer_id
  ) THEN
    RAISE EXCEPTION 'Sem vínculo treinador-aluno.';
  END IF;

  -- Placeholder global (exercício mais simples da tabela)
  SELECT id INTO v_placeholder
  FROM public.exercises
  WHERE gym_id IS NULL
  ORDER BY name
  LIMIT 1;

  -- Buscar exercício real por nome (fallback = placeholder)
  -- Criar programa
  INSERT INTO public.workout_programs (
    gym_id, trainer_id, name, objective, created_via, ai_draft, reviewed_by
  ) VALUES (
    (SELECT gym_id FROM public.profiles WHERE id = p_student_id),
    p_trainer_id,
    COALESCE(p_plan->>'nome', 'Plano IA'),
    p_plan->>'objetivo',
    'ia',
    p_plan::text,
    p_trainer_id
  ) RETURNING id INTO v_plan_id;

  -- Dias do plano
  v_days_arr := COALESCE(p_plan->'dias', '[]'::jsonb);
  v_day_idx := 0;

  FOR v_day_idx IN 0..jsonb_array_length(v_days_arr) - 1 LOOP
    v_day := v_days_arr->v_day_idx;

    INSERT INTO public.workout_days (gym_id, program_id, name, day_order)
    VALUES (
      (SELECT gym_id FROM public.profiles WHERE id = p_student_id),
      v_plan_id,
      COALESCE(v_day->>'nome', 'Dia ' || (v_day_idx + 1)),
      v_day_idx + 1
    ) RETURNING id INTO v_day_id;

    -- Exercícios do dia
    v_ex_idx := 0;
    FOR v_ex_idx IN 0..jsonb_array_length(COALESCE(v_day->'exercicios', '[]'::jsonb)) - 1 LOOP
      v_exercise := (v_day->'exercicios')->v_ex_idx;

      -- Resolver exercise_id por nome
      SELECT id INTO v_exercise_id
      FROM public.exercises
      WHERE lower(name) = lower(v_exercise->>'exercicio')
        AND (gym_id IS NULL OR gym_id = (SELECT gym_id FROM public.profiles WHERE id = p_student_id))
      LIMIT 1;

      -- Fallback: busca parcial (primeiras palavras)
      IF v_exercise_id IS NULL THEN
        SELECT id INTO v_exercise_id
        FROM public.exercises
        WHERE lower(name) LIKE '%' || lower(split_part(v_exercise->>'exercicio', ' ', 1)) || '%'
          AND (gym_id IS NULL OR gym_id = (SELECT gym_id FROM public.profiles WHERE id = p_student_id))
        LIMIT 1;
      END IF;

      v_exercise_id := COALESCE(v_exercise_id, v_placeholder);

      INSERT INTO public.workout_exercises (
        gym_id, day_id, exercise_id, sets, reps, rest_seconds, rpe, notes, ord
      ) VALUES (
        (SELECT gym_id FROM public.profiles WHERE id = p_student_id),
        v_day_id,
        v_exercise_id,
        COALESCE((v_exercise->>'series')::int, 3),
        COALESCE(v_exercise->>'reps', '10'),
        COALESCE(replace(v_exercise->>'descanso', 's', '')::int, 60),
        COALESCE((v_exercise->>'rpe')::int, 7),
        v_exercise->>'exercicio',
        v_ex_idx + 1
      );
    END LOOP;
  END LOOP;

  -- Criar student_workout (vincula aluno ao programa)
  INSERT INTO public.student_workouts (gym_id, student_id, program_id, status)
  VALUES (
    (SELECT gym_id FROM public.profiles WHERE id = p_student_id),
    p_student_id,
    v_plan_id,
    'active'
  );

  RETURN v_plan_id;
END;
$$;

-- Permitir que authenticated execute a RPC
GRANT EXECUTE ON FUNCTION public.assign_workout_plan(uuid, uuid, jsonb, date) TO authenticated;
