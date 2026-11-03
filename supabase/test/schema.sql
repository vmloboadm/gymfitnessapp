--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: add_points(uuid, uuid, text, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_points(p_gym uuid, p_student uuid, p_source text, p_points integer, p_key text, p_label text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  insert into public.point_events (gym_id, student_id, source, points, dedupe_key)
  values (p_gym, p_student, p_source, p_points, p_key)
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then return; end if;  -- já premiado (anti-farm)

  insert into public.notifications (gym_id, user_id, title, body)
  values (p_gym, p_student, 'Você ganhou pontos!', format('+%s pontos por %s. Suba no ranking!', p_points, p_label));

  perform public.recompute_leaderboard(p_student, p_gym);
end;
$$;


--
-- Name: approve_student(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_student(p_student_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: assign_starter_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_starter_plan(p_student uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_caller record;
  st record;
  t record;
  n integer;
  v_program uuid;
  v_owner uuid;
begin
  select id, gym_id, name, approved_at, medical_risk, status, experience_level, available_days, sex
    into st
  from public.profiles where id = p_student and role = 'student';
  if st.id is null then
    return jsonb_build_object('ok', false, 'reason', 'nao_e_aluno');
  end if;

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
    select s.*,
      (select count(*) from public.workout_days wd where wd.program_id = s.program_id)::int as nd
    from public.starter_templates s
    where s.gym_id = st.gym_id and s.active
      and (s.audience is null or st.sex is null or s.audience = st.sex)
  ) x
  where x.nd > 0
  order by (not x.is_base) desc,
           (x.levels is not null and st.experience_level = any(x.levels)) desc,
           (x.levels is null) desc,
           abs(x.nd - n) asc,
           x.sort asc,
           x.created_at asc
  limit 1;

  if t.id is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_modelo');
  end if;

  v_program := public.copy_template_for_student(t.id, p_student);

  select trainer_id into v_owner from public.workout_programs where id = t.program_id;
  if v_owner is not null then
    insert into public.notifications (gym_id, user_id, channel, title, body)
    values (st.gym_id, v_owner, 'in_app', 'Treino inicial aplicado',
      coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' recebeu o modelo "' || t.label
      || '". Já pode treinar; revise e ajuste quando puder.');
  end if;

  return jsonb_build_object('ok', true, 'program_id', v_program, 'template', t.label);
end;
$$;


--
-- Name: assign_starter_plans_bulk(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_starter_plans_bulk() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: assign_workout_plan(uuid, uuid, jsonb, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_workout_plan(p_student_id uuid, p_trainer_id uuid, p_plan jsonb, p_start_date date DEFAULT CURRENT_DATE) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: athlete_display(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.athlete_display(p_student uuid, OUT disp text, OUT firstn text) RETURNS record
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  aname text;
begin
  select coalesce(nullif(trim(name), ''), 'Atleta') into aname from public.profiles where id = p_student;
  aname := coalesce(aname, 'Atleta');
  firstn := split_part(aname, ' ', 1);
  disp := firstn || case when split_part(aname, ' ', 2) <> ''
    then ' ' || left(split_part(aname, ' ', 2), 1) || '.' else '' end;
end;
$$;


--
-- Name: auto_close_stale_workouts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_close_stale_workouts(p_student uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
  r record;
begin
  if v_uid is not null and (p_student is null or p_student <> v_uid) then
    raise exception 'Sem permissão';
  end if;

  for r in
    select ws.id, ws.student_id, ws.gym_id, ws.started_at
    from public.workout_sessions ws
    where ws.status = 'active'
      and ws.started_at < (now() - interval '3 hours')
      and (p_student is null or ws.student_id = p_student)
  loop
    update public.workout_sessions
    set status = 'completed',
        ended_at = greatest(
          r.started_at + interval '3 hours',
          coalesce((
            select max(c.checked_at) from public.checkins c
            where c.workout_session_id = r.id and c.type = 'entrada'
          ), r.started_at)
        ),
        meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
          'auto_finished', true,
          'finished_by', 'auto',
          'auto_closed_at', now()
        )
    where id = r.id and status = 'active';

    insert into public.checkins (gym_id, student_id, type, source, checked_at, workout_session_id)
    select r.gym_id, r.student_id, 'saida', 'app',
           greatest(
             r.started_at + interval '3 hours',
             coalesce((
               select max(c.checked_at) from public.checkins c
               where c.workout_session_id = r.id and c.type = 'entrada'
             ), r.started_at)
           ), r.id
    where exists (
      select 1 from public.checkins c
      where c.student_id = r.student_id
        and c.gym_id = r.gym_id
        and c.type = 'entrada'
        and (c.workout_session_id = r.id or c.workout_session_id is null)
        and not exists (
          select 1 from public.checkins s
          where s.student_id = c.student_id
            and s.gym_id = c.gym_id
            and s.type = 'saida'
            and s.checked_at > c.checked_at
        )
    )
    and not exists (
      select 1 from public.checkins x
      where x.workout_session_id = r.id and x.type = 'saida'
    )
    limit 1;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


--
-- Name: award_cardio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_cardio() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  total_all integer;
  total_month integer;
  aname text;
  disp text;
  firstn text;
begin
  begin
    select count(*) into total_all
    from public.cardio_logs where student_id = NEW.student_id;
    select coalesce(sum(minutes), 0) into total_month
    from public.cardio_logs
    where student_id = NEW.student_id and date >= date_trunc('month', NEW.date);
    select coalesce(nullif(name, ''), 'Atleta') into aname
    from public.profiles where id = NEW.student_id;
    firstn := split_part(aname, ' ', 1);
    disp := firstn || case when split_part(aname, ' ', 2) <> '' then ' ' || left(split_part(aname, ' ', 2), 1) || '.' else '' end;

    if total_all = 1 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'cardio_first', disp, firstn, 'registrou o primeiro cardio!');
    end if;
    if total_month >= 180 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'cardio_180', disp, firstn, 'somou 180 minutos de cardio no mês!');
    end if;
  exception when others then
    raise warning 'award_cardio falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: award_checkin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_checkin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_day date := (NEW.checked_at at time zone 'America/Sao_Paulo')::date;
  n record;
begin
  if NEW.type = 'entrada' then
    perform public.add_points(NEW.gym_id, NEW.student_id, 'checkin', 5,
      'checkin:'||NEW.student_id||':'||v_day, 'fazer check-in na academia');

    if not exists (
      select 1 from public.checkins
      where student_id = NEW.student_id and type = 'entrada' and id <> NEW.id
    ) then
      n := public.athlete_display(NEW.student_id);
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'first_checkin',
        n.disp, n.firstn, 'fez o primeiro check-in na academia!');
    end if;
  end if;
  return NEW;
end;
$$;


--
-- Name: award_feed_comment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_feed_comment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.add_points(NEW.gym_id, NEW.user_id, 'feed_comment', 3, 'comment:'||NEW.id, 'comentar no feed');
  return NEW;
end; $$;


--
-- Name: award_feed_like(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_feed_like() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.add_points(NEW.gym_id, NEW.user_id, 'feed_like', 2, 'like:'||NEW.post_id||':'||NEW.user_id, 'curtir uma publicação');
  return NEW;
end; $$;


--
-- Name: award_feed_post(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_feed_post() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if NEW.author_id is not null and not NEW.is_pinned
     and coalesce(current_setting('gf.system_post', true), '') <> '1' then
    perform public.add_points(NEW.gym_id, NEW.author_id, 'feed_post', 10, 'post:'||NEW.id, 'postar no feed');
  end if;
  return NEW;
end;
$$;


--
-- Name: award_log_milestones(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_log_milestones() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  prev numeric;
  exname text;
  n record;
  today date := public.local_day(NEW.date);
  ws date := date_trunc('week', public.local_day(NEW.date))::date;
  week_volume numeric;
  pr_owned boolean;
begin
  begin
    n := public.athlete_display(NEW.student_id);

    -- Recorde: carga maior que qualquer dia anterior no mesmo exercício
    if NEW.weight_kg is not null and NEW.weight_kg > 0 and NEW.exercise_id is not null then
      select max(weight_kg) into prev
      from public.workout_logs
      where student_id = NEW.student_id
        and exercise_id = NEW.exercise_id
        and id <> NEW.id
        and public.local_day(date) < today;

      if prev is not null and NEW.weight_kg > prev then
        select coalesce(nullif(trim(name), ''), 'um exercício') into exname
        from public.exercises where id = NEW.exercise_id;
        exname := coalesce(exname, 'um exercício');

        select exists (
          select 1 from public.student_achievements sa
          join public.achievements a on a.id = sa.achievement_id
          where sa.student_id = NEW.student_id and a.code = 'pr_new_record'
        ) into pr_owned;

        if not exists (
          select 1 from public.feed_posts
          where author_id = NEW.student_id and type = 'conquista'
            and body like '%novo recorde%'
            and public.local_day(created_at) = public.local_day(now())
        ) then
          if not pr_owned then
            perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'pr_new_record',
              n.disp, n.firstn,
              'bateu um novo recorde no ' || exname || ': ' || public.fmt_kg(NEW.weight_kg) || ' kg!');
          else
            perform public.system_feed_post(NEW.gym_id, NEW.student_id,
              n.disp || ' bateu um novo recorde no ' || exname || ': '
              || public.fmt_kg(NEW.weight_kg) || ' kg! 💪 Parabéns, ' || n.firstn || '!');
            insert into public.notifications (gym_id, user_id, channel, title, body)
            values (NEW.gym_id, NEW.student_id, 'in_app', 'Novo recorde: ' || exname,
              public.fmt_kg(NEW.weight_kg) || ' kg, acima dos ' || public.fmt_kg(prev)
              || ' kg de antes. Já está no feed!');
          end if;
        end if;
      end if;
    end if;

    -- 10.000 kg de volume na semana (seg-dom)
    if NEW.weight_kg is not null and NEW.reps is not null then
      select coalesce(sum(coalesce(weight_kg, 0) * coalesce(reps, 0)), 0) into week_volume
      from public.workout_logs
      where student_id = NEW.student_id and public.local_day(date) >= ws
        and public.local_day(date) < ws + 7;
      if week_volume >= 10000 then
        perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'volume_10k',
          n.disp, n.firstn, 'moveu mais de 10 toneladas na semana!');
      end if;
    end if;
  exception when others then
    raise warning 'award_log_milestones falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: award_progress_photo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_progress_photo() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.add_points(NEW.gym_id, NEW.student_id, 'photo', 20, 'photo:'||NEW.id, 'postar uma foto de evolução');
  return NEW;
end; $$;


--
-- Name: award_workout_achievements(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_workout_achievements() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  ws date := date_trunc('week', NEW.date at time zone 'America/Sao_Paulo')::date;
  ms date := date_trunc('month', NEW.date at time zone 'America/Sao_Paulo')::date;
  total_days integer;
  month_days integer;
  streak integer;
  goal integer;
  sessions_week integer;
  first_today boolean;
  aname text;
  disp text;
  firstn text;
begin
  begin
    select not exists (
      select 1 from public.workout_logs
      where student_id = NEW.student_id
        and public.local_day(date) = public.local_day(NEW.date)
        and id <> NEW.id
    ) into first_today;
    if not first_today then
      return NEW;
    end if;

    select count(distinct public.local_day(date)) into total_days
    from public.workout_logs where student_id = NEW.student_id;
    select count(distinct public.local_day(date)) into month_days
    from public.workout_logs where student_id = NEW.student_id and public.local_day(date) >= ms;
    select count(distinct public.local_day(date)) into sessions_week
    from public.workout_logs
    where student_id = NEW.student_id
      and public.local_day(date) >= ws
      and extract(isodow from public.local_day(date))::int = any(public.student_scheduled_days(NEW.student_id));
    streak := public.day_streak(NEW.student_id);
    goal := coalesce(array_length(public.student_scheduled_days(NEW.student_id), 1), 3);
    select coalesce(nullif(name, ''), 'Atleta') into aname
    from public.profiles where id = NEW.student_id;
    firstn := split_part(aname, ' ', 1);
    disp := firstn || case when split_part(aname, ' ', 2) <> '' then ' ' || left(split_part(aname, ' ', 2), 1) || '.' else '' end;

    if total_days >= 1 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'first_workout', disp, firstn, 'fez o primeiro treino!');
    end if;
    if total_days >= 10 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'workout_10', disp, firstn, 'completou 10 treinos!');
    end if;
    if total_days >= 50 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'workout_50', disp, firstn, 'completou 50 treinos!');
    end if;
    if streak >= 3 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'streak_3', disp, firstn, 'chegou a 3 dias programados seguidos!', false);
    end if;
    if streak >= 7 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'streak_7', disp, firstn, 'chegou a 7 dias programados seguidos!');
    end if;
    if streak >= 30 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'streak_30', disp, firstn, 'chegou a 30 dias programados seguidos!');
    end if;
    if goal > 0 and sessions_week >= goal then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'week_goal', disp, firstn, 'concluiu o objetivo semanal!');
    end if;
    if month_days >= 12 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'month_12', disp, firstn, 'treinou 12 dias no mês!');
    end if;
  exception when others then
    raise warning 'award_workout_achievements falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: base_programs_catalog(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.base_programs_catalog() RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $_$
