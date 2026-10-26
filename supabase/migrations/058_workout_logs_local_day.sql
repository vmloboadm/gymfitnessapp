-- 058_workout_logs_local_day.sql
-- Fecha o fuso do treino de ponta a ponta:
--   1) `workout_logs.date` passa a ser o instante UTC de verdade.
--   2) Toda contagem por dia/semana/mês usa America/Sao_Paulo.
--   3) Backfill único dos logs antigos, que foram gravados com o relógio
--      local "como se fosse UTC" (3h de deslocamento).
--
-- O backup fica em public.workout_logs_backup_20261026. O marcador em
-- public.app_data_migrations impede que o backfill rode duas vezes.

-- ===== 1) helper de dia local =====
create or replace function public.local_day(ts timestamptz)
returns date
language sql
stable
parallel safe
as $$
  select (ts at time zone 'America/Sao_Paulo')::date
$$;

grant execute on function public.local_day(timestamptz) to authenticated;

-- ===== 2) sequência (streak) no dia local =====
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
begin
  -- se hoje ainda não treinou, a sequência conta até ontem
  if not exists (
    select 1 from public.workout_logs
    where student_id = p_student and public.local_day(date) = d
  ) then
    d := d - 1;
  end if;
  loop
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

-- ===== 3) notificações de marcos no dia local =====
create or replace function public.notify_workout_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

-- ===== 4) conquistas no dia local =====
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
  aid uuid;
  aname_full text;
  fresh boolean;
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
    from public.workout_logs where student_id = NEW.student_id and public.local_day(date) >= ws;
    streak := public.day_streak(NEW.student_id);
    select coalesce(array_length(available_days, 1), 3) into goal
    from public.profiles where id = NEW.student_id;
    select coalesce(nullif(name, ''), 'Atleta') into aname
    from public.profiles where id = NEW.student_id;
    firstn := split_part(aname, ' ', 1);
    disp := firstn || case when split_part(aname, ' ', 2) <> '' then ' ' || left(split_part(aname, ' ', 2), 1) || '.' else '' end;

    -- first_workout
    if total_days = 1 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'first_workout', disp, firstn, 'fez o primeiro treino!');
    end if;
    -- workout_10 / workout_50
    if total_days = 10 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'workout_10', disp, firstn, 'completou 10 treinos!');
    end if;
    if total_days = 50 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'workout_50', disp, firstn, 'completou 50 treinos!');
    end if;
    -- streak_3 (sino, sem post) / streak_7 / streak_30 (com post)
    if streak = 3 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'streak_3', disp, firstn, 'chegou a 3 dias seguidos!', false);
    end if;
    if streak = 7 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'streak_7', disp, firstn, 'chegou a 7 dias seguidos!');
    end if;
    if streak = 30 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'streak_30', disp, firstn, 'chegou a 30 dias seguidos!');
    end if;
    -- week_goal (meta da semana)
    if sessions_week >= goal and goal > 0 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'week_goal', disp, firstn, 'concluiu o objetivo semanal!');
    end if;
    -- month_12
    if month_days = 12 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'month_12', disp, firstn, 'treinou 12 dias no mês!');
    end if;
  exception when others then
    raise warning 'award_workout_achievements falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;

-- ===== 5) leaderboard semanal/mensal no dia local =====
create or replace function public.recompute_leaderboard(p_student uuid, p_gym uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

-- ===== 6) ranking de 90 dias no dia local =====
create or replace function public.ranking_90d(p_gym_id uuid)
returns table (student_id uuid, sessions integer, load_kg numeric, points integer)
language sql
stable
security definer
set search_path = public
as $function$
  select
    student_id,
    count(distinct public.local_day(date))::int as sessions,
    coalesce(sum(coalesce(weight_kg, 0) * coalesce(reps, 0)), 0) as load_kg,
    (count(distinct public.local_day(date)) * 100 + floor(coalesce(sum(coalesce(weight_kg, 0) * coalesce(reps, 0)), 0) / 100))::int as points
  from public.workout_logs
  where gym_id = p_gym_id
    and public.local_day(date) >= (now() at time zone 'America/Sao_Paulo')::date - 90
  group by student_id
  order by points desc
  limit 50;
$function$;

grant execute on function public.ranking_90d(uuid) to authenticated;

-- ===== 7) backfill único + backup =====
create table if not exists public.app_data_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.workout_logs_backup_20261026 as table public.workout_logs;

do $$
begin
  if not exists (
    select 1 from public.app_data_migrations where name = '2026-10-26_workout_logs_utc'
  ) then
    update public.workout_logs
      set date = date + interval '3 hours';
    insert into public.app_data_migrations (name) values ('2026-10-26_workout_logs_utc');
  end if;
end $$;
