-- =====================================================================
-- 010_onboarding_and_profile_rpcs.sql
-- Corrige: REVOKE UPDATE bloqueava onboarding e configurações
-- Cria RPCs para: onboarding steps, profile edits, settings
-- Habilita Realtime na tabela profiles
-- =====================================================================

-- =====================================================================
-- 0. Habilitar Realtime na tabela profiles (para trainer ver novos alunos)
-- =====================================================================

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Adicionar profiles à publicação Realtime (ignora se já existe)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- 1. RPC: Salvar step do onboarding (goal, birth_date, phone, etc.)
-- =====================================================================

DROP FUNCTION IF EXISTS public.update_onboarding_step(jsonb, int);

CREATE OR REPLACE FUNCTION public.update_onboarding_step(
  p_patch    JSONB,
  p_next_step INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    goal            = COALESCE(p_patch->>'goal', goal),
    birth_date      = COALESCE((p_patch->>'birth_date')::date, birth_date),
    phone           = COALESCE(p_patch->>'phone', phone),
    medical_risk    = COALESCE((p_patch->>'medical_risk')::boolean, medical_risk),
    daily_intake    = COALESCE(p_patch->>'daily_intake', daily_intake),
    onboarding_step = p_next_step,
    updated_at      = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_onboarding_step(jsonb, int) TO authenticated;

-- =====================================================================
-- 2. RPC: Completar onboarding
-- =====================================================================

DROP FUNCTION IF EXISTS public.finish_onboarding();

CREATE OR REPLACE FUNCTION public.finish_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    onboarding_completed = true,
    onboarding_step      = 5,
    updated_at           = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_onboarding() TO authenticated;

-- =====================================================================
-- 3. RPC: Atualizar perfil do aluno (configurações)
-- =====================================================================

DROP FUNCTION IF EXISTS public.update_student_profile(text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_student_profile(
  p_name       TEXT DEFAULT NULL,
  p_bio        TEXT DEFAULT NULL,
  p_goal       TEXT DEFAULT NULL,
  p_objetivo   TEXT DEFAULT NULL
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
    goal       = COALESCE(p_goal, goal),
    objetivo   = COALESCE(p_objetivo, objetivo),
    updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_profile(text, text, text, text) TO authenticated;

-- =====================================================================
-- 4. Adicionar colunas que faltam no profiles (bio, objetivo)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN bio TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'objetivo'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN objetivo TEXT;
  END IF;
END $$;
