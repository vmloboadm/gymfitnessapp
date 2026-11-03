-- 073_treino_inicial_automatico.sql
-- Gargalo medido em 02/11: 40 de 54 alunos aprovados sem ficha; 1ª ficha
-- levava ~13 dias. Agora o personal marca fichas como "modelo inicial" e o
-- aluno aprovado sem ficha recebe uma CÓPIA do modelo que mais combina
-- (nível, depois nº de dias). Risco médico continua só com o personal.
-- O personal recebe "Treino inicial aplicado" para revisar quando puder.

create table if not exists public.starter_templates (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  label text not null,
  -- níveis atendidos (profiles.experience_level); null = qualquer nível
  levels text[],
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (gym_id, program_id)
);

alter table public.starter_templates enable row level security;

drop policy if exists starter_templates_staff_select on public.starter_templates;
create policy starter_templates_staff_select on public.starter_templates
  for select using (
    gym_id = public.current_gym_id()
    and public.current_role() in ('trainer', 'manager', 'admin')
  );

drop policy if exists starter_templates_staff_write on public.starter_templates;
create policy starter_templates_staff_write on public.starter_templates
  for all using (
    gym_id = public.current_gym_id()
    and public.current_role() in ('trainer', 'manager', 'admin')
  ) with check (
    gym_id = public.current_gym_id()
    and public.current_role() in ('trainer', 'manager', 'admin')
  );

-- ---------------------------------------------------------------------------
create or replace function public.assign_starter_plan(p_student uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_caller record;
  st record;
  t record;
  prog record;
  d record;
  n integer;
  v_first text;
  v_draft jsonb;
  v_days text[];
  v_program uuid;
  v_day uuid;
begin
  select id, gym_id, name, approved_at, medical_risk, status, experience_level, available_days
    into st
  from public.profiles where id = p_student and role = 'student';
  if st.id is null then
    return jsonb_build_object('ok', false, 'reason', 'nao_e_aluno');
  end if;

  -- quem pode pedir: o próprio aluno, a equipe da academia dele, ou o banco
  if v_uid is not null then
    select role, gym_id into v_caller from public.profiles where id = v_uid;
    if not (v_uid = p_student
            or (v_caller.role in ('trainer', 'manager', 'admin') and v_caller.gym_id = st.gym_id)) then
      raise exception 'Sem permissão';
    end if;
  end if;

  if st.approved_at is null then
    return jsonb_build_object('ok', false, 'reason', 'nao_aprovado');
  end if;
  if coalesce(st.medical_risk, false) or coalesce(st.status, 'active') <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'avaliacao_medica');
  end if;

  perform pg_advisory_xact_lock(hashtext('starter:' || p_student::text));

  if exists (select 1 from public.student_workouts
             where student_id = p_student and status = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'ja_tem_ficha');
  end if;

  n := coalesce(array_length(st.available_days, 1), 3);

  select x.* into t from (
    select s.id, s.program_id, s.label, s.levels, s.created_at,
      (select count(*) from public.workout_days wd where wd.program_id = s.program_id)::int as nd
    from public.starter_templates s
    where s.gym_id = st.gym_id and s.active
  ) x
  where x.nd > 0
  order by (x.levels is not null and st.experience_level = any(x.levels)) desc,
           (x.levels is null) desc,
           abs(x.nd - n) asc,
           x.created_at asc
  limit 1;

  if t.id is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_modelo');
  end if;

  select * into prog from public.workout_programs where id = t.program_id;
  v_first := split_part(coalesce(nullif(trim(st.name), ''), 'Aluno'), ' ', 1);

  begin
    v_draft := prog.ai_draft::jsonb;
  exception when others then
    v_draft := null;
  end;
  -- dias da semana do aluno, se a quantidade bater com os dias do modelo
  if v_draft is not null and st.available_days is not null and n = t.nd then
    select array_agg(x order by public.weekday_number(x)) into v_days
    from unnest(st.available_days) x where public.weekday_number(x) is not null;
    if coalesce(array_length(v_days, 1), 0) = t.nd then
      v_draft := jsonb_set(v_draft, '{daysSelected}', to_jsonb(v_days));
    end if;
  end if;
  if v_draft is not null then
    v_draft := jsonb_set(v_draft, '{nome}', to_jsonb(prog.name || ' · ' || v_first));
  end if;

  insert into public.workout_programs
    (gym_id, trainer_id, name, objective, created_via, ai_draft, notes, reviewed_by)
  values
    (st.gym_id, prog.trainer_id, prog.name || ' · ' || v_first, prog.objective,
     'template', coalesce(v_draft::text, prog.ai_draft), prog.notes, null)
  returning id into v_program;

  for d in select * from public.workout_days where program_id = prog.id order by day_order loop
    insert into public.workout_days (gym_id, program_id, name, day_order)
    values (st.gym_id, v_program, d.name, d.day_order)
    returning id into v_day;

    insert into public.workout_exercises
      (gym_id, day_id, exercise_id, variation_id, sets, reps, rest_seconds, rpe, notes, technique, ord)
    select st.gym_id, v_day, we.exercise_id, we.variation_id, we.sets, we.reps,
           we.rest_seconds, we.rpe, we.notes, we.technique, we.ord
    from public.workout_exercises we where we.day_id = d.id;
  end loop;

  -- dispara "Novo treino liberado" para o aluno (trg_notify_plan_assigned)
  insert into public.student_workouts (gym_id, student_id, program_id, status)
  values (st.gym_id, p_student, v_program, 'active');

  if prog.trainer_id is not null then
    insert into public.notifications (gym_id, user_id, channel, title, body)
    values (st.gym_id, prog.trainer_id, 'in_app', 'Treino inicial aplicado',
      coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' recebeu o modelo "' || t.label
      || '". Já pode treinar; revise e ajuste quando puder.');
  end if;

  return jsonb_build_object('ok', true, 'program_id', v_program, 'template', t.label);