select $json$[
 {"key":"m-ini-ab","audience":"M","level":"Iniciante","split":"AB","dpw":3,"sort":1,
  "label":"Iniciante · AB","objective":"Adaptação",
  "description":"Para quem está começando: superiores num dia, pernas e abdômen no outro. Alterne A e B, 3x por semana.",
  "days":[
   {"nome":"A · Superiores","foco":"Peito, costas, ombros e braços","exs":[
    ["Supino na máquina",3,"12",60,"Desça controlando até a linha do peito"],
    ["Puxada frontal (pulldown)",3,"12",60,"Puxe até o queixo, peito aberto"],
    ["Desenvolvimento na máquina",3,"12",60,"Não trave os cotovelos em cima"],
    ["Remada na máquina",3,"12",60,"Junte as escápulas no final"],
    ["Rosca direta com barra",3,"12",60,"Cotovelo parado ao lado do corpo"],
    ["Tríceps Pulley",3,"12",60,"Só o antebraço se move"]]},
   {"nome":"B · Pernas e abdômen","foco":"Quadríceps, posterior, panturrilha e core","exs":[
    ["Leg press 45°",3,"12",90,"Não estenda totalmente o joelho"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Cadeira flexora",3,"12",60,"Quadril colado no banco"],
    ["Panturrilha em Pé na Máquina",3,"15",45,"Amplitude total"],
    ["Abdominal crunch",3,"15",45,"Solte o ar ao subir"],
    ["Prancha",3,"30s",45,"Abdômen e glúteo contraídos"]]}]},

 {"key":"m-ini-abc","audience":"M","level":"Iniciante","split":"ABC","dpw":3,"sort":2,
  "label":"Iniciante · ABC","objective":"Hipertrofia",
  "description":"O clássico: peito e tríceps, costas e bíceps, pernas e ombros. 3x por semana.",
  "days":[
   {"nome":"A · Peito e tríceps","foco":"Peito, tríceps e abdômen","exs":[
    ["Supino reto com barra",3,"10-12",90,"Pés firmes no chão, escápulas juntas"],
    ["Supino inclinado com halteres",3,"12",60,"Banco a 30-45°"],
    ["Voador (peck deck)",3,"12",60,"Abraço controlado, sem bater as mãos"],
    ["Tríceps Pulley",3,"12",60,"Cotovelos colados no corpo"],
    ["Tríceps francês halter",3,"12",60,"Cotovelos apontando para cima"],
    ["Crunch no Solo",3,"15",45,"Movimento curto e controlado"]]},
   {"nome":"B · Costas e bíceps","foco":"Costas, bíceps e abdômen","exs":[
    ["Puxada frontal (pulldown)",3,"12",60,"Puxe com as costas, não com os braços"],
    ["Remada Baixa (Cabo)",3,"12",60,"Tronco parado, puxe até o umbigo"],
    ["Remada serrote (1 halter)",3,"12",60,"Cotovelo rente ao corpo"],
    ["Rosca direta com barra",3,"12",60,"Sem balançar o tronco"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"],
    ["Abdominal infra",3,"15",45,"Desça as pernas devagar"]]},
   {"nome":"C · Pernas e ombros","foco":"Pernas completas e ombros","exs":[
    ["Leg press 45°",3,"12",90,"Pés na largura do quadril"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Desenvolvimento com halteres",3,"12",60,"Não arqueie a lombar"],
    ["Elevação lateral",3,"12",45,"Até a linha do ombro"],
    ["Panturrilha em pé",3,"15",45,"Pausa embaixo e em cima"]]}]},

 {"key":"m-int-abc","audience":"M","level":"Intermediário","split":"ABC","dpw":3,"sort":3,
  "label":"Intermediário · ABC","objective":"Hipertrofia",
  "description":"ABC com mais volume e trapézio. Faça 3x por semana ou repita a sequência (ABC ABC) para 6x.",
  "days":[
   {"nome":"A · Peito e tríceps","foco":"Peito, tríceps e abdômen","exs":[
    ["Supino reto com barra",4,"8-10",90,"Carga progressiva a cada série"],
    ["Supino inclinado com halteres",4,"10",90,"Banco a 30-45°"],
    ["Crucifixo no Crossover (Polia Alta)",3,"12",60,"Cruze as mãos no final"],
    ["Fundos (Paralelas)",3,"10",90,"Tronco levemente inclinado à frente"],
    ["Tríceps testa",3,"10",60,"Cotovelos fixos"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Abdominal na polia",3,"15",45,"Enrole a coluna"]]},
   {"nome":"B · Costas, bíceps e trapézio","foco":"Costas, bíceps e trapézio","exs":[
    ["Barra fixa assistida",4,"8-10",90,"Peito em direção à barra"],
    ["Remada curvada com barra",4,"10",90,"Coluna neutra, tronco a 45°"],
    ["Puxada com Triângulo",3,"12",60,"Puxe até o peito"],
    ["Remada serrote (1 halter)",3,"10",60,"Cotovelo rente ao corpo"],
    ["Encolhimento com halteres",3,"12",45,"Segure 1s em cima"],
    ["Rosca direta com barra",3,"10",60,"Sem balançar"],
    ["Rosca martelo",3,"12",60,"Alternado ou simultâneo"]]},
   {"nome":"C · Pernas e ombros","foco":"Pernas completas e ombros","exs":[
    ["Agachamento livre",4,"8-10",120,"Desça até a coxa paralela, joelho alinhado ao pé"],
    ["Leg press 45°",4,"12",90,"Amplitude completa"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Stiff com barra",3,"10",90,"Barra rente às pernas, coluna neutra"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Desenvolvimento militar",3,"10",90,"Abdômen firme"],
    ["Elevação lateral",3,"12",45,"Até a linha do ombro"],
    ["Panturrilha em pé",4,"15",45,"Amplitude total"]]}]},

 {"key":"m-int-abcd","audience":"M","level":"Intermediário","split":"ABCD","dpw":4,"sort":4,
  "label":"Intermediário · ABCD","objective":"Hipertrofia",
  "description":"4x por semana: peito e tríceps, costas e bíceps, pernas, ombros com trapézio e abdômen.",
  "days":[
   {"nome":"A · Peito e tríceps","foco":"Peito e tríceps","exs":[
    ["Supino reto com barra",4,"10",90,"Escápulas juntas no banco"],
    ["Supino inclinado com halteres",3,"10",90,"Banco a 30-45°"],
    ["Crucifixo com halteres",3,"12",60,"Cotovelos levemente flexionados"],
    ["Tríceps testa",3,"10",60,"Cotovelos fixos"],
    ["Tríceps Pulley",3,"12",60,"Cotovelos colados no corpo"],
    ["Mergulho no banco",3,"12",60,"Desça até 90° no cotovelo"]]},
   {"nome":"B · Costas e bíceps","foco":"Costas e bíceps","exs":[
    ["Puxada frontal (pulldown)",4,"10",90,"Peito aberto"],
    ["Remada curvada com barra",4,"10",90,"Coluna neutra"],
    ["Remada Baixa (Cabo)",3,"12",60,"Puxe até o umbigo"],
    ["Pullover (Dorsal)",3,"12",60,"Braços quase estendidos"],
    ["Rosca direta com barra",3,"10",60,"Sem balançar"],
    ["Rosca alternada com halteres",3,"12",60,"Gire o punho ao subir"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"]]},
   {"nome":"C · Pernas","foco":"Quadríceps, posterior e panturrilha","exs":[
    ["Agachamento livre",4,"10",120,"Joelho alinhado ao pé"],
    ["Leg press 45°",4,"12",90,"Não estenda totalmente o joelho"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Stiff com barra",3,"10",90,"Coluna neutra"],
    ["Mesa Flexora",3,"12",60,"Quadril colado no banco"],
    ["Panturrilha em pé",4,"15",45,"Amplitude total"],
    ["Panturrilha sentado",3,"15",45,"Pausa embaixo"]]},
   {"nome":"D · Ombros, trapézio e abdômen","foco":"Ombros, trapézio e core","exs":[
    ["Desenvolvimento com halteres",4,"10",90,"Não arqueie a lombar"],
    ["Elevação lateral",4,"12",45,"Até a linha do ombro"],
    ["Elevação frontal",3,"12",45,"Sem impulso"],
    ["Crucifixo inverso na máquina",3,"12",60,"Foco no posterior do ombro"],
    ["Encolhimento com halteres",4,"12",45,"Segure 1s em cima"],
    ["Abdominal infra",3,"15",45,"Desça as pernas devagar"],
    ["Prancha",3,"40s",45,"Corpo alinhado"]]}]},

 {"key":"m-av-abcde","audience":"M","level":"Avançado","split":"ABCDE","dpw":5,"sort":5,
  "label":"Avançado · ABCDE","objective":"Hipertrofia",
  "description":"Um grupo por dia, 5x por semana: peito, costas, pernas, ombros e trapézio, braços e abdômen.",
  "days":[
   {"nome":"A · Peito","foco":"Peito","exs":[
    ["Supino reto com barra",4,"6-8",120,"Aquecimento antes das séries pesadas"],
    ["Supino inclinado com barra",4,"8-10",90,"Banco a 30°"],
    ["Supino Declinado com Halteres",3,"10",90,"Controle na descida"],
    ["Crucifixo Inclinado com Halteres",3,"12",60,"Alongue bem embaixo"],
    ["Crucifixo no Crossover (Polia Alta)",3,"12-15",60,"Cruze as mãos no final"],
    ["Fundos (Paralelas)",3,"10-12",90,"Tronco à frente para o peito"]]},
   {"nome":"B · Costas","foco":"Costas e lombar","exs":[
    ["Barra Fixa",4,"6-10",120,"Se precisar, use a assistida"],
    ["Remada curvada com barra",4,"8",90,"Coluna neutra"],
    ["Puxada Alta Fechada",3,"10",60,"Puxe até o peito"],
    ["Remada serrote (1 halter)",3,"10",60,"Cotovelo rente ao corpo"],
    ["Pulldown Braços Estendidos",3,"12",60,"Braços quase retos"],
    ["Hiperextensão lombar",3,"15",60,"Sem passar da linha do corpo"]]},
   {"nome":"C · Pernas","foco":"Quadríceps, posterior e panturrilha","exs":[
    ["Agachamento livre",5,"6-8",150,"Profundidade com técnica"],
    ["Leg press 45°",4,"10",90,"Amplitude completa"],
    ["Agachamento Búlgaro",3,"10",90,"Cada perna"],
    ["Cadeira extensora",3,"12-15",60,"Última série até a falha"],
    ["Stiff com barra",4,"8-10",90,"Coluna neutra"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Panturrilha em pé",4,"12-15",45,"Pausa embaixo"]]},
   {"nome":"D · Ombros e trapézio","foco":"Ombros e trapézio","exs":[
    ["Desenvolvimento militar",4,"8",120,"Abdômen firme"],
    ["Desenvolvimento Arnold",3,"10",90,"Gire durante a subida"],
    ["Elevação lateral",4,"12-15",45,"Até a linha do ombro"],
    ["Elevação Lateral na Polia",3,"12",45,"Unilateral"],
    ["Crucifixo invertido",3,"12",60,"Posterior do ombro"],
    ["Encolhimento de Ombros (Shrug)",4,"10-12",60,"Segure 1s em cima"]]},
   {"nome":"E · Braços e abdômen","foco":"Bíceps, tríceps e core","exs":[
    ["Rosca direta com barra",4,"8-10",60,"Sem balançar"],
    ["Rosca Scott com Halteres",3,"10",60,"Extensão completa embaixo"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"],
    ["Tríceps testa",4,"8-10",60,"Cotovelos fixos"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Tríceps francês halter",3,"10",60,"Cotovelos para cima"],
    ["Abdominal na polia",4,"15",45,"Enrole a coluna"],
    ["Elevação de pernas",3,"15",45,"Sem balanço"]]}]},

 {"key":"f-ini-ab","audience":"F","level":"Iniciante","split":"AB","dpw":3,"sort":1,
  "label":"Iniciante · AB","objective":"Adaptação",
  "description":"Para começar: inferiores e glúteo num dia, superiores e abdômen no outro. Alterne A e B, 3x por semana.",
  "days":[
   {"nome":"A · Inferiores e glúteo","foco":"Pernas, glúteo e panturrilha","exs":[
    ["Leg press 45°",3,"12",90,"Pés na largura do quadril"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Cadeira flexora",3,"12",60,"Quadril colado no banco"],
    ["Elevação Pélvica",3,"12",60,"Aperte o glúteo em cima"],
    ["Cadeira Abdutora",3,"15",45,"Segure 1s aberta"],
    ["Panturrilha em pé",3,"15",45,"Amplitude total"]]},
   {"nome":"B · Superiores e abdômen","foco":"Costas, peito, ombros, braços e core","exs":[
    ["Puxada frontal (pulldown)",3,"12",60,"Puxe até o queixo"],
    ["Remada na máquina",3,"12",60,"Junte as escápulas"],
    ["Supino na máquina",3,"12",60,"Controle na volta"],
    ["Desenvolvimento na máquina",3,"12",60,"Sem travar os cotovelos"],
    ["Tríceps Pulley",3,"12",60,"Cotovelos colados no corpo"],
    ["Rosca Direta com Halteres",3,"12",60,"Sem balançar"],
    ["Abdominal crunch",3,"15",45,"Solte o ar ao subir"]]}]},

 {"key":"f-ini-abc","audience":"F","level":"Iniciante","split":"ABC","dpw":3,"sort":2,
  "label":"Iniciante · ABC","objective":"Hipertrofia",
  "description":"Quadríceps e glúteo, superiores, posterior e glúteo. O ABC feminino mais pedido, 3x por semana.",
  "days":[
   {"nome":"A · Quadríceps e glúteo","foco":"Quadríceps, glúteo e panturrilha","exs":[
    ["Agachamento livre",3,"12",90,"Comece sem carga, só a barra"],
    ["Leg press 45°",3,"12",90,"Amplitude completa"],
    ["Cadeira extensora",3,"15",60,"Segure 1s em cima"],
    ["Afundo com halteres",3,"10",60,"Cada perna, tronco reto"],
    ["Cadeira Abdutora",3,"15",45,"Segure 1s aberta"],
    ["Panturrilha em pé",3,"15",45,"Amplitude total"]]},
   {"nome":"B · Superiores","foco":"Costas, ombros e braços","exs":[
    ["Puxada frontal (pulldown)",3,"12",60,"Peito aberto"],
    ["Remada Baixa (Cabo)",3,"12",60,"Puxe até o umbigo"],
    ["Desenvolvimento com halteres",3,"12",60,"Não arqueie a lombar"],
    ["Elevação lateral",3,"12",45,"Até a linha do ombro"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"]]},
   {"nome":"C · Posterior, glúteo e abdômen","foco":"Posterior, glúteo e core","exs":[
    ["Stiff com barra",3,"12",90,"Barra rente às pernas"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Elevação Pélvica com Barra (Hip Thrust)",3,"12",90,"Queixo no peito, aperte o glúteo"],
    ["Glúteo Coice na Polia (Kickback)",3,"12",45,"Cada perna, sem girar o quadril"],
    ["Abdominal infra",3,"15",45,"Desça as pernas devagar"],
    ["Prancha",3,"30s",45,"Corpo alinhado"]]}]},

 {"key":"f-int-abc","audience":"F","level":"Intermediário","split":"ABC","dpw":3,"sort":3,
  "label":"Intermediário · ABC glúteo em foco","objective":"Hipertrofia",
  "description":"Mais volume para pernas e glúteo, com superiores num dia só. 3x por semana ou ABC ABC.",
  "days":[
   {"nome":"A · Quadríceps e glúteo","foco":"Quadríceps, glúteo e panturrilha","exs":[
    ["Agachamento livre",4,"10",120,"Desça até a coxa paralela"],
    ["Leg press 45°",4,"12",90,"Pés altos para mais glúteo"],
    ["Agachamento Búlgaro",3,"10",90,"Cada perna"],
    ["Cadeira extensora",4,"12-15",60,"Última série até a falha"],
    ["Cadeira Abdutora",4,"15",45,"Tronco à frente para mais glúteo"],
    ["Panturrilha em pé",4,"15",45,"Pausa embaixo"]]},
   {"nome":"B · Superiores e abdômen","foco":"Costas, ombros, braços e core","exs":[
    ["Puxada frontal (pulldown)",4,"10",90,"Peito aberto"],
    ["Remada curvada com barra",3,"10",90,"Coluna neutra"],
    ["Remada serrote (1 halter)",3,"12",60,"Cotovelo rente ao corpo"],
    ["Desenvolvimento com halteres",3,"10",60,"Abdômen firme"],
    ["Elevação lateral",4,"12",45,"Até a linha do ombro"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Rosca direta com barra",3,"12",60,"Sem balançar"],
    ["Crunch no Solo",3,"15",45,"Movimento controlado"]]},
   {"nome":"C · Posterior e glúteo","foco":"Glúteo, posterior e core","exs":[
    ["Elevação Pélvica com Barra (Hip Thrust)",4,"10",90,"Segure 1s em cima"],
    ["Stiff com barra",4,"10",90,"Alongue o posterior"],
    ["Mesa Flexora",4,"12",60,"Quadril colado no banco"],
    ["Glúteo coice na máquina",3,"12",45,"Cada perna"],
    ["Abdução de quadril",3,"15",45,"Movimento controlado"],
    ["Elevação pélvica unilateral",3,"12",60,"Cada perna"],
    ["Prancha lateral",3,"30s",45,"Cada lado"]]}]},

 {"key":"f-int-abcd","audience":"F","level":"Intermediário","split":"ABCD","dpw":4,"sort":4,
  "label":"Intermediário · ABCD","objective":"Hipertrofia",
  "description":"4x por semana: quadríceps, costas e ombros, glúteo e posterior, peito, tríceps e abdômen.",
  "days":[
   {"nome":"A · Quadríceps","foco":"Quadríceps e panturrilha","exs":[
    ["Agachamento livre",4,"10",120,"Joelho alinhado ao pé"],
    ["Agachamento Hack na Máquina (Hack Squat)",4,"10",90,"Desça controlando"],
    ["Leg press 45°",4,"12",90,"Amplitude completa"],
    ["Cadeira extensora",4,"12-15",60,"Segure 1s em cima"],
    ["Afundo com halteres",3,"10",60,"Cada perna"],
    ["Panturrilha sentado",4,"15",45,"Pausa embaixo"]]},
   {"nome":"B · Costas, ombros e bíceps","foco":"Costas, ombros e bíceps","exs":[
    ["Puxada frontal (pulldown)",4,"10",90,"Peito aberto"],
    ["Remada Baixa (Cabo)",4,"10",60,"Puxe até o umbigo"],
    ["Remada serrote (1 halter)",3,"12",60,"Cotovelo rente ao corpo"],
    ["Desenvolvimento com halteres",3,"10",60,"Não arqueie a lombar"],
    ["Elevação lateral",4,"12",45,"Até a linha do ombro"],
    ["Rosca alternada com halteres",3,"12",60,"Gire o punho ao subir"]]},
   {"nome":"C · Glúteo e posterior","foco":"Glúteo e posterior","exs":[
    ["Elevação Pélvica com Barra (Hip Thrust)",4,"10",90,"Segure 1s em cima"],
    ["Stiff com barra",4,"10",90,"Coluna neutra"],
    ["Cadeira flexora",4,"12",60,"Desça devagar"],
    ["Glúteo Coice na Polia (Kickback)",3,"12",45,"Cada perna"],
    ["Cadeira Abdutora",4,"15",45,"Segure 1s aberta"],
    ["Elevação pélvica unilateral",3,"12",60,"Cada perna"]]},
   {"nome":"D · Peito, tríceps e abdômen","foco":"Peito, tríceps e core","exs":[
    ["Supino reto com halteres",3,"12",60,"Escápulas juntas"],
    ["Crucifixo com halteres",3,"12",60,"Cotovelos levemente flexionados"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Tríceps francês halter",3,"12",60,"Cotovelos para cima"],
    ["Abdominal infra",3,"15",45,"Desça as pernas devagar"],
    ["Abdominal oblíquo",3,"15",45,"Cada lado"],
    ["Prancha",3,"40s",45,"Corpo alinhado"]]}]},

 {"key":"f-av-abcde","audience":"F","level":"Avançado","split":"ABCDE","dpw":5,"sort":5,
  "label":"Avançado · ABCDE","objective":"Hipertrofia",
  "description":"5x por semana: quadríceps, costas e bíceps, glúteo, ombros e tríceps, posterior e glúteo.",
  "days":[
   {"nome":"A · Quadríceps","foco":"Quadríceps e panturrilha","exs":[
    ["Agachamento livre",4,"8-10",120,"Profundidade com técnica"],
    ["Agachamento Hack na Máquina (Hack Squat)",4,"10",90,"Desça controlando"],
    ["Leg press 45°",4,"12",90,"Amplitude completa"],
    ["Agachamento Búlgaro",3,"10",90,"Cada perna"],
    ["Cadeira extensora",4,"15",60,"Última série até a falha"],
    ["Panturrilha em pé",4,"15",45,"Pausa embaixo"]]},
   {"nome":"B · Costas e bíceps","foco":"Costas e bíceps","exs":[
    ["Barra fixa assistida",4,"8-10",90,"Peito em direção à barra"],
    ["Remada curvada com barra",4,"10",90,"Coluna neutra"],
    ["Puxada com Triângulo",3,"12",60,"Puxe até o peito"],
    ["Remada serrote (1 halter)",3,"10",60,"Cotovelo rente ao corpo"],
    ["Rosca direta com barra",3,"10",60,"Sem balançar"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"]]},
   {"nome":"C · Glúteo","foco":"Glúteo","exs":[
    ["Elevação Pélvica com Barra (Hip Thrust)",5,"8-10",90,"Carga alta, segure 1s em cima"],
    ["Agachamento Sumô",4,"10",90,"Pés afastados, pontas para fora"],
    ["Glúteo coice na máquina",4,"12",45,"Cada perna"],
    ["Cadeira Abdutora",4,"15-20",45,"Tronco à frente"],
    ["Abdução de quadril",3,"15",45,"Movimento controlado"],
    ["Elevação pélvica unilateral",3,"12",60,"Cada perna"]]},
   {"nome":"D · Ombros, tríceps e abdômen","foco":"Ombros, tríceps e core","exs":[
    ["Desenvolvimento com halteres",4,"10",90,"Abdômen firme"],
    ["Elevação lateral",4,"12-15",45,"Até a linha do ombro"],
    ["Elevação Posterior no Cabo",3,"12",45,"Posterior do ombro"],
    ["Tríceps na polia (corda)",4,"12",60,"Abra a corda no final"],
    ["Tríceps testa",3,"10",60,"Cotovelos fixos"],
    ["Abdominal na polia",4,"15",45,"Enrole a coluna"],
    ["Prancha",3,"45s",45,"Corpo alinhado"]]},
   {"nome":"E · Posterior e glúteo","foco":"Posterior, glúteo e panturrilha","exs":[
    ["Stiff com barra",4,"8-10",90,"Alongue o posterior"],
    ["Mesa Flexora",4,"12",60,"Quadril colado no banco"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Levantamento terra sumô",3,"8",120,"Coluna neutra, empurre o chão"],
    ["Elevação Pélvica",3,"12",60,"Pausa em cima"],
    ["Panturrilha sentado",4,"15",45,"Pausa embaixo"]]}]}
]$json$::jsonb
$_$;


--
-- Name: bump_leaderboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_leaderboard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  begin
    perform public.recompute_leaderboard(NEW.student_id, NEW.gym_id);
  exception when others then
    raise warning 'bump_leaderboard falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: cardio_weekly(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cardio_weekly(p_gym_id uuid) RETURNS TABLE(student_id uuid, minutes integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select student_id, sum(minutes)::int as minutes
  from public.cardio_logs
  where gym_id = p_gym_id and date >= date_trunc('week', now())
  group by student_id
  order by minutes desc
  limit 10;
$$;


--
-- Name: challenge_board(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.challenge_board(p_challenge uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with me as (select id, gym_id from public.profiles where id = auth.uid()),
  c as (
    select ch.* from public.challenges ch, me where ch.id = p_challenge and ch.gym_id = me.gym_id
  ),
  part as (
    select cp.student_id from public.challenge_participants cp, c where cp.challenge_id = c.id
  ),
  days as (
    select x.sid, count(distinct x.d)::int as days
    from (
      select wl.student_id sid, public.local_day(wl.date) d
      from public.workout_logs wl join part on part.student_id = wl.student_id
      union
      select ck.student_id, public.local_day(ck.checked_at)
      from public.checkins ck join part on part.student_id = ck.student_id
      where ck.type = 'entrada'
    ) x, c
    where x.d between c.starts_on and least(c.ends_on, (now() at time zone 'America/Sao_Paulo')::date)
    group by x.sid
  ),
  ranked as (
    select part.student_id as id, coalesce(days.days, 0) as days,
      rank() over (order by coalesce(days.days, 0) desc) as rk,
      (part.student_id = (select id from me)) as is_me
    from part left join days on days.sid = part.student_id
  )
  select jsonb_build_object(
    'participants', (select count(*) from part),
    'joined', exists (select 1 from part where student_id = (select id from me)),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id, 'name', (public.athlete_display(r.id)).disp,
          'avatar_url', p.avatar_url, 'days', r.days, 'rank', r.rk, 'me', r.is_me
        ) order by r.rk, (public.athlete_display(r.id)).disp)
      from ranked r join public.profiles p on p.id = r.id
      where r.rk <= 50 or r.is_me
    ), '[]'::jsonb)
  )
  where exists (select 1 from c);
$$;


--
-- Name: choose_personal(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.choose_personal(p_trainer_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: close_checkin(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_checkin(p_session_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'app'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_source text := case when p_source in ('app','nfc','qrcode') then p_source else 'app' end;
  v_entry_id uuid;
  v_entry_session uuid;
  v_checked_at timestamptz;
  v_existing_saida boolean;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  select gym_id into v_gym from public.profiles where id = v_uid;
  if v_gym is null then
    raise exception 'Perfil sem academia';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  if p_session_id is not null then
    select true into v_existing_saida
    from public.checkins
    where workout_session_id = p_session_id and type = 'saida'
    limit 1;

    if v_existing_saida is not null then
      return jsonb_build_object('ok', true, 'closed', true, 'already_closed', true);
    end if;
  end if;

  select c.id, c.workout_session_id, c.checked_at
    into v_entry_id, v_entry_session, v_checked_at
  from public.checkins c
  where c.student_id = v_uid
    and c.gym_id = v_gym
    and c.type = 'entrada'
    and (c.checked_at at time zone 'America/Sao_Paulo')::date
      = (now() at time zone 'America/Sao_Paulo')::date
    and not exists (
      select 1 from public.checkins s
      where s.student_id = c.student_id
        and s.gym_id = c.gym_id
        and s.type = 'saida'
        and s.checked_at > c.checked_at
    )
  order by c.checked_at desc
  limit 1;

  if v_entry_id is null then
    return jsonb_build_object('ok', true, 'closed', false, 'already_closed', true);
  end if;

  insert into public.checkins (gym_id, student_id, type, source, checked_at, workout_session_id)
  values (v_gym, v_uid, 'saida', v_source, now(), coalesce(p_session_id, v_entry_session));

  update public.workout_sessions
  set status = 'completed',
      ended_at = now(),
      meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('finished_by', 'student')
  where id = coalesce(p_session_id, v_entry_session)
    and status = 'active';

  return jsonb_build_object('ok', true, 'closed', true, 'checkin_id', v_entry_id, 'checked_at', v_checked_at);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'closed', true, 'already_closed', true);
end;
$$;


--
-- Name: copy_template_for_student(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.copy_template_for_student(p_template uuid, p_student uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  st record;
  t record;
  prog record;
  d record;
  n integer;
  nd integer;
  v_first text;
  v_draft jsonb;
  v_days text[];
  v_program uuid;
  v_day uuid;
begin
  select id, gym_id, name, available_days into st from public.profiles where id = p_student;
  select * into t from public.starter_templates where id = p_template and gym_id = st.gym_id;
  if t.id is null then
    raise exception 'Modelo não encontrado';
  end if;
  select * into prog from public.workout_programs where id = t.program_id;
  select count(*) into nd from public.workout_days where program_id = prog.id;

  n := coalesce(array_length(st.available_days, 1), 0);
  v_first := split_part(coalesce(nullif(trim(st.name), ''), 'Aluno'), ' ', 1);

  begin
    v_draft := prog.ai_draft::jsonb;
  exception when others then
    v_draft := null;
  end;
  if v_draft is not null and n = nd then
    select array_agg(x order by public.weekday_number(x)) into v_days
    from unnest(st.available_days) x where public.weekday_number(x) is not null;
    if coalesce(array_length(v_days, 1), 0) = nd then
      v_draft := jsonb_set(v_draft, '{daysSelected}', to_jsonb(v_days));
    end if;
  end if;
  if v_draft is not null then
    v_draft := jsonb_set(v_draft, '{nome}', to_jsonb(prog.name || ' · ' || v_first));
  end if;

  -- o treino anterior que veio de modelo vira histórico
  update public.student_workouts sw
  set status = 'completed', completed_at = now()
  from public.workout_programs wp
  where sw.student_id = p_student and sw.status = 'active'
    and wp.id = sw.program_id and wp.created_via = 'template';

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

  insert into public.student_workouts (gym_id, student_id, program_id, status)
  values (st.gym_id, p_student, v_program, 'active');

  return v_program;
end;
$$;


--
-- Name: current_gym_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_gym_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select gym_id from public.profiles where id = auth.uid();
$$;


--
-- Name: current_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public."current_role"() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role from public.profiles where id = auth.uid();
$$;


--
-- Name: day_streak(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.day_streak(p_student uuid) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  d date := today;
  s integer := 0;
  scheduled integer[] := public.student_scheduled_days(p_student);
  trained date[];
  used jsonb := '{}'::jsonb;  -- reposições já usadas por semana
  wk text;
  makeups integer;
  guard integer := 0;
begin
  select coalesce(array_agg(distinct public.local_day(date)), array[]::date[])
    into trained
  from public.workout_logs
  where student_id = p_student
    and date >= (today - 400)::timestamp at time zone 'America/Sao_Paulo';

  -- Hoje ainda sem treino não quebra: a sequência conta até ontem.
  if not (today = any(trained)) then
    d := d - 1;
  end if;

  while guard < 400 loop
    guard := guard + 1;

    if d = any(trained) then
      s := s + 1;
      d := d - 1;
      continue;
    end if;

    -- Descanso.
    if not (extract(isodow from d)::int = any(scheduled)) then
      d := d - 1;
      continue;
    end if;

    -- Dia marcado perdido: tenta usar reposição da semana.
    wk := date_trunc('week', d)::date::text;
    select count(*) into makeups
    from unnest(trained) t
    where date_trunc('week', t)::date = date_trunc('week', d)::date
      and t <= today
      and not (extract(isodow from t)::int = any(scheduled));

    exit when makeups - coalesce((used ->> wk)::int, 0) <= 0;

    used := jsonb_set(used, array[wk], to_jsonb(coalesce((used ->> wk)::int, 0) + 1));
    d := d - 1;
  end loop;

  return s;
end;
$$;


--
-- Name: default_profile_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.default_profile_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare localpart text;
begin
  if NEW.name is null or trim(NEW.name) = '' then
    localpart := split_part(coalesce(NEW.email, ''), '@', 1);
    localpart := regexp_replace(localpart, '[^A-Za-zÀ-ú ]', ' ', 'g');
    localpart := trim(regexp_replace(localpart, '\s+', ' ', 'g'));
    if localpart = '' then localpart := 'Aluno'; end if;
    NEW.name := localpart;
  end if;
  return NEW;
end;
$$;


--
-- Name: default_week_days(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.default_week_days(p_n integer) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_n
    when 1 then array['Seg']
    when 2 then array['Seg','Qui']
    when 3 then array['Seg','Qua','Sex']
    when 4 then array['Seg','Ter','Qui','Sex']
    when 5 then array['Seg','Ter','Qua','Qui','Sex']
    when 6 then array['Seg','Ter','Qua','Qui','Sex','Sáb']
    else array['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
  end;
$$;


--
-- Name: delete_user_data(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_data(p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  -- ordem: filhas primeiro (workout_logs aponta para sessões e fichas)
  targets text[][] := array[
    ['direct_messages', 'sender_id'],
    ['conversations', 'student_id'],
    ['conversations', 'staff_id'],
    ['workout_logs', 'student_id'],
    ['slot_checks', 'student_id'],
    ['cardio_logs', 'student_id'],
    ['progress_photos', 'student_id'],
    ['checkins', 'student_id'],
    ['equipment_sessions', 'student_id'],
    ['workout_sessions', 'student_id'],
    ['student_workouts', 'student_id'],
    ['premium_requests', 'student_id'],
    ['body_metrics', 'student_id'],
    ['leaderboard', 'student_id'],
    ['student_achievements', 'student_id'],
    ['student_trainers', 'student_id'],
    ['student_subscriptions', 'student_id'],
    ['medical_clearances', 'student_id'],
    ['point_events', 'student_id'],
    ['notifications', 'user_id'],
    ['notification_settings', 'user_id'],
    ['push_subscriptions', 'user_id'],
    ['feed_likes', 'user_id'],
    ['feed_comments', 'user_id'],
    ['squad_messages', 'user_id'],
    ['squad_members', 'user_id'],
    ['feed_posts', 'author_id'],
    ['ai_generation_logs', 'user_id']
  ];
  i int;
  v_gym uuid;
  v_heir uuid;
begin
  if p_user is null then
    raise exception 'p_user obrigatório';
  end if;

  -- Staff: o que ele criou passa para outra pessoa da equipe da academia
  -- (gerente/admin primeiro). Assim nenhum aluno perde a ficha.
  select gym_id into v_gym from public.profiles where id = p_user;
  select id into v_heir
  from public.profiles
  where gym_id is not distinct from v_gym
    and id <> p_user
    and role in ('manager', 'admin', 'trainer')
  order by case role when 'admin' then 0 when 'manager' then 1 else 2 end, created_at
  limit 1;

  if exists (select 1 from public.workout_programs where trainer_id = p_user)
     or exists (select 1 from public.equipment_maintenance_logs where requested_by = p_user) then
    if v_heir is null then
      raise exception 'Não há outra pessoa da equipe para receber as fichas deste personal';
    end if;
    update public.workout_programs set trainer_id = v_heir where trainer_id = p_user;
    update public.equipment_maintenance_logs set requested_by = v_heir where requested_by = p_user;
  end if;

  update public.gym_motivation set updated_by = null where updated_by = p_user;
  delete from public.student_trainers where trainer_id = p_user;

  for i in 1 .. array_length(targets, 1) loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = targets[i][1]
        and column_name = targets[i][2]
    ) then
      execute format('delete from public.%I where %I = $1', targets[i][1], targets[i][2])
        using p_user;
    end if;
  end loop;

  delete from public.profiles where id = p_user;
end;
$_$;


--
-- Name: dispatch_push(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dispatch_push() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_url text;
begin
  if NEW.pushed_at is not null then
    return NEW;
  end if;
  select value into v_url from public.app_config where key = 'push_dispatch_url';
  if v_url is null or to_regnamespace('net') is null then
    return NEW;
  end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using v_url, jsonb_build_object('id', NEW.id), '{"Content-Type": "application/json"}'::jsonb;
  exception when others then
    raise warning 'dispatch_push falhou: %', sqlerrm;
  end;
  return NEW;
end;
$_$;


--
-- Name: enforce_medical_clearance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_medical_clearance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.medical_risk and not exists (
    select 1 from public.medical_clearances mc
    where mc.student_id = new.id and mc.approved and mc.gym_id = new.gym_id
  ) then
    new.status = 'pending_clearance';
  end if;
  return new;
end;
$$;


--
-- Name: enqueue_starter_campaign(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_starter_campaign(p_gym uuid, p_start timestamp with time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r record;
  i integer := 0;
  slot timestamptz := public.next_business_slot(p_start);
  batch_start timestamptz;
  phone text;
  first text;
  n integer := 0;
begin
  for r in
    select p.id, p.name, p.phone
    from public.profiles p
    where p.gym_id = p_gym and p.role = 'student'
      and coalesce(p.whatsapp_consent, false)
      and p.phone is not null
      and not exists (select 1 from public.student_workouts sw where sw.student_id = p.id and sw.status = 'active')
      and not exists (select 1 from public.whatsapp_outbox o where o.campaign = 'treino-pronto' and o.student_id = p.id)
    order by p.approved_at desc nulls last, p.created_at desc
  loop
    phone := regexp_replace(r.phone, '\D', '', 'g');
    phone := regexp_replace(phone, '^0+', '');
    if length(phone) in (10, 11) then
      phone := '55' || phone;
    end if;
    if not (phone like '55%' and length(phone) in (12, 13)) then
      continue;
    end if;

    -- novo lote a cada 2 pessoas: ~3h depois (+ até 40 min aleatórios)
    if i % 2 = 0 then
      if i > 0 then
        slot := slot + interval '3 hours' + (random() * interval '40 minutes');
      end if;
      slot := public.next_business_slot(slot);
      -- lote que começaria muito perto das 20h vai para a manhã seguinte
      if extract(hour from (slot at time zone 'America/Sao_Paulo')) >= 19 then
        slot := public.next_business_slot(slot + interval '2 hours');
      end if;
      batch_start := slot;
    end if;

    first := initcap(lower(split_part(coalesce(nullif(trim(r.name), ''), 'tudo bem'), ' ', 1)));
    insert into public.whatsapp_outbox (gym_id, student_id, campaign, phone, body, scheduled_at)
    values (p_gym, r.id, 'treino-pronto', phone,
      public.starter_campaign_message(first, i),
      -- 2º da dupla sai alguns minutos depois do 1º
      batch_start + case when i % 2 = 1 then interval '3 minutes' + random() * interval '5 minutes' else interval '0' end)
    on conflict (campaign, student_id) do nothing;
    i := i + 1;
    n := n + 1;
  end loop;
  return n;
end;
$$;


--
-- Name: finish_onboarding(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_onboarding() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: fmt_brl(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fmt_brl(p_cents integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  select case when p_cents is null then 'valor a combinar'
    else 'R$ ' || replace(to_char(p_cents / 100.0, 'FM9999990.00'), '.', ',') end;
$_$;


--
-- Name: fmt_kg(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fmt_kg(p numeric) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case when p = trunc(p) then trunc(p)::text
              else rtrim(rtrim(round(p, 2)::text, '0'), '.') end;
$$;


--
-- Name: generate_day_pass_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_day_pass_code() RETURNS text
    LANGUAGE sql
    AS $$
  select 'DP-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
$$;


--
-- Name: get_or_create_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_conversation(p_other_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  me uuid := auth.uid();
  my_role text;
  my_gym uuid;
  o_role text;
  o_gym uuid;
  o_student uuid;
  o_staff uuid;
  cid uuid;
begin
  select role, gym_id into my_role, my_gym from public.profiles where id = me;
  select role, gym_id into o_role, o_gym from public.profiles where id = p_other_id;
  if my_role is null or o_role is null or my_gym is null or o_gym is null or my_gym <> o_gym then
    raise exception 'Conversa indisponível.';
  end if;

  if my_role = 'student' and o_role in ('trainer', 'manager', 'admin') then
    o_student := me;
    o_staff := p_other_id;
    if o_role = 'trainer' and not exists (
      select 1 from public.student_trainers
      where student_id = me and trainer_id = p_other_id
    ) then
      raise exception 'Fale com seu personal vinculado.';
    end if;
  elsif my_role in ('trainer', 'manager', 'admin') and o_role = 'student' then
    o_student := p_other_id;
    o_staff := me;
    if my_role = 'trainer' and not exists (
      select 1 from public.student_trainers
      where student_id = p_other_id and trainer_id = me
    ) then
      raise exception 'Aluno sem vínculo com você.';
    end if;
  else
    raise exception 'Conversa indisponível.';
  end if;

  insert into public.conversations (gym_id, student_id, staff_id)
  values (my_gym, o_student, o_staff)
  on conflict (student_id, staff_id) do update set updated_at = now()
  returning id into cid;
  return cid;
end;
$$;


--
-- Name: grant_achievement(uuid, uuid, text, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_achievement(p_gym uuid, p_student uuid, p_code text, p_disp text, p_first text, p_action text, p_post boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  aid uuid;
  aname text;
  apoints integer;
  inserted_count integer;
begin
  select id, name, coalesce(points, 0) into aid, aname, apoints
  from public.achievements where code = p_code and gym_id is null;
  if aid is null then
    return;
  end if;

  insert into public.student_achievements (gym_id, student_id, achievement_id)
  values (p_gym, p_student, aid)
  on conflict (student_id, achievement_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return;
  end if;

  if apoints > 0 then
    insert into public.point_events (gym_id, student_id, source, points, dedupe_key)
    values (p_gym, p_student, 'achievement', apoints, 'ach:' || p_student || ':' || p_code)
    on conflict (dedupe_key) do nothing;
    perform public.recompute_leaderboard(p_student, p_gym);
  end if;

  insert into public.notifications (gym_id, user_id, channel, title, body)
  values (p_gym, p_student, 'in_app', 'Conquista liberada: ' || aname,
    'Você ganhou ' || aname
      || case when apoints > 0 then ' (+' || apoints || ' pontos)' else '' end
      || '. Já está no feed: a galera pode curtir e comentar.');

  -- p_post ficou só por compatibilidade: toda conquista vai pro feed
  perform public.system_feed_post(p_gym, p_student,
    p_disp || ' ' || p_action || ' 🏆 ' || aname || '. Parabéns, ' || p_first || '! 🎉');
exception when others then
  raise warning 'grant_achievement falhou: %', sqlerrm;
end;
$$;


--
-- Name: guard_profile_privileged(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_profile_privileged() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'student';
    new.approved_at := null;
    if new.status is distinct from 'active' then
      new.status := 'active'; -- trg_profiles_medical ainda marca pending_clearance se houver risco
    end if;
    return new;
  end if;

  -- UPDATE: valores sensíveis voltam ao que eram (sem erro, para não quebrar
  -- telas que mandam a linha inteira com os mesmos valores)
  new.role        := old.role;
  new.gym_id      := old.gym_id;
  new.status      := old.status;
  new.approved_at := old.approved_at;
  return new;
end;
$$;


--
-- Name: gym_online_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gym_online_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with g as (
    select public.current_gym_id() as gym_id
  ),
  sess as (
    select s.student_id
    from public.equipment_sessions s, g
    where s.gym_id = g.gym_id
      and s.status = 'active'
      and s.started_at >= now() - interval '3 hours'
  ),
  ultimo_checkin as (
    select distinct on (c.student_id) c.student_id, c.type
    from public.checkins c, g
    where c.gym_id = g.gym_id
      and c.checked_at >= now() - interval '3 hours'
    order by c.student_id, c.checked_at desc
  )
  select count(*)::integer
  from (
    select student_id from sess
    union
    select student_id from ultimo_checkin where type = 'entrada'
  ) presentes;
$$;


--
-- Name: gym_personals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gym_personals() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with me as (select gym_id from public.profiles where id = auth.uid()),
  staff as (
    select p.id, p.name, p.bio, p.avatar_url, p.phone, p.role, p.created_at
    from public.profiles p, me
    where p.gym_id = me.gym_id and p.role in ('trainer', 'manager', 'admin')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', staff.id, 'name', staff.name, 'bio', staff.bio, 'avatar_url', staff.avatar_url,
      'phone', staff.phone, 'role', staff.role,
      'offers', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', o.id, 'title', o.title, 'description', o.description,
            'price_cents', o.price_cents, 'sessions_per_week', o.sessions_per_week,
            'duration_label', o.duration_label,
            'promo_price_cents', case when public.offer_promo_valid(o.promo_price_cents, o.promo_until) then o.promo_price_cents end,
            'promo_label', case when public.offer_promo_valid(o.promo_price_cents, o.promo_until) then coalesce(o.promo_label, 'Promoção') end,
            'promo_until', case when public.offer_promo_valid(o.promo_price_cents, o.promo_until) then o.promo_until end
          ) order by o.sort, o.created_at), '[]'::jsonb)
        from public.personal_offers o
        where o.trainer_id = staff.id and o.active
      )
    ) order by (staff.role = 'trainer') desc, staff.created_at), '[]'::jsonb)
  from staff;
$$;


--
-- Name: gym_roster(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gym_roster(p_gym_id uuid) RETURNS TABLE(id uuid, name text, avatar_url text, role text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id, p.name, p.avatar_url, p.role
  from public.profiles p
  where p.gym_id = p_gym_id
    and p.role in ('student', 'trainer', 'manager', 'admin')
    and (p.role <> 'student' or p.approved_at is not null)
  order by p.name;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: invite_train_together(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invite_train_together(p_invitee uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_me uuid := auth.uid();
  v_gym uuid;
  v_key text;
begin
  if v_me is null or v_me = p_invitee then
    return jsonb_build_object('ok', false, 'error', 'convite inválido');
  end if;
  select gym_id into v_gym from public.profiles where id = v_me;
  if v_gym is null then return jsonb_build_object('ok', false, 'error', 'sem academia'); end if;

  v_key := 'together:'||least(v_me, p_invitee)||':'||greatest(v_me, p_invitee)||':'||current_date;
  perform public.add_points(v_gym, v_me, 'together', 30, v_key||':'||v_me, 'chamar alguém para treinar junto');
  perform public.add_points(v_gym, p_invitee, 'together', 30, v_key||':'||p_invitee, 'treinar junto com um amigo');
  return jsonb_build_object('ok', true);
end;
$$;


--
-- Name: join_challenge(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_challenge(p_challenge uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  st record;
  c record;
  n record;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select id, gym_id, role into st from public.profiles where id = v_uid;
  if st.id is null or st.role <> 'student' then
    raise exception 'Sem permissão';
  end if;
  select * into c from public.challenges where id = p_challenge and gym_id = st.gym_id and active;
  if c.id is null then
    return jsonb_build_object('ok', false, 'reason', 'indisponivel');
  end if;
  if today > c.ends_on then
    return jsonb_build_object('ok', false, 'reason', 'encerrado');
  end if;

  insert into public.challenge_participants (challenge_id, student_id, gym_id)
  values (c.id, v_uid, st.gym_id)
  on conflict do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ja_participa');
  end if;

  n := public.athlete_display(v_uid);
  perform public.system_feed_post(st.gym_id, v_uid,
    n.disp || ' entrou no ' || c.title || ' 🔥 Meta: ' || c.goal_days || ' dias de treino até '
    || to_char(c.ends_on, 'DD/MM') || '. Bora junto? Entra também pelo app!');
  insert into public.notifications (gym_id, user_id, channel, title, body)
  values (st.gym_id, v_uid, 'in_app', 'Você está no ' || c.title,
    'Meta: ' || c.goal_days || ' dias de treino até ' || to_char(c.ends_on, 'DD/MM')
    || '. Cada dia treinado conta no ranking. Bora!');

  return jsonb_build_object('ok', true);
end;
$$;


--
-- Name: list_my_gym_trainers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_my_gym_trainers() RETURNS TABLE(id uuid, name text, avatar_url text, role text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id, p.name, p.avatar_url, p.role
  from public.profiles p
  where p.gym_id = (select gym_id from public.profiles where id = auth.uid())
    and p.role in ('trainer', 'manager', 'admin')
    and p.status = 'active'
  order by case p.role when 'trainer' then 0 else 1 end, p.name;
$$;


--
-- Name: local_day(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.local_day(ts timestamp with time zone) RETURNS date
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
  select (ts at time zone 'America/Sao_Paulo')::date
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: day_passes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_passes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT day_passes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'used'::text])))
);


--
-- Name: my_day_passes(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_day_passes(p_codes text[]) RETURNS SETOF public.day_passes
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select *
  from public.day_passes
  where code = any(p_codes)
  order by created_at desc
  limit 20;
$$;


--
-- Name: next_business_slot(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_business_slot(p_at timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE plpgsql STABLE
    AS $$
declare
  l timestamp := p_at at time zone 'America/Sao_Paulo';
begin
  if extract(hour from l) < 9 then
    l := date_trunc('day', l) + interval '9 hours';
  elsif extract(hour from l) >= 20 then
    l := date_trunc('day', l) + interval '1 day 9 hours';
  end if;
  -- domingo não envia: segunda 9h
  if extract(isodow from l) = 7 then
    l := date_trunc('day', l) + interval '1 day 9 hours';
  end if;
  return l at time zone 'America/Sao_Paulo';
end;
$$;


--
-- Name: normalize_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_phone(raw text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
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
$$;


--
-- Name: notify_direct_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_direct_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_conv record;
  v_name text;
begin
  begin
    update public.conversations set updated_at = now() where id = NEW.conversation_id
    returning gym_id, student_id, staff_id into v_conv;
    if v_conv is null then
      return NEW;
    end if;
    select coalesce(nullif(name, ''), 'Alguém') into v_name
    from public.profiles where id = NEW.sender_id;
    insert into public.notifications (gym_id, user_id, channel, title, body)
    values (
      v_conv.gym_id,
      case when NEW.sender_id = v_conv.student_id then v_conv.staff_id else v_conv.student_id end,
      'in_app',
      'Mensagem de ' || split_part(v_name, ' ', 1),
      left(NEW.body, 90)
    );
  exception when others then
    raise warning 'notify_direct_message falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: notify_feed_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_feed_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_post record;
  v_actor text;
  v_kind text;
  v_title text;
  v_body text;
begin
  begin
    select author_id, gym_id into v_post
    from public.feed_posts where id = NEW.post_id;
    if v_post is null or v_post.author_id = NEW.user_id then
      return NEW;
    end if;
    select coalesce(nullif(name, ''), 'Alguém') into v_actor
    from public.profiles where id = NEW.user_id;

    if TG_TABLE_NAME = 'feed_likes' then
      v_kind := 'curtida';
      v_title := 'Curtiram sua publicação';
      v_body := v_actor || ' curtiu sua publicação no feed.';
    else
      v_kind := 'comentário';
      v_title := 'Comentaram sua publicação';
      v_body := v_actor || ' comentou sua publicação no feed: ' || left(NEW.body, 90);
    end if;

    if exists (
      select 1 from public.notifications
      where user_id = v_post.author_id
        and title = v_title
        and body like '%' || v_actor || '%'
        and read_at is null
        and created_at > now() - interval '24 hours'
    ) then
      return NEW;
    end if;

    insert into public.notifications (gym_id, user_id, channel, title, body)
    values (v_post.gym_id, v_post.author_id, 'in_app', v_title, v_body);
  exception when others then
    raise warning 'notify_feed_activity falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: notify_gym_broadcast(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_gym_broadcast() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  sid uuid;
begin
  begin
    if NEW.type <> 'comunicado' then
      return NEW;
    end if;
    for sid in
      select id from public.profiles
      where gym_id = NEW.gym_id and role = 'student' and approved_at is not null
        and id <> NEW.author_id
    loop
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (NEW.gym_id, sid, 'in_app', 'Recado da academia', left(NEW.body, 140));
    end loop;
  exception when others then
    raise warning 'notify_gym_broadcast falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: notify_my_trainer(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_my_trainer(p_text text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  sname text;
begin
  select coalesce(nullif(name, ''), email, 'Um aluno') into sname
  from public.profiles where id = auth.uid();

  insert into public.notifications (gym_id, user_id, channel, title, body)
  select st.gym_id, st.trainer_id, 'in_app',
    'Aluno pede treino',
    sname || ' está no treino provisório e aguarda o plano.'
      || case when p_text is not null and btrim(p_text) <> '' then ' Recado: ' || left(btrim(p_text), 140) else '' end
  from public.student_trainers st
  where st.student_id = auth.uid();
end;
$$;


--
-- Name: notify_plan_assigned(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_plan_assigned() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  pname text;
begin
  begin
    select name into pname from public.workout_programs where id = NEW.program_id;
    insert into public.notifications (gym_id, user_id, channel, title, body)
    values (
      NEW.gym_id, NEW.student_id, 'in_app',
      'Novo treino liberado',
      'Seu personal montou um treino novo para você'
        || case when pname is not null then ' (' || left(pname, 60) || ')' else '' end
        || '. Abra a aba Treino e confira o plano da semana.'
    );
  exception when others then
    raise warning 'notify_plan_assigned falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: notify_student_lifecycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_student_lifecycle() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  staff_id uuid;
  -- no momento do INSERT o nome pode ainda estar vazio (vem depois);
  -- usa email como fallback para o aviso fazer sentido
  sname text := coalesce(nullif(NEW.name, ''), NEW.email, 'Aluno novo');
begin
  begin
    -- cadastro novo de aluno: avisa quem pode aprovar (sem spam para alunos)
    if TG_OP = 'INSERT' and NEW.role = 'student' then
      for staff_id in
        select id from public.profiles
        where gym_id = NEW.gym_id
          and role in ('trainer', 'manager', 'admin')
      loop
        insert into public.notifications (gym_id, user_id, channel, title, body)
        values (
          NEW.gym_id, staff_id, 'in_app',
          'Aluno novo na academia',
          sname || ' se cadastrou e aguarda aprovação.'
        );
      end loop;
    end if;

    -- aprovação: avisa o próprio aluno
    if TG_OP = 'UPDATE'
      and OLD.approved_at is null
      and NEW.approved_at is not null
      and NEW.role = 'student'
    then
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (
        NEW.gym_id, NEW.id, 'in_app',
        'Cadastro aprovado',
        'Bem-vindo à GymFitness, ' || split_part(sname, ' ', 1)
          || '. Faça check-in na portaria e comece seu primeiro treino.'
      );
    end if;
  exception when others then
    raise warning 'notify_student_lifecycle falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: notify_student_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_student_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tag text := substring(coalesce(NEW.details, '') from '^\[([a-z]+)\]');
  v_msg text := btrim(regexp_replace(coalesce(NEW.details, ''), '^\[[a-z]+\]\s*', ''));
  v_name text;
  v_title text;
  sid uuid;
begin
  if coalesce(current_setting('gf.request_notified', true), '') = '1' then
    return NEW;
  end if;
  begin
    select coalesce(nullif(trim(name), ''), 'Um aluno') into v_name from public.profiles where id = NEW.student_id;
    v_title := case v_tag
      when 'acompanhamento' then 'Pedido de acompanhamento'
      when 'treino' then 'Pedido de treino personalizado'
      when 'ajuste' then 'Pedido de ajuste no treino'
      when 'carga' then 'Pedido de ajuste no treino'
      when 'relatorio' then 'Pedido de relatório'
      else 'Pedido do aluno'
    end;
    for sid in select public.student_staff(NEW.student_id) loop
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (NEW.gym_id, sid, 'in_app', v_title,
        v_name || case when v_msg <> '' then ': ' || left(v_msg, 140) else ' fez um pedido.' end);
    end loop;
  exception when others then
    raise warning 'notify_student_request falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: notify_workout_milestones(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_workout_milestones() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  ws date := date_trunc('week', NEW.date at time zone 'America/Sao_Paulo')::date;
  sessions_week integer;
  goal integer;
  streak integer;
  first_today boolean;
begin
  begin
    select not exists (
      select 1 from public.workout_logs
      where student_id = NEW.student_id
        and public.local_day(date) = public.local_day(NEW.date)
        and id <> NEW.id
    ) into first_today;
    -- só avalia marcos uma vez por dia (primeira linha do dia)
    if not first_today then
      return NEW;
    end if;

    select count(distinct public.local_day(date)) into sessions_week
    from public.workout_logs
    where student_id = NEW.student_id and public.local_day(date) >= ws;

    select coalesce(array_length(available_days, 1), 3) into goal
    from public.profiles where id = NEW.student_id;

    if sessions_week >= goal and goal > 0
      -- uma vez por semana: sem esse guarda, todo treino da semana
      -- geraria um aviso repetido (poluição na central)
      and not exists (
        select 1 from public.notifications
        where user_id = NEW.student_id
          and title = 'Meta da semana batida'
          and public.local_day(created_at) >= ws
      )
    then
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (
        NEW.gym_id, NEW.student_id, 'in_app',
        'Meta da semana batida',
        'Você completou os ' || goal || ' treinos da semana. Constância é o jogo, bora manter.'
      );
    end if;

    streak := public.day_streak(NEW.student_id);
    if streak in (7, 14, 21, 30, 60, 100) then
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (
        NEW.gym_id, NEW.student_id, 'in_app',
        'Sequência de ' || streak || ' dias',
        'Você treinou ' || streak || ' dias seguidos. A chama está acesa, amanhã tem mais.'
      );
    end if;
  exception when others then
    raise warning 'notify_workout_milestones falhou: %', sqlerrm;
  end;
  return NEW;
end;
$$;


--
-- Name: offer_promo_valid(integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.offer_promo_valid(p_promo integer, p_until date) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select p_promo is not null and p_until is not null
    and p_until >= (now() at time zone 'America/Sao_Paulo')::date;
$$;


--
-- Name: on_student_approved(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_student_approved() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: pick_starter_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pick_starter_plan(p_template uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  st record;
  t record;
  v_program uuid;
  sid uuid;
begin
  select id, gym_id, name, role, medical_risk, status into st from public.profiles where id = v_uid;
  if st.id is null or st.role <> 'student' then
    raise exception 'Sem permissão';
  end if;
  if coalesce(st.medical_risk, false) or coalesce(st.status, 'active') <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'avaliacao_medica');
  end if;

  select * into t from public.starter_templates
  where id = p_template and gym_id = st.gym_id and active;
  if t.id is null then
    return jsonb_build_object('ok', false, 'reason', 'modelo_indisponivel');
  end if;

  perform pg_advisory_xact_lock(hashtext('starter:' || v_uid::text));

  if exists (
    select 1 from public.student_workouts sw
    join public.workout_programs wp on wp.id = sw.program_id
    where sw.student_id = v_uid and sw.status = 'active' and wp.created_via <> 'template'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'ficha_do_personal');
  end if;

  v_program := public.copy_template_for_student(t.id, v_uid);

  -- equipe sabe quem escolheu o quê (no máximo 1 aviso por aluno por dia)
  if not exists (
    select 1 from public.notifications
    where title = 'Aluno escolheu treino base'
      and body like coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' escolheu%'
      and created_at > now() - interval '24 hours'
  ) then
    for sid in select public.student_staff(v_uid) loop
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (st.gym_id, sid, 'in_app', 'Aluno escolheu treino base',
        coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' escolheu "' || t.label
        || '". Boa hora para oferecer um ajuste ou acompanhamento.');
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'program_id', v_program, 'template', t.label);
end;
$$;


--
-- Name: prevent_duplicate_checkin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_duplicate_checkin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.type = 'entrada' and exists (
    select 1
    from public.checkins c
    where c.student_id = new.student_id
      and c.gym_id = new.gym_id
      and c.type = 'entrada'
      and (c.checked_at at time zone 'America/Sao_Paulo')::date
        = (new.checked_at at time zone 'America/Sao_Paulo')::date
      and not exists (
        select 1
        from public.checkins s
        where s.student_id = c.student_id
          and s.gym_id = c.gym_id
          and s.type = 'saida'
          and s.checked_at > c.checked_at
      )
  ) then
    raise exception 'Check-in de entrada já realizado hoje';
  end if;
  return new;
end;
$$;


--
-- Name: purchase_day_pass(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purchase_day_pass(p_gym_slug text, p_name text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text) RETURNS TABLE(id uuid, code text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_gym   uuid;
  v_id    uuid;
  v_code  text;
  v_exp   timestamptz;
begin
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Nome inválido.';
  end if;

  select id into v_gym from public.gyms where slug = p_gym_slug limit 1;
  if v_gym is null then
    raise exception 'Academia não encontrada.';
  end if;

  v_code := public.generate_day_pass_code();
  v_exp  := now() + interval '24 hours';

  insert into public.day_passes (gym_id, code, name, email, phone, status, expires_at)
  values (v_gym, v_code, trim(p_name), p_email, p_phone, 'active', v_exp)
  returning day_passes.id into v_id;

  return query select v_id, v_code, v_exp;
end;
$$;


--
-- Name: ranking_90d(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ranking_90d(p_gym_id uuid) RETURNS TABLE(student_id uuid, sessions integer, load_kg numeric, points integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with cutoff as (
    select ((now() at time zone 'America/Sao_Paulo')::date - 90) as d
  ),
  logs as (
    select
      wl.student_id,
      count(distinct public.local_day(wl.date))::int as sessions,
      coalesce(sum(coalesce(wl.weight_kg, 0) * coalesce(wl.reps, 0)), 0) as load_kg
    from public.workout_logs wl, cutoff
    where wl.gym_id = p_gym_id
      and public.local_day(wl.date) >= cutoff.d
    group by wl.student_id
  ),
  pts as (
    select
      pe.student_id,
      coalesce(sum(pe.points), 0)::int as points
    from public.point_events pe, cutoff
    where pe.gym_id = p_gym_id
      and public.local_day(pe.created_at) >= cutoff.d
    group by pe.student_id
  )
  select
    coalesce(l.student_id, p.student_id) as student_id,
    coalesce(l.sessions, 0)::int as sessions,
    coalesce(l.load_kg, 0) as load_kg,
    (coalesce(l.sessions, 0) * 100 + floor(coalesce(l.load_kg, 0) / 100)::int + coalesce(p.points, 0))::int as points
  from logs l
  full join pts p using (student_id)
  order by points desc
  limit 50;
$$;


--
-- Name: recompute_leaderboard(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompute_leaderboard(p_student uuid, p_gym uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  ws date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
  ms date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  sess_w int; load_w numeric; sess_m int; load_m numeric; sess_a int; load_a numeric;
  pts_w int; pts_m int; pts_a int; cur_streak int;
begin
  select count(distinct public.local_day(date)), coalesce(sum(coalesce(weight_kg,0)*coalesce(reps,0)),0)
    into sess_a, load_a from public.workout_logs where student_id = p_student;
  select count(distinct public.local_day(date)), coalesce(sum(coalesce(weight_kg,0)*coalesce(reps,0)),0)
    into sess_w, load_w from public.workout_logs where student_id = p_student and public.local_day(date) >= ws;
  select count(distinct public.local_day(date)), coalesce(sum(coalesce(weight_kg,0)*coalesce(reps,0)),0)
    into sess_m, load_m from public.workout_logs where student_id = p_student and public.local_day(date) >= ms;

  select coalesce(sum(points),0) into pts_a from public.point_events where student_id = p_student;
  select coalesce(sum(points),0) into pts_w from public.point_events where student_id = p_student and public.local_day(created_at) >= ws;
  select coalesce(sum(points),0) into pts_m from public.point_events where student_id = p_student and public.local_day(created_at) >= ms;

  cur_streak := public.day_streak(p_student);

  insert into public.leaderboard (gym_id, period, week_start, student_id, rank_type, points, load_kg, sessions, streak)
  values
    (p_gym, 'week',  ws,           p_student, 'load', sess_w*100 + floor(load_w/100)::int + pts_w, load_w, sess_w, cur_streak),
    (p_gym, 'month', ms,           p_student, 'load', sess_m*100 + floor(load_m/100)::int + pts_m, load_m, sess_m, cur_streak),
    (p_gym, 'all',   '2000-01-01', p_student, 'load', sess_a*100 + floor(load_a/100)::int + pts_a, load_a, sess_a, cur_streak)
  on conflict (gym_id, period, week_start, student_id, rank_type) do update set
    sessions = excluded.sessions,
    load_kg  = excluded.load_kg,
    points   = excluded.points,
    streak   = excluded.streak;
end;
$$;


--
-- Name: request_coaching(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_coaching(p_trainer uuid, p_message text DEFAULT NULL::text, p_offer uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  st record;
  tr record;
  v_offer_title text;
  v_offer_price integer;
  v_promo integer;
  v_promo_label text;
  v_promo_until date;
  v_has_offer boolean := false;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
  v_plan text := '';
  v_price_txt text;
begin
  select id, gym_id, name, role into st from public.profiles where id = v_uid;
  if st.id is null or st.role <> 'student' then
    raise exception 'Sem permissão';
  end if;

  select id, name, phone into tr from public.profiles
  where id = p_trainer and gym_id = st.gym_id and role in ('trainer', 'manager', 'admin');
  if tr.id is null then
    raise exception 'Personal não encontrado';
  end if;

  if p_offer is not null then
    select title, price_cents, promo_price_cents, promo_label, promo_until, true
      into v_offer_title, v_offer_price, v_promo, v_promo_label, v_promo_until, v_has_offer
    from public.personal_offers
    where id = p_offer and trainer_id = tr.id and gym_id = st.gym_id and active;
    if not coalesce(v_has_offer, false) then
      raise exception 'Plano indisponível';
    end if;
    v_price_txt := case when public.offer_promo_valid(v_promo, v_promo_until)
      then coalesce(v_promo_label, 'Promoção') || ' ' || public.fmt_brl(v_promo) || ' (de ' || public.fmt_brl(v_offer_price) || ')'
      else public.fmt_brl(v_offer_price) end;
    v_plan := ' · ' || v_offer_title || ' · ' || v_price_txt;
  end if;

  perform set_config('gf.request_notified', '1', true);
  insert into public.premium_requests (gym_id, student_id, request_type, details, status)
  values (st.gym_id, v_uid, 'other',
    '[acompanhamento] (com ' || coalesce(tr.name, 'personal') || v_plan || ')' || coalesce(' ' || left(v_msg, 300), ''),
    'pending');
  perform set_config('gf.request_notified', '', true);

  insert into public.notifications (gym_id, user_id, channel, title, body)
  values (st.gym_id, tr.id, 'in_app', 'Pedido de acompanhamento',
    coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' quer acompanhamento com você'
    || case when v_has_offer then ' no plano "' || v_offer_title || '" (' || v_price_txt || ')' else '' end
    || coalesce(': ' || left(v_msg, 120), '.') || ' Ele deve te chamar no WhatsApp agora.');

  return jsonb_build_object('ok', true, 'phone', tr.phone, 'name', tr.name,
    'offer', case when v_has_offer then v_offer_title end);
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: save_student_plan(uuid, jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_student_plan(p_student uuid, p_plan jsonb, p_notes text DEFAULT NULL::text, p_previous_workout uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: seed_base_programs(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_base_programs(p_gym uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner uuid;
  p jsonb;
  d jsonb;
  e jsonb;
  v_program uuid;
  v_day uuid;
  v_ex uuid;
  v_dias jsonb;
  v_exs jsonb;
  i integer;
  j integer;
  n integer := 0;
  letters text := 'ABCDEF';
begin
  if exists (select 1 from public.starter_templates where gym_id = p_gym and is_base) then
    return 0;
  end if;

  select id into v_owner from public.profiles
  where gym_id = p_gym and role in ('trainer', 'manager', 'admin')
  order by (role = 'trainer') desc, created_at
  limit 1;
  if v_owner is null then
    return 0;
  end if;

  for p in select * from jsonb_array_elements(public.base_programs_catalog()) loop
    -- monta o rascunho completo (ai_draft) com os ids reais
    v_dias := '[]'::jsonb;
    for i in 0 .. jsonb_array_length(p -> 'days') - 1 loop
      d := p -> 'days' -> i;
      v_exs := '[]'::jsonb;
      for j in 0 .. jsonb_array_length(d -> 'exs') - 1 loop
        e := d -> 'exs' -> j;
        select id into v_ex from public.exercises
        where lower(name) = lower(e ->> 0) and (gym_id is null or gym_id = p_gym)
        order by (gym_id = p_gym) desc nulls last, created_at
        limit 1;
        if v_ex is null then
          raise exception 'Treino base %: exercício "%" não está na biblioteca', p ->> 'key', e ->> 0;
        end if;
        v_exs := v_exs || jsonb_build_object(
          'exerciseId', v_ex, 'exercicio', e ->> 0, 'series', (e ->> 1)::int,
          'reps', e ->> 2, 'descanso', (e ->> 3) || 's', 'rpe', 7, 'dica', e ->> 4,
          'tecnica', 'normal');
      end loop;
      v_dias := v_dias || jsonb_build_object(
        'nome', d ->> 'nome', 'foco', d ->> 'foco', 'slot', substr(letters, i + 1, 1),
        'aquecimento', '[]'::jsonb, 'exercicios', v_exs, 'finalizador', '');
    end loop;

    insert into public.workout_programs
      (gym_id, trainer_id, name, objective, created_via, ai_draft, reviewed_by, notes)
    values
      (p_gym, v_owner, p ->> 'label', p ->> 'objective', 'template',
       jsonb_build_object(
         'nome', p ->> 'label',
         'frequencia', (p ->> 'dpw') || 'x por semana',
         'daysSelected', to_jsonb(public.default_week_days((p ->> 'dpw')::int)),
         'splitType', p ->> 'split',
         'nivel', p ->> 'level',
         'objetivo', p ->> 'objective',
         'observacao_geral', p ->> 'description',
         'dias', v_dias,
         'cardio', '',
         'modo', 'manual')::text,
       v_owner, p ->> 'description')
    returning id into v_program;

    for i in 0 .. jsonb_array_length(v_dias) - 1 loop
      d := v_dias -> i;
      insert into public.workout_days (gym_id, program_id, name, day_order)
      values (p_gym, v_program, d ->> 'nome', i + 1)
      returning id into v_day;
      for j in 0 .. jsonb_array_length(d -> 'exercicios') - 1 loop
        e := d -> 'exercicios' -> j;
        insert into public.workout_exercises
          (gym_id, day_id, exercise_id, sets, reps, rest_seconds, rpe, notes, technique, ord)
        values
          (p_gym, v_day, (e ->> 'exerciseId')::uuid, (e ->> 'series')::int, e ->> 'reps',
           replace(e ->> 'descanso', 's', '')::int, 7,
           (e ->> 'exercicio') || '. ' || (e ->> 'dica'), 'normal', j + 1);
      end loop;
    end loop;

    insert into public.starter_templates
      (gym_id, program_id, label, levels, is_base, audience, split, days_per_week, description, sort, created_by)
    values
      (p_gym, v_program, p ->> 'label', array[p ->> 'level'], true, p ->> 'audience',
       p ->> 'split', (p ->> 'dpw')::int, p ->> 'description', (p ->> 'sort')::int, v_owner);
    n := n + 1;
  end loop;

  return n;
end;
$$;


--
-- Name: staff_renew_matricula(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_renew_matricula(p_student_id uuid, p_months integer DEFAULT 1) RETURNS date
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_role text;
  v_gym uuid;
  v_uid uuid := auth.uid();
  v_m integer := greatest(1, least(coalesce(p_months, 1), 12));
  v_row public.profiles%rowtype;
  v_day int;
  v_base date;
  v_anchor date;
  v_next date;
  v_ext date;
begin
  if v_uid is null then
    raise exception 'Sem sessão.';
  end if;
  select role, gym_id into v_role, v_gym from public.profiles where id = v_uid;
  if v_role is null or v_role not in ('trainer','manager','admin') then
    raise exception 'Sem permissão para renovar matrícula.';
  end if;
  select * into v_row from public.profiles where id = p_student_id for update;
  if v_row.id is null or v_row.gym_id is distinct from v_gym then
    raise exception 'Aluno não encontrado ou de outra academia.';
  end if;
  if v_role = 'trainer' then
    if not exists (
      select 1 from public.student_trainers st
      where st.student_id = p_student_id and st.trainer_id = v_uid
    ) then
      raise exception 'Treinador sem vínculo com este aluno.';
    end if;
  end if;
  -- Renova mantendo o dia do ciclo (vence dia 8 -> 08 do mes que vem).
  v_base := coalesce(v_row.vencimento, current_date);
  v_day := extract(day from v_base)::int;
  v_anchor := (date_trunc('month', current_date) + make_interval(days => v_day - 1))::date;
  if v_anchor <= current_date then
    v_anchor := date_trunc('month', current_date + interval '1 month');
  end if;
  v_next := least((v_anchor + make_interval(days => v_day - 1))::date,
                  (v_anchor + interval '1 month - 1 day')::date);
  v_ext := (v_base + make_interval(months => v_m))::date;
  update public.profiles
  set vencimento = greatest(v_next, v_ext)::date,
      updated_at = now()
  where id = p_student_id
  returning vencimento into v_row.vencimento;
  return v_row.vencimento;
end;
$$;


--
-- Name: staff_update_student(uuid, text, text, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.staff_update_student(p_student_id uuid, p_experience_level text DEFAULT NULL::text, p_goal text DEFAULT NULL::text, p_objetivo text DEFAULT NULL::text, p_available_days text[] DEFAULT NULL::text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: start_checkin(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_checkin(p_source text DEFAULT 'app'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_source text := case when p_source in ('app','nfc','qrcode') then p_source else 'app' end;
  v_entry_id uuid;
  v_checked_at timestamptz;
  v_session_id uuid;
  v_started_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  select gym_id into v_gym from public.profiles where id = v_uid;
  if v_gym is null then
    raise exception 'Perfil sem academia';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  -- Entrada ainda aberta hoje?
  select c.id, c.checked_at, c.workout_session_id
    into v_entry_id, v_checked_at, v_session_id
  from public.checkins c
  where c.student_id = v_uid
    and c.gym_id = v_gym
    and c.type = 'entrada'
    and (c.checked_at at time zone 'America/Sao_Paulo')::date
      = (now() at time zone 'America/Sao_Paulo')::date
    and not exists (
      select 1 from public.checkins s
      where s.student_id = c.student_id
        and s.gym_id = c.gym_id
        and s.type = 'saida'
        and s.checked_at > c.checked_at
    )
  order by c.checked_at desc
  limit 1;

  if v_entry_id is not null then
    select ws.id, ws.started_at into v_session_id, v_started_at
    from public.workout_sessions ws
    where ws.student_id = v_uid and ws.status = 'active'
    order by ws.started_at desc
    limit 1;

    if v_session_id is null then
      insert into public.workout_sessions (gym_id, student_id, status, started_at, meta)
      values (v_gym, v_uid, 'active', now(),
        jsonb_build_object('kind', 'checkin', 'started_by', 'checkin', 'source', v_source))
      returning id, started_at into v_session_id, v_started_at;

      update public.checkins
      set workout_session_id = v_session_id
      where id = v_entry_id;
    end if;

    return jsonb_build_object(
      'ok', true, 'existing', true,
      'checkin_id', v_entry_id, 'checked_at', v_checked_at,
      'session_id', v_session_id, 'started_at', v_started_at
    );
  end if;

  -- Sem entrada aberta. Sessão antiga com saída já registrada não pode ser
  -- reaproveitada; fecha e abre uma nova para a nova entrada.
  update public.workout_sessions ws
  set status = 'completed', ended_at = now()
  where ws.student_id = v_uid and ws.status = 'active'
    and exists (
      select 1 from public.checkins c
      where c.workout_session_id = ws.id and c.type = 'saida'
    );

  select ws.id, ws.started_at into v_session_id, v_started_at
  from public.workout_sessions ws
  where ws.student_id = v_uid and ws.status = 'active'
  order by ws.started_at desc
  limit 1;

  if v_session_id is null then
    insert into public.workout_sessions (gym_id, student_id, status, started_at, meta)
    values (v_gym, v_uid, 'active', now(),
      jsonb_build_object('kind', 'checkin', 'started_by', 'checkin', 'source', v_source))
    returning id, started_at into v_session_id, v_started_at;
  end if;

  insert into public.checkins (gym_id, student_id, type, source, checked_at, workout_session_id)
  values (v_gym, v_uid, 'entrada', v_source, now(), v_session_id)
  returning id, checked_at into v_entry_id, v_checked_at;

  return jsonb_build_object(
    'ok', true, 'existing', false,
    'checkin_id', v_entry_id, 'checked_at', v_checked_at,
    'session_id', v_session_id, 'started_at', v_started_at
  );
end;
$$;


--
-- Name: starter_campaign_message(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.starter_campaign_message(p_first text, p_variant integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_variant % 3
    when 0 then
      'Oi, ' || p_first || '! Aqui é da GymFitness 💪' || chr(10) || chr(10) ||
      'Seu treino já está pronto pra você escolher no app: tem opções AB, ABC, ABCD e ABCDE montadas pela nossa personal, do iniciante ao avançado. Leva 1 minutinho:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Escolheu, já pode treinar hoje! Qualquer dúvida é só responder aqui 😉'
    when 1 then
      'E aí, ' || p_first || '! Tudo certo? Aqui é da GymFitness.' || chr(10) || chr(10) ||
      'Liberamos treinos prontos no app pra ninguém ficar esperando: você escolhe o que combina com você (iniciante, intermediário ou avançado) e começa na hora 👇' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Depois me conta qual você escolheu! 💪'
    else
      'Oi, ' || p_first || ', tudo bem? 😊 Passando pra avisar que o seu treino na GymFitness já pode ser escolhido no app.' || chr(10) || chr(10) ||
      'São treinos prontos, com divisão certinha (tipo ABC), e se quiser algo sob medida dá pra pedir à personal ali mesmo:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Bora começar essa semana? 🔥'
  end;
$$;


--
-- Name: starter_options(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.starter_options() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with me as (
    select id, gym_id, sex, experience_level,
      coalesce(array_length(available_days, 1), 3) as n
    from public.profiles where id = auth.uid()
  ),
  opts as (
    select s.id, s.label, s.description, s.split, s.is_base, s.audience, s.sort,
      coalesce(s.levels[1], 'Todos os níveis') as level,
      (select count(*) from public.workout_days wd where wd.program_id = s.program_id)::int as nd,
      coalesce(s.days_per_week,
        (select count(*) from public.workout_days wd where wd.program_id = s.program_id)::int) as dpw,
      (select coalesce(jsonb_agg(wd.name order by wd.day_order), '[]'::jsonb)
         from public.workout_days wd where wd.program_id = s.program_id) as days,
      (select count(*) from public.workout_exercises we
         join public.workout_days wd on wd.id = we.day_id
        where wd.program_id = s.program_id)::int as exercises,
      ((s.levels is not null and me.experience_level = any(s.levels))) as level_match,
      abs(coalesce(s.days_per_week, 3) - me.n) as days_gap
    from public.starter_templates s, me
    where s.gym_id = me.gym_id and s.active
      and (s.audience is null or me.sex is null or s.audience = me.sex)
  ),
  ranked as (
    select o.*, row_number() over (
      order by (not o.is_base) desc, o.level_match desc, o.days_gap asc, o.sort asc
    ) as rk
    from opts o where o.nd > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'label', label, 'description', description, 'split', split,
      'level', level, 'days_per_week', dpw, 'days', days, 'exercises', exercises,
      'is_base', is_base, 'recommended', rk <= 3
    ) order by rk), '[]'::jsonb)
  from ranked;
$$;


--
-- Name: starter_plan_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.starter_plan_status() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: student_scheduled_days(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.student_scheduled_days(p_student uuid) RETURNS integer[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with active as (
    select wp.ai_draft, p.available_days
    from public.student_workouts sw
    join public.workout_programs wp on wp.id = sw.program_id
    join public.profiles p on p.id = sw.student_id
    where sw.student_id = p_student and sw.status = 'active'
    order by sw.assigned_at desc
    limit 1
  ),
  selected as (
    select distinct public.weekday_number(value) as n
    from active, jsonb_array_elements_text(coalesce((active.ai_draft::jsonb) -> 'daysSelected', '[]'::jsonb))
    where public.weekday_number(value) is not null
  ),
  fallback as (
    select distinct public.weekday_number(value) as n
    from active, unnest(coalesce(active.available_days, array[]::text[])) as value
    where public.weekday_number(value) is not null
  )
  select coalesce(
    (select array_agg(n order by n) from selected),
    (select array_agg(n order by n) from fallback),
    array[1,2,3,4,5,6,7]
  );
$$;


--
-- Name: student_staff(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.student_staff(p_student uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with linked as (
    select trainer_id from public.student_trainers where student_id = p_student
  ),
  gym as (select gym_id from public.profiles where id = p_student),
  trainers as (
    select p.id from public.profiles p, gym
    where p.gym_id = gym.gym_id and p.role = 'trainer'
  ),
  managers as (
    select p.id from public.profiles p, gym
    where p.gym_id = gym.gym_id and p.role in ('manager', 'admin')
  )
  select trainer_id from linked
  union
  select id from trainers where not exists (select 1 from linked)
  union
  select id from managers where not exists (select 1 from linked) and not exists (select 1 from trainers);
$$;


--
-- Name: sync_profile_from_clearance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profile_from_clearance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: system_feed_post(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_feed_post(p_gym uuid, p_author uuid, p_body text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform set_config('gf.system_post', '1', true);
  insert into public.feed_posts (gym_id, author_id, type, body, expires_at)
  values (p_gym, p_author, 'conquista', p_body, now() + interval '30 days');
  perform set_config('gf.system_post', '', true);
end;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: trainer_owns_student(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trainer_owns_student(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.student_trainers st
    where st.trainer_id = auth.uid()
      and st.student_id = p_student_id
      and st.gym_id = public.current_gym_id()
  ) or auth.uid() = p_student_id;
$$;


--
-- Name: update_onboarding_step(jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_onboarding_step(p_patch jsonb, p_next_step integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_profile_own(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_profile_own(p_name text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text, p_phone text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: update_student_profile(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_student_profile(p_name text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_goal text DEFAULT NULL::text, p_objetivo text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: update_student_profile(text, text, text, text, text, date, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_student_profile(p_name text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_goal text DEFAULT NULL::text, p_objetivo text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_birth_date date DEFAULT NULL::date, p_experience_level text DEFAULT NULL::text, p_available_days text[] DEFAULT NULL::text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: weekday_number(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.weekday_number(p_label text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  select case left(translate(lower(coalesce(p_label, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc'), 3)
    when 'dom' then 7
    when 'seg' then 1
    when 'ter' then 2
    when 'qua' then 3
    when 'qui' then 4
    when 'sex' then 5
    when 'sab' then 6
    else null
  end;
$$;


--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    badge_url text,
    points integer DEFAULT 0 NOT NULL
);


--
-- Name: ai_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid,
    user_id uuid,
    purpose text NOT NULL,
    model_used text NOT NULL,
    tokens_in integer,
    tokens_out integer,
    latency_ms integer,
    success boolean DEFAULT true NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_generation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_generation_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    user_id uuid NOT NULL,
    purpose text NOT NULL,
    created_via text DEFAULT 'manual'::text NOT NULL,
    ai_model text,
    prompt_tokens integer,
    completion_tokens integer,
    estimated_cost numeric(10,6),
    ai_draft text,
    reviewed_by uuid,
    used_sensitive_data boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_generation_logs_created_via_check CHECK ((created_via = ANY (ARRAY['manual'::text, 'ia'::text, 'foto'::text, 'template'::text]))),
    CONSTRAINT ai_generation_logs_purpose_check CHECK ((purpose = ANY (ARRAY['generate_workout'::text, 'parse_ficha'::text, 'edit_template'::text, 'plato_detection'::text, 'insight_student'::text, 'insight_trainer'::text, 'insight_manager'::text, 'register_student'::text])))
);


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_config (
    key text NOT NULL,
    value text NOT NULL
);


--
-- Name: app_data_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_data_migrations (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_errors (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source text NOT NULL,
    level text NOT NULL,
    event text NOT NULL,
    message text,
    stack text,
    path text,
    user_id uuid,
    user_agent text,
    build text,
    fingerprint text NOT NULL,
    extra jsonb,
    CONSTRAINT app_errors_level_check CHECK ((level = ANY (ARRAY['error'::text, 'toast'::text]))),
    CONSTRAINT app_errors_source_check CHECK ((source = ANY (ARRAY['client'::text, 'server'::text])))
);


--
-- Name: app_errors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.app_errors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.app_errors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: body_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.body_metrics (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    weight_kg numeric(5,2),
    height_m numeric(4,2),
    body_fat_pct numeric(4,1),
    bmi numeric(4,1),
    muscle_kg numeric(5,2),
    waist_cm numeric(5,1),
    source text DEFAULT 'manual'::text NOT NULL,
    CONSTRAINT body_metrics_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'bioimpedancia'::text, 'doctor'::text])))
);


--
-- Name: cardio_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cardio_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    modality text NOT NULL,
    minutes integer NOT NULL,
    intensity integer,
    date timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cardio_logs_intensity_check CHECK (((intensity IS NULL) OR ((intensity >= 1) AND (intensity <= 10)))),
    CONSTRAINT cardio_logs_minutes_check CHECK (((minutes > 0) AND (minutes <= 600))),
    CONSTRAINT cardio_logs_modality_check CHECK ((modality = ANY (ARRAY['corrida'::text, 'esteira'::text, 'bike'::text, 'natacao'::text, 'outros'::text])))
);


--
-- Name: challenge_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_participants (
    challenge_id uuid NOT NULL,
    student_id uuid NOT NULL,
    gym_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    goal_days integer NOT NULL,
    prize_text text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenges_check CHECK ((ends_on >= starts_on)),
    CONSTRAINT challenges_goal_days_check CHECK (((goal_days >= 1) AND (goal_days <= 366)))
);


--
-- Name: checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkins (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    type text DEFAULT 'entrada'::text NOT NULL,
    source text DEFAULT 'qrcode'::text NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    workout_session_id uuid,
    CONSTRAINT checkins_source_check CHECK ((source = ANY (ARRAY['qrcode'::text, 'nfc'::text, 'app'::text]))),
    CONSTRAINT checkins_type_check CHECK ((type = ANY (ARRAY['entrada'::text, 'saida'::text])))
);

ALTER TABLE ONLY public.checkins REPLICA IDENTITY FULL;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.direct_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT direct_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000)))
);


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    nfc_tag_url text,
    qr_url text,
    map_position jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_category_check CHECK ((category = ANY (ARRAY['peito'::text, 'costas'::text, 'ombro'::text, 'biceps'::text, 'triceps'::text, 'perna'::text, 'gluteo'::text, 'core'::text, 'cardio'::text, 'panturrilha'::text]))),
    CONSTRAINT equipment_status_check CHECK ((status = ANY (ARRAY['available'::text, 'in_use'::text, 'maintenance'::text, 'pending'::text])))
);


--
-- Name: equipment_maintenance_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_maintenance_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT equipment_maintenance_logs_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text])))
);


--
-- Name: equipment_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    variation_id uuid,
    student_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    type text DEFAULT 'regular'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    meta jsonb,
    CONSTRAINT equipment_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text]))),
    CONSTRAINT equipment_sessions_type_check CHECK ((type = ANY (ARRAY['regular'::text, 'biset'::text, 'triset'::text])))
);

ALTER TABLE ONLY public.equipment_sessions REPLICA IDENTITY FULL;


--
-- Name: equipment_variations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_variations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    exercise_id uuid,
    name text NOT NULL,
    default_sets integer,
    default_reps integer
);


--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercises (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid,
    name text NOT NULL,
    category text NOT NULL,
    muscles text[] DEFAULT '{}'::text[] NOT NULL,
    equipment_id uuid,
    photo_url text,
    tips text[] DEFAULT '{}'::text[],
    technique_default text DEFAULT 'normal'::text NOT NULL,
    high_impact boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT exercises_category_check CHECK ((category = ANY (ARRAY['peito'::text, 'costas'::text, 'ombro'::text, 'biceps'::text, 'triceps'::text, 'perna'::text, 'gluteo'::text, 'core'::text, 'cardio'::text, 'panturrilha'::text]))),
    CONSTRAINT exercises_technique_default_check CHECK ((technique_default = ANY (ARRAY['normal'::text, 'dropset'::text, 'biset'::text, 'triset'::text])))
);


--
-- Name: feed_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_comments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.feed_comments REPLICA IDENTITY FULL;


--
-- Name: feed_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_likes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reaction text DEFAULT 'like'::text NOT NULL,
    CONSTRAINT feed_likes_reaction_check CHECK ((reaction = ANY (ARRAY['like'::text, 'fire'::text, 'clap'::text])))
);

ALTER TABLE ONLY public.feed_likes REPLICA IDENTITY FULL;


--
-- Name: feed_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_posts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    author_id uuid NOT NULL,
    type text DEFAULT 'geral'::text NOT NULL,
    body text NOT NULL,
    media_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    CONSTRAINT feed_posts_type_check CHECK ((type = ANY (ARRAY['geral'::text, 'conquista'::text, 'comunicado'::text, 'desafio'::text])))
);

ALTER TABLE ONLY public.feed_posts REPLICA IDENTITY FULL;


--
-- Name: gym_motivation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gym_motivation (
    gym_id uuid NOT NULL,
    phrase text DEFAULT ''::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.gym_motivation REPLICA IDENTITY FULL;


--
-- Name: gyms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gyms (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    address text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gyms_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: leaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    week_start date NOT NULL,
    student_id uuid NOT NULL,
    rank_type text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    load_kg numeric(12,2) DEFAULT 0 NOT NULL,
    sessions integer DEFAULT 0 NOT NULL,
    streak integer DEFAULT 0 NOT NULL,
    period text DEFAULT 'week'::text NOT NULL,
    CONSTRAINT leaderboard_period_check CHECK ((period = ANY (ARRAY['week'::text, 'month'::text, 'all'::text]))),
    CONSTRAINT leaderboard_rank_type_check CHECK ((rank_type = ANY (ARRAY['load'::text, 'constancy'::text])))
);


--
-- Name: leaderboard_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    kind text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: medical_clearances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_clearances (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    document_url text NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone
);


--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_settings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    user_id uuid NOT NULL,
    push_workouts boolean DEFAULT true NOT NULL,
    push_social boolean DEFAULT true NOT NULL,
    push_reminders boolean DEFAULT true NOT NULL,
    push_promotions boolean DEFAULT false NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    user_id uuid NOT NULL,
    channel text DEFAULT 'in_app'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pushed_at timestamp with time zone,
    CONSTRAINT notifications_channel_check CHECK ((channel = ANY (ARRAY['in_app'::text, 'push'::text, 'email'::text])))
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


--
-- Name: page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    path text NOT NULL,
    kind text DEFAULT 'view'::text NOT NULL,
    cta text,
    referrer text,
    device text,
    visitor_id text NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT page_views_device_check CHECK ((device = ANY (ARRAY['mobile'::text, 'desktop'::text, 'tablet'::text]))),
    CONSTRAINT page_views_kind_check CHECK ((kind = ANY (ARRAY['view'::text, 'click'::text, 'signup'::text, 'daypass'::text])))
);


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    name text NOT NULL,
    image_url text,
    link text,
    resgate text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: personal_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    price_cents integer,
    sessions_per_week integer,
    duration_label text,
    active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    promo_price_cents integer,
    promo_label text,
    promo_until date,
    CONSTRAINT personal_offers_description_check CHECK (((description IS NULL) OR (length(description) <= 400))),
    CONSTRAINT personal_offers_duration_label_check CHECK (((duration_label IS NULL) OR (length(duration_label) <= 40))),
    CONSTRAINT personal_offers_price_cents_check CHECK (((price_cents IS NULL) OR ((price_cents >= 0) AND (price_cents <= 10000000)))),
    CONSTRAINT personal_offers_promo_label_check CHECK (((promo_label IS NULL) OR (length(promo_label) <= 30))),
    CONSTRAINT personal_offers_promo_price_cents_check CHECK (((promo_price_cents IS NULL) OR ((promo_price_cents >= 0) AND (promo_price_cents <= 10000000)))),
    CONSTRAINT personal_offers_sessions_per_week_check CHECK (((sessions_per_week IS NULL) OR ((sessions_per_week >= 1) AND (sessions_per_week <= 7)))),
    CONSTRAINT personal_offers_title_check CHECK (((length(btrim(title)) >= 2) AND (length(btrim(title)) <= 80)))
);


--
-- Name: point_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    source text NOT NULL,
    points integer NOT NULL,
    dedupe_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: premium_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    request_type text DEFAULT 'pdf'::text NOT NULL,
    details text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    CONSTRAINT premium_requests_request_type_check CHECK ((request_type = ANY (ARRAY['pdf'::text, 'report'::text, 'other'::text]))),
    CONSTRAINT premium_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

ALTER TABLE ONLY public.premium_requests REPLICA IDENTITY FULL;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    gym_id uuid NOT NULL,
    role text DEFAULT 'student'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    avatar_url text,
    birth_date date,
    goal text,
    medical_risk boolean DEFAULT false NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    onboarding_step integer DEFAULT 0 NOT NULL,
    lgpd_consent_at timestamp with time zone,
    daily_intake text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bio text,
    whatsapp_consent boolean DEFAULT false,
    objetivo text,
    medications text,
    surgery_history text,
    experience_level text,
    available_days text[],
    emergency_contact jsonb,
    sex text,
    medical_flags text[],
    plan_type text,
    vencimento date,
    approved_at timestamp with time zone,
    CONSTRAINT profiles_plan_type_check CHECK ((plan_type = ANY (ARRAY['Gymfitness'::text, 'Gympass'::text, 'TotalPass'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['student'::text, 'trainer'::text, 'manager'::text, 'admin'::text]))),
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'blocked'::text, 'pending_clearance'::text])))
);

ALTER TABLE ONLY public.profiles REPLICA IDENTITY FULL;


--
-- Name: progress_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progress_photos (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    url text NOT NULL,
    angle text NOT NULL,
    phase text NOT NULL,
    visibility text DEFAULT 'self'::text NOT NULL,
    taken_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT progress_photos_angle_check CHECK ((angle = ANY (ARRAY['frente'::text, 'lado'::text, 'costas'::text]))),
    CONSTRAINT progress_photos_phase_check CHECK ((phase = ANY (ARRAY['antes'::text, 'depois'::text]))),
    CONSTRAINT progress_photos_visibility_check CHECK ((visibility = ANY (ARRAY['self'::text, 'trainer'::text])))
);


--
-- Name: promo_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    kind text DEFAULT 'oferta'::text NOT NULL,
    badge text,
    title text NOT NULL,
    subtitle text,
    cta_label text,
    cta_type text DEFAULT 'whatsapp_gym'::text NOT NULL,
    cta_value text,
    challenge_id uuid,
    theme text DEFAULT 'black'::text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT promo_campaigns_cta_type_check CHECK ((cta_type = ANY (ARRAY['whatsapp_gym'::text, 'personal'::text, 'challenge'::text, 'link'::text]))),
    CONSTRAINT promo_campaigns_kind_check CHECK ((kind = ANY (ARRAY['oferta'::text, 'desafio'::text]))),
    CONSTRAINT promo_campaigns_theme_check CHECK ((theme = ANY (ARRAY['black'::text, 'verao'::text, 'brand'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: slot_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slot_checks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    program_id uuid NOT NULL,
    slot text NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT slot_checks_slot_check CHECK ((slot = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text, 'F'::text])))
);


--
-- Name: sponsors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sponsors (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid,
    name text NOT NULL,
    logo_url text,
    discount_text text NOT NULL,
    min_value text,
    cta_type text DEFAULT 'coupon'::text NOT NULL,
    cta_value text,
    active boolean DEFAULT true NOT NULL,
    ord integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sponsors_cta_type_check CHECK ((cta_type = ANY (ARRAY['coupon'::text, 'whatsapp'::text])))
);


--
-- Name: squad_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squad_members (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    squad_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: squad_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squad_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    squad_id uuid NOT NULL,
    user_id uuid NOT NULL,
    sender_type text DEFAULT 'student'::text NOT NULL,
    ai_embedding boolean DEFAULT false NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT squad_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['student'::text, 'trainer'::text, 'manager'::text, 'admin'::text, 'ai'::text])))
);


--
-- Name: squads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squads (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    challenge_start timestamp with time zone,
    challenge_end timestamp with time zone,
    type text DEFAULT 'grupo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT squads_type_check CHECK ((type = ANY (ARRAY['desafio'::text, 'grupo'::text])))
);


--
-- Name: starter_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.starter_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    program_id uuid NOT NULL,
    label text NOT NULL,
    levels text[],
    active boolean DEFAULT true NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_base boolean DEFAULT false NOT NULL,
    audience text,
    split text,
    days_per_week integer,
    description text,
    sort integer DEFAULT 0 NOT NULL,
    CONSTRAINT starter_templates_audience_check CHECK ((audience = ANY (ARRAY['M'::text, 'F'::text])))
);


--
-- Name: student_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_achievements (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    earned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_subscriptions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    plan_name text NOT NULL,
    type text DEFAULT 'monthly'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    payment_method text,
    auto_renew boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'blocked'::text, 'cancelled'::text]))),
    CONSTRAINT student_subscriptions_type_check CHECK ((type = ANY (ARRAY['monthly'::text, 'gympass'::text, 'totalpass'::text])))
);


--
-- Name: student_trainers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_trainers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_workouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_workouts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    program_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT student_workouts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text])))
);


--
-- Name: tv_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tv_content (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    image_url text,
    link_url text,
    duration_sec integer DEFAULT 30 NOT NULL,
    ord integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tv_content_duration_sec_check CHECK (((duration_sec >= 10) AND (duration_sec <= 120))),
    CONSTRAINT tv_content_type_check CHECK ((type = ANY (ARRAY['sponsor'::text, 'tip'::text, 'ranking'::text, 'promo'::text, 'motivation'::text])))
);


--
-- Name: whatsapp_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_outbox (
    id bigint NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid,
    campaign text NOT NULL,
    phone text NOT NULL,
    body text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: whatsapp_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_outbox ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.whatsapp_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: workout_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_days (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    program_id uuid NOT NULL,
    name text NOT NULL,
    day_order integer DEFAULT 1 NOT NULL
);


--
-- Name: workout_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_exercises (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    day_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    variation_id uuid,
    sets integer DEFAULT 3 NOT NULL,
    reps text DEFAULT '12'::text NOT NULL,
    rest_seconds integer DEFAULT 60 NOT NULL,
    rpe integer,
    notes text,
    technique text DEFAULT 'normal'::text NOT NULL,
    ord integer DEFAULT 1 NOT NULL,
    CONSTRAINT workout_exercises_rpe_check CHECK (((rpe >= 1) AND (rpe <= 10))),
    CONSTRAINT workout_exercises_technique_check CHECK ((technique = ANY (ARRAY['normal'::text, 'dropset'::text, 'biset'::text, 'triset'::text])))
);


--
-- Name: workout_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    workout_id uuid,
    exercise_id uuid NOT NULL,
    session_id uuid,
    date timestamp with time zone DEFAULT now() NOT NULL,
    weight_kg numeric(6,2) DEFAULT 0 NOT NULL,
    reps integer DEFAULT 0 NOT NULL,
    rpe integer,
    technique text DEFAULT 'normal'::text NOT NULL,
    workout_session_id uuid,
    CONSTRAINT workout_logs_rpe_check CHECK (((rpe >= 1) AND (rpe <= 10))),
    CONSTRAINT workout_logs_technique_check CHECK ((technique = ANY (ARRAY['normal'::text, 'dropset'::text, 'biset'::text, 'triset'::text])))
);

ALTER TABLE ONLY public.workout_logs REPLICA IDENTITY FULL;


--
-- Name: workout_logs_backup_20261026; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_logs_backup_20261026 (
    id uuid,
    gym_id uuid,
    student_id uuid,
    workout_id uuid,
    exercise_id uuid,
    session_id uuid,
    date timestamp with time zone,
    weight_kg numeric(6,2),
    reps integer,
    rpe integer,
    technique text
);


--
-- Name: workout_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_programs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    name text NOT NULL,
    objective text,
    created_via text DEFAULT 'manual'::text NOT NULL,
    ai_model text,
    ai_draft text,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT workout_programs_created_via_check CHECK ((created_via = ANY (ARRAY['manual'::text, 'ia'::text, 'foto'::text, 'template'::text])))
);


--
-- Name: workout_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gym_id uuid NOT NULL,
    student_id uuid NOT NULL,
    workout_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT workout_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text])))
);


--
-- Name: workout_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    gym_id uuid,
    sex text DEFAULT 'all'::text NOT NULL,
    name text NOT NULL,
    goal text DEFAULT 'Condicionamento'::text NOT NULL,
    level text DEFAULT 'Iniciante'::text NOT NULL,
    days jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workout_templates_sex_check CHECK ((sex = ANY (ARRAY['M'::text, 'F'::text, 'all'::text])))
);


--
-- Name: achievements achievements_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_code_key UNIQUE (code);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: ai_audit_logs ai_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_audit_logs
    ADD CONSTRAINT ai_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_generation_logs ai_generation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generation_logs
    ADD CONSTRAINT ai_generation_logs_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);


--
-- Name: app_data_migrations app_data_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_data_migrations
    ADD CONSTRAINT app_data_migrations_pkey PRIMARY KEY (name);


--
-- Name: app_errors app_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_errors
    ADD CONSTRAINT app_errors_pkey PRIMARY KEY (id);


--
-- Name: body_metrics body_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.body_metrics
    ADD CONSTRAINT body_metrics_pkey PRIMARY KEY (id);


--
-- Name: cardio_logs cardio_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardio_logs
    ADD CONSTRAINT cardio_logs_pkey PRIMARY KEY (id);


--
-- Name: challenge_participants challenge_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_pkey PRIMARY KEY (challenge_id, student_id);


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- Name: checkins checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_student_id_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_student_id_staff_id_key UNIQUE (student_id, staff_id);


--
-- Name: day_passes day_passes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_passes
    ADD CONSTRAINT day_passes_code_key UNIQUE (code);


--
-- Name: day_passes day_passes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_passes
    ADD CONSTRAINT day_passes_pkey PRIMARY KEY (id);


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: equipment_maintenance_logs equipment_maintenance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_logs
    ADD CONSTRAINT equipment_maintenance_logs_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: equipment_sessions equipment_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_sessions
    ADD CONSTRAINT equipment_sessions_pkey PRIMARY KEY (id);


--
-- Name: equipment_variations equipment_variations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_variations
    ADD CONSTRAINT equipment_variations_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: feed_comments feed_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_comments
    ADD CONSTRAINT feed_comments_pkey PRIMARY KEY (id);


--
-- Name: feed_likes feed_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_likes
    ADD CONSTRAINT feed_likes_pkey PRIMARY KEY (id);


--
-- Name: feed_likes feed_likes_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_likes
    ADD CONSTRAINT feed_likes_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: feed_posts feed_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_pkey PRIMARY KEY (id);


--
-- Name: gym_motivation gym_motivation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gym_motivation
    ADD CONSTRAINT gym_motivation_pkey PRIMARY KEY (gym_id);


--
-- Name: gyms gyms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gyms
    ADD CONSTRAINT gyms_pkey PRIMARY KEY (id);


--
-- Name: gyms gyms_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gyms
    ADD CONSTRAINT gyms_slug_key UNIQUE (slug);


--
-- Name: leaderboard_adjustments leaderboard_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_adjustments
    ADD CONSTRAINT leaderboard_adjustments_pkey PRIMARY KEY (id);


--
-- Name: leaderboard leaderboard_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard
    ADD CONSTRAINT leaderboard_period_key UNIQUE (gym_id, period, week_start, student_id, rank_type);


--
-- Name: leaderboard leaderboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard
    ADD CONSTRAINT leaderboard_pkey PRIMARY KEY (id);


--
-- Name: medical_clearances medical_clearances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_clearances
    ADD CONSTRAINT medical_clearances_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_user_id_key UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: personal_offers personal_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_offers
    ADD CONSTRAINT personal_offers_pkey PRIMARY KEY (id);


--
-- Name: point_events point_events_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_events
    ADD CONSTRAINT point_events_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: point_events point_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_events
    ADD CONSTRAINT point_events_pkey PRIMARY KEY (id);


--
-- Name: premium_requests premium_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_requests
    ADD CONSTRAINT premium_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: progress_photos progress_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_photos
    ADD CONSTRAINT progress_photos_pkey PRIMARY KEY (id);


--
-- Name: promo_campaigns promo_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_campaigns
    ADD CONSTRAINT promo_campaigns_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: slot_checks slot_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_checks
    ADD CONSTRAINT slot_checks_pkey PRIMARY KEY (id);


--
-- Name: sponsors sponsors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT sponsors_pkey PRIMARY KEY (id);


--
-- Name: squad_members squad_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_members
    ADD CONSTRAINT squad_members_pkey PRIMARY KEY (id);


--
-- Name: squad_members squad_members_squad_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_members
    ADD CONSTRAINT squad_members_squad_id_user_id_key UNIQUE (squad_id, user_id);


--
-- Name: squad_messages squad_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_messages
    ADD CONSTRAINT squad_messages_pkey PRIMARY KEY (id);


--
-- Name: squads squads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squads
    ADD CONSTRAINT squads_pkey PRIMARY KEY (id);


--
-- Name: starter_templates starter_templates_gym_id_program_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.starter_templates
    ADD CONSTRAINT starter_templates_gym_id_program_id_key UNIQUE (gym_id, program_id);


--
-- Name: starter_templates starter_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.starter_templates
    ADD CONSTRAINT starter_templates_pkey PRIMARY KEY (id);


--
-- Name: student_achievements student_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_pkey PRIMARY KEY (id);


--
-- Name: student_achievements student_achievements_student_id_achievement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_student_id_achievement_id_key UNIQUE (student_id, achievement_id);


--
-- Name: student_subscriptions student_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: student_trainers student_trainers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_trainers
    ADD CONSTRAINT student_trainers_pkey PRIMARY KEY (id);


--
-- Name: student_trainers student_trainers_student_id_trainer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_trainers
    ADD CONSTRAINT student_trainers_student_id_trainer_id_key UNIQUE (student_id, trainer_id);


--
-- Name: student_workouts student_workouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_workouts
    ADD CONSTRAINT student_workouts_pkey PRIMARY KEY (id);


--
-- Name: tv_content tv_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_content
    ADD CONSTRAINT tv_content_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_outbox whatsapp_outbox_campaign_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_campaign_student_id_key UNIQUE (campaign, student_id);


--
-- Name: whatsapp_outbox whatsapp_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_pkey PRIMARY KEY (id);


--
-- Name: workout_days workout_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_days
    ADD CONSTRAINT workout_days_pkey PRIMARY KEY (id);


--
-- Name: workout_exercises workout_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_exercises
    ADD CONSTRAINT workout_exercises_pkey PRIMARY KEY (id);


--
-- Name: workout_logs workout_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_pkey PRIMARY KEY (id);


--
-- Name: workout_programs workout_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_programs
    ADD CONSTRAINT workout_programs_pkey PRIMARY KEY (id);


--
-- Name: workout_sessions workout_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_pkey PRIMARY KEY (id);


--
-- Name: workout_templates workout_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_templates
    ADD CONSTRAINT workout_templates_pkey PRIMARY KEY (id);


--
-- Name: app_errors_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_errors_created_at_idx ON public.app_errors USING btree (created_at DESC);


--
-- Name: app_errors_fingerprint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_errors_fingerprint_idx ON public.app_errors USING btree (fingerprint, created_at DESC);


--
-- Name: checkins_session_type_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX checkins_session_type_uidx ON public.checkins USING btree (workout_session_id, type) WHERE (workout_session_id IS NOT NULL);


--
-- Name: checkins_student_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkins_student_day_idx ON public.checkins USING btree (student_id, checked_at DESC);


--
-- Name: idx_ai_audit_gym_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_gym_time ON public.ai_audit_logs USING btree (gym_id, created_at);


--
-- Name: idx_ai_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_user ON public.ai_audit_logs USING btree (user_id, created_at);


--
-- Name: idx_cardio_student_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cardio_student_date ON public.cardio_logs USING btree (student_id, date DESC);


--
-- Name: idx_checkins_gym; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_gym ON public.checkins USING btree (gym_id);


--
-- Name: idx_checkins_student_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_student_day ON public.checkins USING btree (student_id, checked_at);


--
-- Name: idx_conv_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_staff ON public.conversations USING btree (staff_id, updated_at DESC);


--
-- Name: idx_conv_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_student ON public.conversations USING btree (student_id, updated_at DESC);


--
-- Name: idx_dm_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dm_conversation ON public.direct_messages USING btree (conversation_id, created_at);


--
-- Name: idx_feed_gym_exp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_gym_exp ON public.feed_posts USING btree (gym_id, expires_at);


--
-- Name: idx_leaderboard_gym_wk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_gym_wk ON public.leaderboard USING btree (gym_id, week_start);


--
-- Name: idx_logs_student_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_student_date ON public.workout_logs USING btree (student_id, date);


--
-- Name: idx_metrics_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_student ON public.body_metrics USING btree (student_id, recorded_at);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, read_at);


--
-- Name: idx_point_events_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_point_events_student ON public.point_events USING btree (student_id, created_at DESC);


--
-- Name: idx_profiles_gym; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_gym ON public.profiles USING btree (gym_id);


--
-- Name: idx_progress_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_student ON public.progress_photos USING btree (student_id, created_at DESC);


--
-- Name: idx_sessions_gym_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_gym_active ON public.equipment_sessions USING btree (gym_id, status);


--
-- Name: idx_sessions_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_student ON public.equipment_sessions USING btree (student_id, status);


--
-- Name: idx_slot_student_prog; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_student_prog ON public.slot_checks USING btree (student_id, program_id, checked_at DESC);


--
-- Name: idx_subs_gym; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subs_gym ON public.student_subscriptions USING btree (gym_id);


--
-- Name: idx_subs_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subs_student ON public.student_subscriptions USING btree (student_id);


--
-- Name: ix_wsession_gym_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wsession_gym_started ON public.workout_sessions USING btree (gym_id, started_at DESC);


--
-- Name: page_views_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_views_created_idx ON public.page_views USING btree (created_at DESC);


--
-- Name: page_views_kind_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_views_kind_created_idx ON public.page_views USING btree (kind, created_at DESC);


--
-- Name: page_views_path_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_views_path_created_idx ON public.page_views USING btree (path, created_at DESC);


--
-- Name: page_views_visitor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_views_visitor_idx ON public.page_views USING btree (visitor_id);


--
-- Name: personal_offers_trainer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_offers_trainer_idx ON public.personal_offers USING btree (trainer_id, active, sort);


--
-- Name: push_subscriptions_gym_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_subscriptions_gym_id_idx ON public.push_subscriptions USING btree (gym_id);


--
-- Name: push_subscriptions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);


--
-- Name: ux_wsession_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_wsession_active ON public.workout_sessions USING btree (student_id) WHERE (status = 'active'::text);


--
-- Name: whatsapp_outbox_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whatsapp_outbox_due_idx ON public.whatsapp_outbox USING btree (status, scheduled_at);


--
-- Name: workout_logs_session_exercise_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX workout_logs_session_exercise_uidx ON public.workout_logs USING btree (workout_session_id, exercise_id) WHERE (workout_session_id IS NOT NULL);


--
-- Name: workout_logs_workout_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workout_logs_workout_session_id_idx ON public.workout_logs USING btree (workout_session_id);


--
-- Name: profiles trg_a_guard_profile_privileged; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_a_guard_profile_privileged BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged();


--
-- Name: cardio_logs trg_award_cardio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_cardio AFTER INSERT ON public.cardio_logs FOR EACH ROW EXECUTE FUNCTION public.award_cardio();


--
-- Name: checkins trg_award_checkin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_checkin AFTER INSERT ON public.checkins FOR EACH ROW EXECUTE FUNCTION public.award_checkin();


--
-- Name: feed_comments trg_award_feed_comment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_feed_comment AFTER INSERT ON public.feed_comments FOR EACH ROW EXECUTE FUNCTION public.award_feed_comment();


--
-- Name: feed_likes trg_award_feed_like; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_feed_like AFTER INSERT ON public.feed_likes FOR EACH ROW EXECUTE FUNCTION public.award_feed_like();


--
-- Name: feed_posts trg_award_feed_post; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_feed_post AFTER INSERT ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.award_feed_post();


--
-- Name: workout_logs trg_award_log_milestones; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_log_milestones AFTER INSERT ON public.workout_logs FOR EACH ROW EXECUTE FUNCTION public.award_log_milestones();


--
-- Name: progress_photos trg_award_progress_photo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_progress_photo AFTER INSERT ON public.progress_photos FOR EACH ROW EXECUTE FUNCTION public.award_progress_photo();


--
-- Name: workout_logs trg_award_workout_achievements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_award_workout_achievements AFTER INSERT ON public.workout_logs FOR EACH ROW EXECUTE FUNCTION public.award_workout_achievements();


--
-- Name: workout_logs trg_bump_leaderboard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bump_leaderboard AFTER INSERT ON public.workout_logs FOR EACH ROW EXECUTE FUNCTION public.bump_leaderboard();


--
-- Name: checkins trg_checkin_duplicate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_checkin_duplicate BEFORE INSERT ON public.checkins FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_checkin();


--
-- Name: profiles trg_default_profile_name; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_default_profile_name BEFORE INSERT OR UPDATE OF name, email ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.default_profile_name();


--
-- Name: notifications trg_dispatch_push; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispatch_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.dispatch_push();


--
-- Name: equipment trg_equipment_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_updated BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: direct_messages trg_notify_direct_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_direct_message AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message();


--
-- Name: feed_comments trg_notify_feed_comment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_feed_comment AFTER INSERT ON public.feed_comments FOR EACH ROW EXECUTE FUNCTION public.notify_feed_activity();


--
-- Name: feed_likes trg_notify_feed_like; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_feed_like AFTER INSERT ON public.feed_likes FOR EACH ROW EXECUTE FUNCTION public.notify_feed_activity();


--
-- Name: feed_posts trg_notify_gym_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_gym_broadcast AFTER INSERT ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.notify_gym_broadcast();


--
-- Name: student_workouts trg_notify_plan_assigned; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_plan_assigned AFTER INSERT ON public.student_workouts FOR EACH ROW EXECUTE FUNCTION public.notify_plan_assigned();


--
-- Name: profiles trg_notify_student_lifecycle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_student_lifecycle AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_student_lifecycle();


--
-- Name: premium_requests trg_notify_student_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_student_request AFTER INSERT ON public.premium_requests FOR EACH ROW EXECUTE FUNCTION public.notify_student_request();


--
-- Name: workout_logs trg_notify_workout_milestones; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_workout_milestones AFTER INSERT ON public.workout_logs FOR EACH ROW EXECUTE FUNCTION public.notify_workout_milestones();


--
-- Name: profiles trg_on_student_approved; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_on_student_approved AFTER UPDATE OF approved_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.on_student_approved();


--
-- Name: personal_offers trg_personal_offers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_personal_offers_updated BEFORE UPDATE ON public.personal_offers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: profiles trg_profiles_medical; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_medical BEFORE INSERT OR UPDATE OF medical_risk ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_medical_clearance();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: workout_programs trg_programs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_programs_updated BEFORE UPDATE ON public.workout_programs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: student_subscriptions trg_subs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.student_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: medical_clearances trg_sync_profile_from_clearance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_profile_from_clearance AFTER INSERT OR DELETE OR UPDATE ON public.medical_clearances FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_clearance();


--
-- Name: achievements achievements_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: ai_audit_logs ai_audit_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_audit_logs
    ADD CONSTRAINT ai_audit_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: ai_audit_logs ai_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_audit_logs
    ADD CONSTRAINT ai_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: ai_generation_logs ai_generation_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generation_logs
    ADD CONSTRAINT ai_generation_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: ai_generation_logs ai_generation_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generation_logs
    ADD CONSTRAINT ai_generation_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: app_errors app_errors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_errors
    ADD CONSTRAINT app_errors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: body_metrics body_metrics_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.body_metrics
    ADD CONSTRAINT body_metrics_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: body_metrics body_metrics_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.body_metrics
    ADD CONSTRAINT body_metrics_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: cardio_logs cardio_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardio_logs
    ADD CONSTRAINT cardio_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: cardio_logs cardio_logs_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cardio_logs
    ADD CONSTRAINT cardio_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: challenge_participants challenge_participants_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: challenges challenges_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE;


--
-- Name: checkins checkins_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: checkins checkins_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: checkins checkins_workout_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES public.workout_sessions(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: conversations conversations_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.profiles(id);


--
-- Name: conversations conversations_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: day_passes day_passes_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_passes
    ADD CONSTRAINT day_passes_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: direct_messages direct_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);


--
-- Name: equipment equipment_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: equipment_maintenance_logs equipment_maintenance_logs_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_logs
    ADD CONSTRAINT equipment_maintenance_logs_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_maintenance_logs equipment_maintenance_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_logs
    ADD CONSTRAINT equipment_maintenance_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: equipment_maintenance_logs equipment_maintenance_logs_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenance_logs
    ADD CONSTRAINT equipment_maintenance_logs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id);


--
-- Name: equipment_sessions equipment_sessions_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_sessions
    ADD CONSTRAINT equipment_sessions_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id);


--
-- Name: equipment_sessions equipment_sessions_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_sessions
    ADD CONSTRAINT equipment_sessions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: equipment_sessions equipment_sessions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_sessions
    ADD CONSTRAINT equipment_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: equipment_sessions equipment_sessions_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_sessions
    ADD CONSTRAINT equipment_sessions_variation_id_fkey FOREIGN KEY (variation_id) REFERENCES public.equipment_variations(id);


--
-- Name: equipment_variations equipment_variations_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_variations
    ADD CONSTRAINT equipment_variations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;


--
-- Name: equipment_variations equipment_variations_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_variations
    ADD CONSTRAINT equipment_variations_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: exercises exercises_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id);


--
-- Name: exercises exercises_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: feed_comments feed_comments_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_comments
    ADD CONSTRAINT feed_comments_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: feed_comments feed_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_comments
    ADD CONSTRAINT feed_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;


--
-- Name: feed_comments feed_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_comments
    ADD CONSTRAINT feed_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: feed_likes feed_likes_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_likes
    ADD CONSTRAINT feed_likes_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: feed_likes feed_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_likes
    ADD CONSTRAINT feed_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON DELETE CASCADE;


--
-- Name: feed_likes feed_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_likes
    ADD CONSTRAINT feed_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: feed_posts feed_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);


--
-- Name: feed_posts feed_posts_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: gym_motivation gym_motivation_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gym_motivation
    ADD CONSTRAINT gym_motivation_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE;


--
-- Name: gym_motivation gym_motivation_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gym_motivation
    ADD CONSTRAINT gym_motivation_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: leaderboard leaderboard_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard
    ADD CONSTRAINT leaderboard_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: leaderboard leaderboard_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard
    ADD CONSTRAINT leaderboard_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: medical_clearances medical_clearances_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_clearances
    ADD CONSTRAINT medical_clearances_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: medical_clearances medical_clearances_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_clearances
    ADD CONSTRAINT medical_clearances_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: notification_settings notification_settings_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: notification_settings notification_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: notifications notifications_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: page_views page_views_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: personal_offers personal_offers_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_offers
    ADD CONSTRAINT personal_offers_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE;


--
-- Name: personal_offers personal_offers_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_offers
    ADD CONSTRAINT personal_offers_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: point_events point_events_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_events
    ADD CONSTRAINT point_events_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE;


--
-- Name: point_events point_events_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_events
    ADD CONSTRAINT point_events_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: premium_requests premium_requests_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_requests
    ADD CONSTRAINT premium_requests_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: premium_requests premium_requests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_requests
    ADD CONSTRAINT premium_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: progress_photos progress_photos_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_photos
    ADD CONSTRAINT progress_photos_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: progress_photos progress_photos_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_photos
    ADD CONSTRAINT progress_photos_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: promo_campaigns promo_campaigns_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_campaigns
    ADD CONSTRAINT promo_campaigns_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE SET NULL;


--
-- Name: promo_campaigns promo_campaigns_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_campaigns
    ADD CONSTRAINT promo_campaigns_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE;


--
-- Name: slot_checks slot_checks_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_checks
    ADD CONSTRAINT slot_checks_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: slot_checks slot_checks_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_checks
    ADD CONSTRAINT slot_checks_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.workout_programs(id) ON DELETE CASCADE;


--
-- Name: slot_checks slot_checks_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_checks
    ADD CONSTRAINT slot_checks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: sponsors sponsors_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT sponsors_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: squad_members squad_members_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_members
    ADD CONSTRAINT squad_members_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: squad_members squad_members_squad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_members
    ADD CONSTRAINT squad_members_squad_id_fkey FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE;


--
-- Name: squad_members squad_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_members
    ADD CONSTRAINT squad_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: squad_messages squad_messages_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_messages
    ADD CONSTRAINT squad_messages_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: squad_messages squad_messages_squad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_messages
    ADD CONSTRAINT squad_messages_squad_id_fkey FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE;


--
-- Name: squad_messages squad_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_messages
    ADD CONSTRAINT squad_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: squads squads_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squads
    ADD CONSTRAINT squads_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: starter_templates starter_templates_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.starter_templates
    ADD CONSTRAINT starter_templates_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE;


--
-- Name: starter_templates starter_templates_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.starter_templates
    ADD CONSTRAINT starter_templates_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.workout_programs(id) ON DELETE CASCADE;


--
-- Name: student_achievements student_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id);


--
-- Name: student_achievements student_achievements_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: student_achievements student_achievements_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_achievements
    ADD CONSTRAINT student_achievements_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: student_subscriptions student_subscriptions_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: student_subscriptions student_subscriptions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_subscriptions
    ADD CONSTRAINT student_subscriptions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: student_trainers student_trainers_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_trainers
    ADD CONSTRAINT student_trainers_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: student_trainers student_trainers_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_trainers
    ADD CONSTRAINT student_trainers_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: student_trainers student_trainers_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_trainers
    ADD CONSTRAINT student_trainers_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id);


--
-- Name: student_workouts student_workouts_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_workouts
    ADD CONSTRAINT student_workouts_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: student_workouts student_workouts_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_workouts
    ADD CONSTRAINT student_workouts_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.workout_programs(id);


--
-- Name: student_workouts student_workouts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_workouts
    ADD CONSTRAINT student_workouts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: tv_content tv_content_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_content
    ADD CONSTRAINT tv_content_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: whatsapp_outbox whatsapp_outbox_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE;


--
-- Name: whatsapp_outbox whatsapp_outbox_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: workout_days workout_days_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_days
    ADD CONSTRAINT workout_days_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: workout_days workout_days_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_days
    ADD CONSTRAINT workout_days_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.workout_programs(id) ON DELETE CASCADE;


--
-- Name: workout_exercises workout_exercises_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_exercises
    ADD CONSTRAINT workout_exercises_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.workout_days(id) ON DELETE CASCADE;


--
-- Name: workout_exercises workout_exercises_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_exercises
    ADD CONSTRAINT workout_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: workout_exercises workout_exercises_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_exercises
    ADD CONSTRAINT workout_exercises_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: workout_exercises workout_exercises_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_exercises
    ADD CONSTRAINT workout_exercises_variation_id_fkey FOREIGN KEY (variation_id) REFERENCES public.equipment_variations(id);


--
-- Name: workout_logs workout_logs_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: workout_logs workout_logs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: workout_logs workout_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.equipment_sessions(id);


--
-- Name: workout_logs workout_logs_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: workout_logs workout_logs_workout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES public.student_workouts(id);


--
-- Name: workout_logs workout_logs_workout_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_logs
    ADD CONSTRAINT workout_logs_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES public.workout_sessions(id) ON DELETE SET NULL;


--
-- Name: workout_programs workout_programs_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_programs
    ADD CONSTRAINT workout_programs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: workout_programs workout_programs_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_programs
    ADD CONSTRAINT workout_programs_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id);


--
-- Name: workout_sessions workout_sessions_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: workout_sessions workout_sessions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);


--
-- Name: workout_sessions workout_sessions_workout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES public.student_workouts(id);


--
-- Name: workout_templates workout_templates_gym_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_templates
    ADD CONSTRAINT workout_templates_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id);


--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: achievements achievements_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY achievements_select ON public.achievements FOR SELECT USING (((gym_id IS NULL) OR (gym_id = public.current_gym_id())));


--
-- Name: leaderboard_adjustments adj_insert_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adj_insert_staff ON public.leaderboard_adjustments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: leaderboard_adjustments adj_read_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adj_read_gym ON public.leaderboard_adjustments FOR SELECT TO authenticated USING (true);


--
-- Name: ai_audit_logs ai_audit_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_audit_insert_own ON public.ai_audit_logs FOR INSERT WITH CHECK (((user_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))));


--
-- Name: ai_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_audit_logs ai_audit_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_audit_select_staff ON public.ai_audit_logs FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: ai_generation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_generation_logs ai_logs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_logs_insert ON public.ai_generation_logs FOR INSERT WITH CHECK (((user_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))));


--
-- Name: ai_generation_logs ai_logs_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_logs_select_staff ON public.ai_generation_logs FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: app_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

--
-- Name: app_data_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_data_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: app_errors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

--
-- Name: body_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: cardio_logs cardio_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cardio_insert_own ON public.cardio_logs FOR INSERT TO authenticated WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: cardio_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: cardio_logs cardio_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cardio_select_own ON public.cardio_logs FOR SELECT TO authenticated USING ((student_id = auth.uid()));


--
-- Name: cardio_logs cardio_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cardio_select_staff ON public.cardio_logs FOR SELECT TO authenticated USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: challenge_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_participants challenge_participants_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenge_participants_select ON public.challenge_participants FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: challenges challenges_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenges_select ON public.challenges FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: challenges challenges_staff_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenges_staff_write ON public.challenges USING (((gym_id = public.current_gym_id()) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])))) WITH CHECK (((gym_id = public.current_gym_id()) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))));


--
-- Name: checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: checkins checkins_insert_gym_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_insert_gym_staff ON public.checkins FOR INSERT TO authenticated WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: checkins checkins_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_insert_own ON public.checkins FOR INSERT WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: checkins checkins_select_gym_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_select_gym_staff ON public.checkins FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: checkins checkins_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_select_own ON public.checkins FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: checkins checkins_select_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_select_trainer ON public.checkins FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.student_trainers st
  WHERE ((st.student_id = checkins.student_id) AND (st.trainer_id = auth.uid()) AND (st.gym_id = public.current_gym_id())))));


--
-- Name: medical_clearances clearances_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clearances_insert_own ON public.medical_clearances FOR INSERT WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: medical_clearances clearances_manage_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clearances_manage_staff ON public.medical_clearances FOR UPDATE USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: medical_clearances clearances_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clearances_select_own ON public.medical_clearances FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: medical_clearances clearances_select_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clearances_select_trainer ON public.medical_clearances FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: feed_comments comments_delete_own_or_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_delete_own_or_manager ON public.feed_comments FOR DELETE USING (((user_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text]))));


--
-- Name: feed_comments comments_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_insert_own ON public.feed_comments FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: feed_comments comments_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_select_gym ON public.feed_comments FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: conversations conv_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conv_participant ON public.conversations TO authenticated USING (((student_id = auth.uid()) OR (staff_id = auth.uid()))) WITH CHECK (((student_id = auth.uid()) OR (staff_id = auth.uid())));


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: day_passes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.day_passes ENABLE ROW LEVEL SECURITY;

--
-- Name: day_passes day_passes_insert_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_passes_insert_anon ON public.day_passes FOR INSERT WITH CHECK (true);


--
-- Name: day_passes day_passes_manage_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_passes_manage_manager ON public.day_passes USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: day_passes day_passes_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_passes_select_staff ON public.day_passes FOR SELECT USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_days days_insert_trainer_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY days_insert_trainer_gym ON public.workout_days FOR INSERT WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_days days_select_student; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY days_select_student ON public.workout_days FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.student_workouts sw
  WHERE ((sw.program_id = workout_days.program_id) AND (sw.student_id = auth.uid())))));


--
-- Name: workout_days days_select_trainer_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY days_select_trainer_gym ON public.workout_days FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_days days_update_trainer_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY days_update_trainer_gym ON public.workout_days FOR UPDATE USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: direct_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: direct_messages dm_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dm_participant ON public.direct_messages TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = direct_messages.conversation_id) AND ((c.student_id = auth.uid()) OR (c.staff_id = auth.uid())))))) WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = direct_messages.conversation_id) AND ((c.student_id = auth.uid()) OR (c.staff_id = auth.uid())))))));


--
-- Name: equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_maintenance_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_maintenance_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment equipment_manage_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_manage_manager ON public.equipment USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: equipment equipment_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_select_gym ON public.equipment FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: equipment_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_variations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_variations ENABLE ROW LEVEL SECURITY;

--
-- Name: equipment_variations equipment_variations_manage_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_variations_manage_manager ON public.equipment_variations USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: equipment_variations equipment_variations_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY equipment_variations_select_gym ON public.equipment_variations FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: exercises exercises_manage_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_manage_manager ON public.exercises USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND ((gym_id = public.current_gym_id()) OR (gym_id IS NULL)))) WITH CHECK (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: exercises exercises_manage_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_manage_staff ON public.exercises TO authenticated USING (((gym_id = public.current_gym_id()) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])))) WITH CHECK (((gym_id = public.current_gym_id()) AND (gym_id IS NOT NULL) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))));


