-- 063_save_student_plan.sql
-- Salvamento atômico da ficha do aluno. Cria a nova versão, exercícios com
-- ID estável e vínculo ativo, arquivando a versão anterior na mesma transação.
-- Nunca apaga o histórico antigo.

alter table public.workout_programs
  add column if not exists notes text;

create or replace function public.save_student_plan(
  p_student uuid,
  p_plan jsonb,
  p_notes text default null,
  p_previous_workout uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_gym uuid;
  v_student_gym uuid;
  v_program uuid;
  v_student_workout uuid;
  v_day jsonb;
  v_ex jsonb;
  v_day_id uuid;
  v_exercise_id uuid;
  v_variation_id uuid;
  v_rest integer;
  v_rpe integer;
  v_technique text;
  v_name text;
  v_days integer;
  v_exs integer;
  v_dica text;
  v_reps text;
  v_sets integer;
  i integer;
  j integer;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  select gym_id, role into v_gym, v_role
  from public.profiles where id = v_uid;

  if v_gym is null or v_role not in ('trainer','manager','admin') then
    raise exception 'Sem permissão para salvar fichas';
  end if;

  select gym_id into v_student_gym
  from public.profiles
  where id = p_student and role = 'student';

  if v_student_gym is null or v_student_gym <> v_gym then
    raise exception 'Aluno fora da sua academia';
  end if;

  if p_plan is null or jsonb_typeof(p_plan -> 'dias') <> 'array'
     or jsonb_array_length(p_plan -> 'dias') = 0 then
    raise exception 'A ficha precisa ter pelo menos um dia';
  end if;

  insert into public.workout_programs
    (gym_id, trainer_id, name, objective, created_via, ai_draft, reviewed_by, notes)
  values
    (v_gym, v_uid, coalesce(nullif(p_plan ->> 'nome', ''), 'Treino'),
     nullif(p_plan ->> 'objetivo', ''), 'manual', p_plan::text, v_uid,
     coalesce(nullif(p_notes, ''), nullif(p_plan ->> 'observacao_geral', '')))
  returning id into v_program;

  v_days := jsonb_array_length(p_plan -> 'dias');

  for i in 0 .. v_days - 1 loop
    v_day := p_plan -> 'dias' -> i;

    insert into public.workout_days (gym_id, program_id, name, day_order)
    values (v_gym, v_program,
      coalesce(nullif(v_day ->> 'nome', ''), 'Dia ' || (i + 1)),
      i + 1)
    returning id into v_day_id;

    if jsonb_typeof(v_day -> 'exercicios') <> 'array' then
      raise exception 'Dia % sem lista de exercícios', i + 1;
    end if;

    v_exs := jsonb_array_length(v_day -> 'exercicios');

    for j in 0 .. v_exs - 1 loop
      v_ex := v_day -> 'exercicios' -> j;
      v_name := coalesce(nullif(v_ex ->> 'exercicio', ''), 'Exercício');
      v_reps := coalesce(nullif(v_ex ->> 'reps', ''), '10');
      v_sets := greatest(1, least(20, coalesce(nullif(v_ex ->> 'series', '')::int, 3)));
      v_dica := coalesce(v_ex ->> 'dica', '');
      v_rest := coalesce(nullif(regexp_replace(coalesce(v_ex ->> 'descanso', ''), '[^0-9]', '', 'g'), '')::int, 60);
      v_rpe := coalesce(nullif(v_ex ->> 'rpe', '')::numeric::int, 7);
      v_technique := case when (v_ex ->> 'tecnica') in ('biset','triset','dropset') then (v_ex ->> 'tecnica') else 'normal' end;

      v_exercise_id := null;
      begin
        v_exercise_id := nullif(v_ex ->> 'exerciseId', '')::uuid;
      exception when others then
        v_exercise_id := null;
      end;

      if v_exercise_id is null then
        select e.id into v_exercise_id
        from public.exercises e
        where (e.gym_id is null or e.gym_id = v_gym)
          and (
            lower(regexp_replace(translate(e.name, 'áàâãéêíóôõúç', 'aaaaeeiooouc'), '[^a-z0-9 ]', '', 'g'))
              = lower(regexp_replace(translate(v_name, 'áàâãéêíóôõúç', 'aaaaeeiooouc'), '[^a-z0-9 ]', '', 'g'))
            or exists (
              select 1 from unnest(coalesce(e.aliases, array[]::text[])) alias
              where lower(regexp_replace(translate(alias, 'áàâãéêíóôõúç', 'aaaaeeiooouc'), '[^a-z0-9 ]', '', 'g'))
                = lower(regexp_replace(translate(v_name, 'áàâãéêíóôõúç', 'aaaaeeiooouc'), '[^a-z0-9 ]', '', 'g'))
            )
          )
        order by (e.gym_id = v_gym) desc, e.name
        limit 1;
      end if;

      if v_exercise_id is null or not exists (
        select 1 from public.exercises e
        where e.id = v_exercise_id and (e.gym_id is null or e.gym_id = v_gym)
      ) then
        raise exception 'Exercício não encontrado na biblioteca: %', v_name;
      end if;

      v_variation_id := null;
      begin
        v_variation_id := nullif(v_ex ->> 'variationId', '')::uuid;
      exception when others then
        v_variation_id := null;
      end;

      insert into public.workout_exercises
        (gym_id, day_id, exercise_id, variation_id, sets, reps, rest_seconds, rpe, notes, technique, ord)
      values
        (v_gym, v_day_id, v_exercise_id, v_variation_id, v_sets, v_reps, v_rest, v_rpe,
         v_name || case when v_dica <> '' then '. ' || v_dica else '' end,
         v_technique, j + 1);
    end loop;
  end loop;

  insert into public.student_workouts (gym_id, student_id, program_id, status)
  values (v_gym, p_student, v_program, 'active')
  returning id into v_student_workout;

  -- A versão anterior vira histórico. Se isso falhar, a transação inteira cai.
  update public.student_workouts
  set status = 'completed', completed_at = now()
  where student_id = p_student
    and status = 'active'
    and id <> v_student_workout;

  return jsonb_build_object(
    'program_id', v_program,
    'student_workout_id', v_student_workout,
    'previous_workout', p_previous_workout
  );
end;
$function$;

grant execute on function public.save_student_plan(uuid, jsonb, text, uuid) to authenticated;
