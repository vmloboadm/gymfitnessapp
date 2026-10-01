-- 033: aprovação de aluno pelo personal + escolha de personal no onboarding.
-- Regra do cliente: todo aluno novo nasce AGUARDANDO aprovação (approved_at null);
-- o personal/gestor aprova em /personal/alunos e é levado a criar o treino.
-- No fim do onboarding o aluno escolhe quem vai acompanhá-lo (Rebeca, Claudeir,
-- Daiana...) ou pula — a escolha grava em student_trainers.

-- ── 1. Coluna de aprovação ───────────────────────────────────────────────────
alter table public.profiles add column if not exists approved_at timestamptz;

-- Alunos existentes começam pendentes (o cliente quer que nem a Joyce passe
-- sem aprovação do personal). Staff não passa por essa etapa.
update public.profiles set approved_at = null where role = 'student';

-- ── 2. RPC: aluno escolhe o personal no fim do onboarding ─────────────────────
create or replace function public.choose_personal(p_trainer_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_gym uuid;
begin
  select gym_id into v_gym from public.profiles where id = auth.uid();
  if v_gym is null then
    raise exception 'Perfil não encontrado.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_trainer_id
      and gym_id = v_gym
      and role in ('trainer', 'manager', 'admin')
      and status = 'active'
  ) then
    raise exception 'Personal inválido.';
  end if;
  -- troca de personal: remove vínculo anterior do aluno
  delete from public.student_trainers where student_id = auth.uid();
  insert into public.student_trainers (gym_id, student_id, trainer_id)
  values (v_gym, auth.uid(), p_trainer_id);
end;
$function$;

grant execute on function public.choose_personal(uuid) to authenticated;

-- ── 3. RPC: personal/gestor aprova o aluno recém-chegado ──────────────────────
create or replace function public.approve_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_gym  uuid;
begin
  select role, gym_id into v_role, v_gym
  from public.profiles where id = auth.uid();

  if v_role not in ('trainer', 'manager', 'admin') then
    raise exception 'Sem permissão para aprovar alunos.';
  end if;

  update public.profiles
  set approved_at = now(), updated_at = now()
  where id = p_student_id
    and role = 'student'
    and gym_id = v_gym
    and approved_at is null;

  if not found then
    raise exception 'Aluno não encontrado ou já aprovado.';
  end if;
end;
$function$;

grant execute on function public.approve_student(uuid) to authenticated;

-- ── 4. finish_onboarding reflete o step final agora que existe o passo 7 ─────
create or replace function public.finish_onboarding()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status text;
  v_risk   boolean;
begin
  select status, medical_risk into v_status, v_risk
  from public.profiles where id = auth.uid();

  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  if v_risk = true and v_status = 'pending_clearance' then
    raise exception 'CLINICAL_LOCK: Aguarde a liberação do laudo médico pelo gestor.';
  end if;

  update public.profiles
  set onboarding_completed = true,
      onboarding_step      = 7,
      updated_at           = now()
  where id = auth.uid();
end;
$function$;

grant execute on function public.finish_onboarding() to authenticated;

-- ── 5. RPC: aluno lista os personais da própria academia (RLS não deixa) ─────
create or replace function public.list_my_gym_trainers()
returns table (id uuid, name text, avatar_url text, role text)
language sql
security definer
set search_path to 'public'
stable
as $$
  select p.id, p.name, p.avatar_url, p.role
  from public.profiles p
  where p.gym_id = (select gym_id from public.profiles where id = auth.uid())
    and p.role in ('trainer', 'manager', 'admin')
    and p.status = 'active'
  order by case p.role when 'trainer' then 0 else 1 end, p.name;
$$;

grant execute on function public.list_my_gym_trainers() to authenticated;

-- ── 6. Trigger: perfil nasce no cadastro (com o NOME digitado no registro) ──
-- Antes o perfil só existia após visitar /onboarding; se o aluno caísse
-- direto no app, "Meu Perfil" ficava sem nome. Agora o insert do auth user
-- cria o profile com o nome do user_metadata, aguardando aprovação.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_gym uuid;
begin
  select id into v_gym from public.gyms order by created_at limit 1;
  insert into public.profiles (id, gym_id, role, status, name, email, onboarding_step, lgpd_consent_at)
  values (
    new.id,
    coalesce(v_gym, '00000000-0000-0000-0000-000000000001'),
    'student',
    'active',
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    1,
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