--
-- Name: exercises exercises_select_gym_or_global; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_select_gym_or_global ON public.exercises FOR SELECT USING (((gym_id IS NULL) OR (gym_id = public.current_gym_id())));


--
-- Name: feed_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: feed_posts feed_delete_own_or_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feed_delete_own_or_manager ON public.feed_posts FOR DELETE USING (((author_id = auth.uid()) OR ((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))));


--
-- Name: feed_posts feed_insert_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feed_insert_gym ON public.feed_posts FOR INSERT WITH CHECK (((author_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: feed_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: feed_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: feed_posts feed_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY feed_select_gym ON public.feed_posts FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: gym_motivation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gym_motivation ENABLE ROW LEVEL SECURITY;

--
-- Name: gyms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

--
-- Name: gyms gyms_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gyms_select_own ON public.gyms FOR SELECT USING ((id = public.current_gym_id()));


--
-- Name: leaderboard; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

--
-- Name: leaderboard_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leaderboard_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: leaderboard leaderboard_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leaderboard_select_gym ON public.leaderboard FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: leaderboard leaderboard_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leaderboard_system ON public.leaderboard USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: feed_likes likes_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY likes_delete_own ON public.feed_likes FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: feed_likes likes_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY likes_insert_own ON public.feed_likes FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: feed_likes likes_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY likes_select_gym ON public.feed_likes FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: workout_logs logs_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_insert_own ON public.workout_logs FOR INSERT WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_logs logs_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_select_own ON public.workout_logs FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: workout_logs logs_select_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_select_trainer ON public.workout_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.student_trainers st
  WHERE ((st.student_id = st.student_id) AND (st.trainer_id = auth.uid()) AND (st.gym_id = public.current_gym_id())))));


