-- 016: campos de anamnese separados + consentimento WhatsApp persistido.
-- Corrige: remédios iam para daily_intake, cirurgias se perdiam,
-- whatsapp_consent nunca chegava ao banco.

alter table profiles add column if not exists medications text;
alter table profiles add column if not exists surgery_history text;

create or replace function public.update_onboarding_step(p_patch jsonb, p_next_step integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.profiles
  set
    goal            = coalesce(p_patch->>'goal', goal),
    birth_date      = coalesce((p_patch->>'birth_date')::date, birth_date),
    phone           = coalesce(p_patch->>'phone', phone),
    medical_risk    = coalesce((p_patch->>'medical_risk')::boolean, medical_risk),
    daily_intake    = coalesce(p_patch->>'daily_intake', daily_intake),
    medications     = coalesce(p_patch->>'medications', medications),
    surgery_history = coalesce(p_patch->>'surgery_history', surgery_history),
    whatsapp_consent = coalesce((p_patch->>'whatsapp_consent')::boolean, whatsapp_consent),
    onboarding_step = p_next_step,
    updated_at      = now()
  where id = auth.uid();

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;
end;
$function$;
