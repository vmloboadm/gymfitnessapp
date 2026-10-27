-- 062_schedule_streak_achievements.sql
-- Streak respeita os dias programados do plano. Domingo de descanso não
-- quebra sequência. Conquistas usam a mesma regra e limiares idempotentes.

create or replace function public.weekday_number(p_label text)
returns integer
language sql
immutable
as $function$
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
$function$;

create or replace function public.student_scheduled_days(p_student uuid)
returns integer[]
language sql
stable
security definer
set search_path = public
as $function$
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
$function$;

create or replace function public.day_streak(p_student uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  s integer := 0;
  d date := (now() at time zone 'America/Sao_Paulo')::date;
  scheduled integer[] := public.student_scheduled_days(p_student);
  guard integer := 0;
begin
  -- Se hoje ainda não treinou, a sequência conta até ontem. Hoje programado
  -- e não feito não quebra antes do dia terminar.
  if not exists (
    select 1 from public.workout_logs
    where student_id = p_student and public.local_day(date) = d
  ) then
    d := d - 1;
  end if;

  while guard < 370 loop
    guard := guard + 1;

    -- Dia de descanso não interrompe e não soma.
    if not (extract(isodow from d)::int = any(scheduled)) then
      d := d - 1;
      continue;
    end if;

    exit when not exists (
      select 1 from public.workout_logs
      where student_id = p_student and public.local_day(date) = d
    );

    s := s + 1;
    d := d - 1;
  end loop;

  return s;
end;
$function$;

create or replace function public.award_workout_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

grant execute on function public.day_streak(uuid) to authenticated;
grant execute on function public.student_scheduled_days(uuid) to authenticated;