--
-- Name: workout_logs logs_select_trainer_linked; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_select_trainer_linked ON public.workout_logs FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: equipment_maintenance_logs maintenance_insert_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY maintenance_insert_staff ON public.equipment_maintenance_logs FOR INSERT WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: equipment_maintenance_logs maintenance_manage_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY maintenance_manage_manager ON public.equipment_maintenance_logs USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: equipment_maintenance_logs maintenance_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY maintenance_select_gym ON public.equipment_maintenance_logs FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: medical_clearances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medical_clearances ENABLE ROW LEVEL SECURITY;

--
-- Name: body_metrics metrics_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_insert_own ON public.body_metrics FOR INSERT WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: body_metrics metrics_insert_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_insert_trainer ON public.body_metrics FOR INSERT WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: body_metrics metrics_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_select_own ON public.body_metrics FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: body_metrics metrics_select_trainer_linked; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_select_trainer_linked ON public.body_metrics FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: body_metrics metrics_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY metrics_update_own ON public.body_metrics FOR UPDATE TO authenticated USING ((student_id = auth.uid())) WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: gym_motivation motivation_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY motivation_read_all ON public.gym_motivation FOR SELECT USING (true);


--
-- Name: gym_motivation motivation_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY motivation_staff_insert ON public.gym_motivation FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (p.gym_id = gym_motivation.gym_id)))));