end;
$function$;

grant execute on function public.assign_starter_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Equipe: aplica em todos os alunos aprovados que estão sem ficha
create or replace function public.assign_starter_plans_bulk()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_role text;
  r record;
  res jsonb;
  applied integer := 0;
  skipped integer := 0;
begin
  select gym_id, role into v_gym, v_role from public.profiles where id = v_uid;
  if v_gym is null or v_role not in ('trainer', 'manager', 'admin') then
    raise exception 'Sem permissão';
  end if;

  for r in
    select p.id from public.profiles p
    where p.gym_id = v_gym and p.role = 'student' and p.approved_at is not null
      and not exists (select 1 from public.student_workouts sw
                      where sw.student_id = p.id and sw.status = 'active')
    order by p.approved_at
  loop
    res := public.assign_starter_plan(r.id);
    if (res ->> 'ok')::boolean then applied := applied + 1; else skipped := skipped + 1; end if;
  end loop;

  return jsonb_build_object('applied', applied, 'skipped', skipped);
end;
$function$;

grant execute on function public.assign_starter_plans_bulk() to authenticated;

-- Resumo para a tela da equipe: quantos estão sem ficha e por quê
create or replace function public.starter_plan_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  with me as (
    select gym_id from public.profiles
    where id = auth.uid() and role in ('trainer', 'manager', 'admin')
  ),
  s as (
    select p.* from public.profiles p, me
    where p.gym_id = me.gym_id and p.role = 'student' and p.approved_at is not null
      and not exists (select 1 from public.student_workouts sw
                      where sw.student_id = p.id and sw.status = 'active')
  )
  select jsonb_build_object(
    'without_plan', (select count(*) from s),
    'medical', (select count(*) from s where coalesce(medical_risk, false) or coalesce(status, 'active') <> 'active'),
    'pending_approval', (select count(*) from public.profiles p, me
                         where p.gym_id = me.gym_id and p.role = 'student' and p.approved_at is null)
  )
  where exists (select 1 from me);
$function$;

grant execute on function public.starter_plan_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Aprovou → já recebe o treino inicial
create or replace function public.on_student_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if NEW.role = 'student' and OLD.approved_at is null and NEW.approved_at is not null then
    begin
      perform public.assign_starter_plan(NEW.id);
    exception when others then
      raise warning 'treino inicial automático falhou: %', sqlerrm;
    end;
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_on_student_approved on public.profiles;
create trigger trg_on_student_approved
  after update of approved_at on public.profiles
  for each row execute function public.on_student_approved();
