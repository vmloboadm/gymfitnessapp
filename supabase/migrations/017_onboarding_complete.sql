-- 017: onboarding completo — campos novos, trava clínica real, aprovação de laudo.
-- Adiciona: sex, experience_level, available_days, emergency_contact.
-- Corrige: finish_onboarding valida pending_clearance; trigger medical_clearances
-- libera profile quando laudo é aprovado.

-- ── 1. Novas colunas em profiles ──────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sex text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_level text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_days text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact jsonb;

-- ── 2. RPC update_onboarding_step (aceita campos novos) ───────────────────────
CREATE OR REPLACE FUNCTION public.update_onboarding_step(p_patch jsonb, p_next_step integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET
    goal              = coalesce(p_patch->>'goal', goal),
    birth_date        = coalesce((p_patch->>'birth_date')::date, birth_date),
    phone             = coalesce(p_patch->>'phone', phone),
    medical_risk      = coalesce((p_patch->>'medical_risk')::boolean, medical_risk),
    daily_intake      = coalesce(p_patch->>'daily_intake', daily_intake),
    medications       = coalesce(p_patch->>'medications', medications),
    surgery_history   = coalesce(p_patch->>'surgery_history', surgery_history),
    whatsapp_consent  = coalesce((p_patch->>'whatsapp_consent')::boolean, whatsapp_consent),
    sex               = coalesce(p_patch->>'sex', sex),
    experience_level  = coalesce(p_patch->>'experience_level', experience_level),
    available_days    = coalesce(
      CASE WHEN p_patch ? 'available_days'
        THEN (SELECT array_agg(d::text) FROM jsonb_array_elements_text(p_patch->'available_days') d)
        ELSE NULL END,
      available_days
    ),
    emergency_contact = coalesce(p_patch->>'emergency_contact', emergency_contact),
    onboarding_step   = p_next_step,
    updated_at        = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;
END;
$function$;

-- ── 3. RPC finish_onboarding (bloqueia se pending_clearance) ──────────────────
CREATE OR REPLACE FUNCTION public.finish_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_risk   boolean;
BEGIN
  SELECT status, medical_risk INTO v_status, v_risk
  FROM public.profiles WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;

  IF v_risk = true AND v_status = 'pending_clearance' THEN
    RAISE EXCEPTION 'CLINICAL_LOCK: Aguarde a liberação do laudo médico pelo gestor.';
  END IF;

  UPDATE public.profiles
  SET
    onboarding_completed = true,
    onboarding_step      = 5,
    updated_at           = now()
  WHERE id = auth.uid();
END;
$function$;

-- ── 4. Trigger: medical_clearances → profile status ───────────────────────────
CREATE OR REPLACE FUNCTION public.sync_profile_from_clearance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_risk boolean;
  v_has_approved boolean;
BEGIN
  SELECT medical_risk INTO v_risk
  FROM public.profiles WHERE id = COALESCE(NEW.student_id, OLD.student_id);

  SELECT EXISTS (
    SELECT 1 FROM public.medical_clearances
    WHERE student_id = COALESCE(NEW.student_id, OLD.student_id)
      AND approved = true
  ) INTO v_has_approved;

  IF v_risk = true THEN
    UPDATE public.profiles
    SET status = CASE WHEN v_has_approved THEN 'active' ELSE 'pending_clearance' END,
        updated_at = now()
    WHERE id = COALESCE(NEW.student_id, OLD.student_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_profile_from_clearance ON medical_clearances;
CREATE TRIGGER trg_sync_profile_from_clearance
  AFTER INSERT OR UPDATE OR DELETE ON medical_clearances
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_from_clearance();