--
-- Name: gym_motivation motivation_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY motivation_staff_update ON public.gym_motivation FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (p.gym_id = gym_motivation.gym_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (p.gym_id = gym_motivation.gym_id)))));


--
-- Name: notification_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_insert_own ON public.notifications FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: notification_settings nsettings_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nsettings_insert_own ON public.notification_settings FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: notification_settings nsettings_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nsettings_select_own ON public.notification_settings FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: notification_settings nsettings_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nsettings_update_own ON public.notification_settings FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: page_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

--
-- Name: page_views page_views_insert_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY page_views_insert_anon ON public.page_views FOR INSERT TO authenticated, anon WITH CHECK (((path ~~ '/%'::text) AND (char_length(path) < 160) AND ((cta IS NULL) OR (cta ~~ '/%'::text)) AND ((char_length(COALESCE(visitor_id, ''::text)) >= 8) AND (char_length(COALESCE(visitor_id, ''::text)) <= 64))));


--
-- Name: page_views page_views_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY page_views_select_staff ON public.page_views FOR SELECT TO authenticated USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: partners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

--
-- Name: partners partners_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY partners_select ON public.partners FOR SELECT USING ((active = true));


--
-- Name: partners partners_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY partners_staff ON public.partners TO authenticated USING (true) WITH CHECK (true);


