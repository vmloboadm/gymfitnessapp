-- 042_profile_editing.sql
-- Telefone normalizado (55 + DDD + número, sem duplicar) no onboarding e no
-- perfil + aluno edita telefone, nascimento, nível e dias + staff edita nível,
-- objetivo e dias do aluno vinculado.

-- normalizador BR no banco (espelha normalizeBRPhone do front)
create or replace function public.normalize_phone(raw text)
returns text
language plpgsql
immutable
as $function$
declare
  d text;
begin
  if raw is null then
    return null;
  end if;
  d := regexp_replace(raw, '\D', '', 'g');
  d := regexp_replace(d, '^0+', '');
  if d like '55%' and length(d) in (12, 13) then
    return d;
  end if;
  if length(d) in (10, 11) and left(d, 2) <> '55' then
    return '55' || d;
  end if;
  return null;
end;
$function$;

-- onboarding passa a salvar o telefone já normalizado (resto idêntico ao atual)
create or replace function public.update_onboarding_step(p_patch jsonb, p_next_step integer)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_phone text;
begin
  if p_patch ? 'phone' then
    v_phone := public.normalize_phone(p_patch->>'phone');
  end if;
  update public.profiles set
    goal              = coalesce(p_patch->>'goal', goal),
    birth_date        = coalesce((p_patch->>'birth_date')::date, birth_date),
    phone             = coalesce(v_phone, phone),
    medical_risk      = coalesce((p_patch->>'medical_risk')::boolean, medical_risk),
    daily_intake      = coalesce(p_patch->>'daily_intake', daily_intake),
    medications       = coalesce(p_patch->>'medications', medications),
    surgery_history   = coalesce(p_patch->>'surgery_history', surgery_history),
    whatsapp_consent  = coalesce((p_patch->>'whatsapp_consent')::boolean, whatsapp_consent),
    sex               = coalesce(p_patch->>'sex', sex),
    experience_level  = coalesce(p_patch->>'experience_level', experience_level),
    available_days    = coalesce(
      case when jsonb_typeof(p_patch->'available_days') = 'array'
        then (select array_agg(d::text) from jsonb_array_elements_text(p_patch->'available_days') d)
        else null end,
      available_days
    ),
    emergency_contact = case when p_patch ? 'emergency_contact' then p_patch->'emergency_contact' else emergency_contact end,
    medical_flags     = coalesce(
      case when jsonb_typeof(p_patch->'medical_flags') = 'array'
        then (select array_agg(f::text) from jsonb_array_elements_text(p_patch->'medical_flags') f)
        else null end,
      medical_flags
    ),
    plan_type         = coalesce(p_patch->>'plan_type', plan_type),
    vencimento        = coalesce((p_patch->>'vencimento')::date, vencimento),
    onboarding_step   = p_next_step,
    updated_at        = now()
  where id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado.';
  end if;
end;
$function$;

-- perfil completo editável pelo próprio aluno (sexo NÃO entra: regra do app)
create or replace function public.update_student_profile(
  p_name text default null,
  p_bio text default null,
  p_goal text default null,
  p_objetivo text default null,
  p_phone text default null,
  p_birth_date date default null,
  p_experience_level text default null,
  p_available_days text[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.profiles set
    name             = coalesce(p_name, name),
    bio              = coalesce(p_bio, bio),
    goal             = coalesce(p_goal, goal),
    objetivo         = coalesce(p_objetivo, objetivo),
    phone            = coalesce(public.normalize_phone(p_phone), phone),
    birth_date       = coalesce(p_birth_date, birth_date),
    experience_level = coalesce(p_experience_level, experience_level),
    available_days   = coalesce(p_available_days, available_days),
    updated_at       = now()
  where id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado.';
  end if;
end;
$function$;

-- staff edita nível, objetivo e dias do aluno (vinculado ou gestão)
create or replace function public.staff_update_student(
  p_student_id uuid,
  p_experience_level text default null,
  p_goal text default null,
  p_objetivo text default null,
  p_available_days text[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_role text;
  v_gym uuid;
  s_gym uuid;
  linked boolean;
begin
  select role, gym_id into v_role, v_gym from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('trainer', 'manager', 'admin') then
    raise exception 'Sem permissão.';
  end if;
  select gym_id into s_gym from public.profiles where id = p_student_id;
  if s_gym is null or s_gym <> v_gym then
    raise exception 'Aluno de outra academia.';
  end if;
  if v_role = 'trainer' then
    select exists (
      select 1 from public.student_trainers
      where student_id = p_student_id and trainer_id = auth.uid()
    ) into linked;
    if not linked then
      raise exception 'Aluno sem vínculo com você.';
    end if;
  end if;
  update public.profiles set
    experience_level = coalesce(p_experience_level, experience_level),
    goal             = coalesce(p_goal, goal),
    objetivo         = coalesce(p_objetivo, objetivo),
    available_days   = coalesce(p_available_days, available_days),
    updated_at       = now()
  where id = p_student_id;
end;
$function$;

grant execute on function public.normalize_phone(text) to authenticated;
grant execute on function public.staff_update_student(uuid, text, text, text, text[]) to authenticated;