--
-- Name: personal_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personal_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: personal_offers personal_offers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY personal_offers_delete ON public.personal_offers FOR DELETE USING (((gym_id = public.current_gym_id()) AND ((trainer_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])))));


--
-- Name: personal_offers personal_offers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY personal_offers_insert ON public.personal_offers FOR INSERT WITH CHECK (((gym_id = public.current_gym_id()) AND (((trainer_id = auth.uid()) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))) OR (public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])))));


--
-- Name: personal_offers personal_offers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY personal_offers_select ON public.personal_offers FOR SELECT USING (((gym_id = public.current_gym_id()) AND (active OR (trainer_id = auth.uid()))));


--
-- Name: personal_offers personal_offers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY personal_offers_update ON public.personal_offers FOR UPDATE USING (((gym_id = public.current_gym_id()) AND ((trainer_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text]))))) WITH CHECK (((gym_id = public.current_gym_id()) AND ((trainer_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])))));


--
-- Name: point_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;

--
-- Name: point_events point_events_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY point_events_select_own ON public.point_events FOR SELECT USING (((student_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))));


--
-- Name: progress_photos pphoto_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pphoto_delete_own ON public.progress_photos FOR DELETE TO authenticated USING ((student_id = auth.uid()));


--
-- Name: progress_photos pphoto_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pphoto_insert_own ON public.progress_photos FOR INSERT TO authenticated WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: progress_photos pphoto_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pphoto_select_own ON public.progress_photos FOR SELECT TO authenticated USING ((student_id = auth.uid()));


--
-- Name: progress_photos pphoto_select_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pphoto_select_trainer ON public.progress_photos FOR SELECT TO authenticated USING (((visibility = 'trainer'::text) AND (gym_id = public.current_gym_id()) AND ((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) OR (EXISTS ( SELECT 1
   FROM public.student_trainers st
  WHERE ((st.student_id = progress_photos.student_id) AND (st.trainer_id = auth.uid())))))));


--
-- Name: progress_photos pphoto_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pphoto_update_own ON public.progress_photos FOR UPDATE TO authenticated USING ((student_id = auth.uid())) WITH CHECK ((student_id = auth.uid()));


--
-- Name: premium_requests premium_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY premium_insert_own ON public.premium_requests FOR INSERT WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: premium_requests premium_manage_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY premium_manage_staff ON public.premium_requests FOR UPDATE USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: premium_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.premium_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: premium_requests premium_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY premium_select_own ON public.premium_requests FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: premium_requests premium_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY premium_select_staff ON public.premium_requests FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: premium_requests premium_select_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY premium_select_trainer ON public.premium_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.student_trainers st
  WHERE ((st.student_id = st.student_id) AND (st.trainer_id = auth.uid()) AND (st.gym_id = public.current_gym_id())))));


--
-- Name: premium_requests premium_update_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY premium_update_trainer ON public.premium_requests FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.student_trainers st
  WHERE ((st.student_id = st.student_id) AND (st.trainer_id = auth.uid()) AND (st.gym_id = public.current_gym_id())))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select_gym_by_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_gym_by_manager ON public.profiles FOR SELECT USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: profiles profiles_select_gym_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_gym_staff ON public.profiles FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()) AND ((role = 'student'::text) OR (id = auth.uid()))));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: progress_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_campaigns promo_campaigns_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_campaigns_select ON public.promo_campaigns FOR SELECT USING (((gym_id = public.current_gym_id()) AND ((active AND ((now() >= starts_at) AND (now() <= ends_at))) OR (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])))));


--
-- Name: promo_campaigns promo_campaigns_staff_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promo_campaigns_staff_write ON public.promo_campaigns USING (((gym_id = public.current_gym_id()) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])))) WITH CHECK (((gym_id = public.current_gym_id()) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))));


--
-- Name: push_subscriptions ps_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ps_delete_own ON public.push_subscriptions FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions ps_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ps_insert_own ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_subscriptions ps_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ps_select_own ON public.push_subscriptions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: student_achievements sachievements_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sachievements_insert ON public.student_achievements FOR INSERT WITH CHECK (((student_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text]))));


--
-- Name: student_achievements sachievements_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sachievements_select_own ON public.student_achievements FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: student_achievements sachievements_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sachievements_select_staff ON public.student_achievements FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: equipment_sessions sessions_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_insert_own ON public.equipment_sessions FOR INSERT WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: equipment_sessions sessions_select_gym_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_select_gym_staff ON public.equipment_sessions FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: equipment_sessions sessions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_select_own ON public.equipment_sessions FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: equipment_sessions sessions_update_gym_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_update_gym_staff ON public.equipment_sessions FOR UPDATE TO authenticated USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: equipment_sessions sessions_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_update_own ON public.equipment_sessions FOR UPDATE USING ((student_id = auth.uid())) WITH CHECK ((student_id = auth.uid()));


--
-- Name: slot_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slot_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: slot_checks slot_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY slot_insert_own ON public.slot_checks FOR INSERT TO authenticated WITH CHECK (((student_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: slot_checks slot_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY slot_select_own ON public.slot_checks FOR SELECT TO authenticated USING ((student_id = auth.uid()));


--
-- Name: slot_checks slot_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY slot_select_staff ON public.slot_checks FOR SELECT TO authenticated USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: squad_members smembers_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY smembers_insert_own ON public.squad_members FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (gym_id = public.current_gym_id())));


--
-- Name: squad_members smembers_join; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY smembers_join ON public.squad_members FOR DELETE USING (((user_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text]))));


--
-- Name: squad_members smembers_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY smembers_select_gym ON public.squad_members FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: squad_messages smessages_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY smessages_insert_member ON public.squad_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.squad_members sm
  WHERE ((sm.squad_id = squad_messages.squad_id) AND (sm.user_id = auth.uid())))));


--
-- Name: squad_messages smessages_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY smessages_select_member ON public.squad_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.squad_members sm
  WHERE ((sm.squad_id = squad_messages.squad_id) AND (sm.user_id = auth.uid())))));


--
-- Name: sponsors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

--
-- Name: sponsors sponsors_manage_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sponsors_manage_manager ON public.sponsors USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND ((gym_id IS NULL) OR (gym_id = public.current_gym_id())))) WITH CHECK (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND ((gym_id IS NULL) OR (gym_id = public.current_gym_id()))));


--
-- Name: sponsors sponsors_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sponsors_select_gym ON public.sponsors FOR SELECT USING (((gym_id IS NULL) OR (gym_id = public.current_gym_id())));


--
-- Name: squad_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

--
-- Name: squad_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squad_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: squads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

--
-- Name: squads squads_insert_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squads_insert_trainer ON public.squads FOR INSERT WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: squads squads_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squads_select_gym ON public.squads FOR SELECT USING ((gym_id = public.current_gym_id()));


--
-- Name: starter_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.starter_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: starter_templates starter_templates_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY starter_templates_staff_select ON public.starter_templates FOR SELECT USING (((gym_id = public.current_gym_id()) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))));


--
-- Name: starter_templates starter_templates_staff_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY starter_templates_staff_write ON public.starter_templates USING (((gym_id = public.current_gym_id()) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])))) WITH CHECK (((gym_id = public.current_gym_id()) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))));


--
-- Name: student_trainers strainers_assign_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY strainers_assign_trainer ON public.student_trainers FOR INSERT WITH CHECK (((trainer_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text]))));


--
-- Name: student_trainers strainers_select_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY strainers_select_manager ON public.student_trainers FOR SELECT USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: student_trainers strainers_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY strainers_select_self ON public.student_trainers FOR SELECT USING (((student_id = auth.uid()) OR (trainer_id = auth.uid())));


--
-- Name: student_achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: student_subscriptions student_subs_manage_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_subs_manage_manager ON public.student_subscriptions USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: student_subscriptions student_subs_select_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_subs_select_manager ON public.student_subscriptions FOR SELECT USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: student_subscriptions student_subs_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_subs_select_own ON public.student_subscriptions FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: student_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: student_trainers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_trainers ENABLE ROW LEVEL SECURITY;

--
-- Name: student_workouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_workouts ENABLE ROW LEVEL SECURITY;

--
-- Name: student_workouts sworkouts_insert_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sworkouts_insert_trainer ON public.student_workouts FOR INSERT WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: student_workouts sworkouts_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sworkouts_select_own ON public.student_workouts FOR SELECT USING ((student_id = auth.uid()));


--
-- Name: student_workouts sworkouts_select_trainer_linked; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sworkouts_select_trainer_linked ON public.student_workouts FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: student_workouts sworkouts_update_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sworkouts_update_staff ON public.student_workouts FOR UPDATE TO authenticated USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_templates templates_select_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY templates_select_gym ON public.workout_templates FOR SELECT USING (((gym_id IS NULL) OR (gym_id = public.current_gym_id())));


--
-- Name: tv_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tv_content ENABLE ROW LEVEL SECURITY;

--
-- Name: tv_content tv_content_manage_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tv_content_manage_manager ON public.tv_content USING (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: tv_content tv_content_select_active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tv_content_select_active ON public.tv_content FOR SELECT USING ((active = true));


--
-- Name: workout_exercises wex_insert_trainer_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wex_insert_trainer_gym ON public.workout_exercises FOR INSERT WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_exercises wex_select_student; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wex_select_student ON public.workout_exercises FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.student_workouts sw
     JOIN public.workout_days d ON ((d.program_id = sw.program_id)))
  WHERE ((d.id = workout_exercises.day_id) AND (sw.student_id = auth.uid())))));


--
-- Name: workout_exercises wex_select_trainer_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wex_select_trainer_gym ON public.workout_exercises FOR SELECT USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_exercises wex_update_trainer_gym; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wex_update_trainer_gym ON public.workout_exercises FOR UPDATE USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: whatsapp_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_days ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_logs_backup_20261026; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_logs_backup_20261026 ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: workout_programs workouts_insert_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workouts_insert_trainer ON public.workout_programs FOR INSERT TO authenticated WITH CHECK (((gym_id = public.current_gym_id()) AND ((trainer_id = auth.uid()) OR (public."current_role"() = ANY (ARRAY['manager'::text, 'admin'::text]))) AND (public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text]))));


--
-- Name: workout_programs workouts_select_student; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workouts_select_student ON public.workout_programs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.student_workouts sw
  WHERE ((sw.program_id = workout_programs.id) AND (sw.student_id = auth.uid())))));


--
-- Name: workout_programs workouts_select_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workouts_select_trainer ON public.workout_programs FOR SELECT TO authenticated USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_programs workouts_update_trainer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workouts_update_trainer ON public.workout_programs FOR UPDATE TO authenticated USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_sessions wsession_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wsession_insert_own ON public.workout_sessions FOR INSERT TO authenticated WITH CHECK ((student_id = auth.uid()));


--
-- Name: workout_sessions wsession_select_gym_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wsession_select_gym_staff ON public.workout_sessions FOR SELECT TO authenticated USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_sessions wsession_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wsession_select_own ON public.workout_sessions FOR SELECT TO authenticated USING ((student_id = auth.uid()));


--
-- Name: workout_sessions wsession_update_gym_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wsession_update_gym_staff ON public.workout_sessions FOR UPDATE TO authenticated USING (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id()))) WITH CHECK (((public."current_role"() = ANY (ARRAY['trainer'::text, 'manager'::text, 'admin'::text])) AND (gym_id = public.current_gym_id())));


--
-- Name: workout_sessions wsession_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wsession_update_own ON public.workout_sessions FOR UPDATE TO authenticated USING ((student_id = auth.uid())) WITH CHECK ((student_id = auth.uid()));


--
-- PostgreSQL database dump complete
--


