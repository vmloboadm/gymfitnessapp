-- 040_rankings_periods_achievements.sql
-- Rankings semanal, mensal e geral + motor de conquistas com notícia no feed.
--   1) leaderboard ganha period (week/month/all); 90 dias via função agregada.
--   2) conquistas novas (meta da semana, mês em dia, cardio) + premiação
--      automática a partir dos treinos (idempotente por UNIQUE).
--   3) conquista liberada vira post no feed (nome + avatar + texto) + sino.
--   4) reações no feed (curtir, fogo, palmas); curtida e comentário avisam o autor.
--   5) comunicado do staff vira recado no sino de todos os alunos.

-- ===== 1) períodos no leaderboard =====
alter table public.leaderboard
  add column if not exists period text not null default 'week'
  check (period in ('week', 'month', 'all'));

alter table public.leaderboard drop constraint if exists leaderboard_gym_id_week_start_student_id_rank_type_key;
alter table public.leaderboard
  add constraint leaderboard_period_key
  unique (gym_id, period, week_start, student_id, rank_type);

-- ===== 2) novas conquistas =====
insert into public.achievements (gym_id, code, name, description, points) values
  (null, 'week_goal', 'Meta da semana', 'Completou os treinos da meta semanal', 120),
  (null, 'month_12', 'Mês em dia', 'Treinou 12 dias no mês', 150),
  (null, 'cardio_first', 'Primeiro cardio', 'Registrou o primeiro cardio', 30),
  (null, 'cardio_180', 'Coração forte', 'Somou 180 minutos de cardio no mês', 120)
on conflict (code) do nothing;

-- ===== 3) motor de leaderboard por período (recalcula do zero a cada treino) =====
create or replace function public.bump_leaderboard()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  ws date := date_trunc('week', NEW.date)::date;
  ms date := date_trunc('month', NEW.date)::date;
  sess_w integer; load_w numeric;
  sess_m integer; load_m numeric;
  sess_a integer; load_a numeric;
  cur_streak integer;
begin
  begin
    select count(distinct date::date), coalesce(sum(coalesce(weight_kg, 0) * coalesce(reps, 0)), 0)
      into sess_w, load_w from public.workout_logs
      where student_id = NEW.student_id and date::date >= ws;
    select count(distinct date::date), coalesce(sum(coalesce(weight_kg, 0) * coalesce(reps, 0)), 0)
      into sess_m, load_m from public.workout_logs
      where student_id = NEW.student_id and date::date >= ms;
    select count(distinct date::date), coalesce(sum(coalesce(weight_kg, 0) * coalesce(reps, 0)), 0)
      into sess_a, load_a from public.workout_logs
      where student_id = NEW.student_id;
    cur_streak := public.day_streak(NEW.student_id);

    insert into public.leaderboard (gym_id, period, week_start, student_id, rank_type, points, load_kg, sessions, streak)
    values
      (NEW.gym_id, 'week', ws, NEW.student_id, 'load', sess_w * 100 + floor(load_w / 100)::int, load_w, sess_w, cur_streak),
      (NEW.gym_id, 'month', ms, NEW.student_id, 'load', sess_m * 100 + floor(load_m / 100)::int, load_m, sess_m, cur_streak),
      (NEW.gym_id, 'all', '2000-01-01', NEW.student_id, 'load', sess_a * 100 + floor(load_a / 100)::int, load_a, sess_a, cur_streak)
    on conflict (gym_id, period, week_start, student_id, rank_type) do update set
      sessions = excluded.sessions,
      load_kg = excluded.load_kg,
      points = excluded.points,
      streak = excluded.streak;
  exception when others then
    raise warning 'bump_leaderboard falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;

-- ===== 4) ranking de 90 dias (agregado sob demanda, só totais) =====
create or replace function public.ranking_90d(p_gym_id uuid)
returns table (student_id uuid, sessions integer, load_kg numeric, points integer)
language sql
stable
security definer
set search_path = public
as $function$
  select
    student_id,
    count(distinct date::date)::int as sessions,
    coalesce(sum(coalesce(weight_kg, 0) * coalesce(reps, 0)), 0) as load_kg,
    (count(distinct date::date) * 100 + floor(coalesce(sum(coalesce(weight_kg, 0) * coalesce(reps, 0)), 0) / 100))::int as points
  from public.workout_logs
  where gym_id = p_gym_id and date >= current_date - 90
  group by student_id
  order by points desc
  limit 50;
$function$;

grant execute on function public.ranking_90d(uuid) to authenticated;

-- ===== 5) premiação automática + notícia no feed =====
create or replace function public.award_workout_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  ws date := date_trunc('week', NEW.date)::date;
  ms date := date_trunc('month', NEW.date)::date;
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
        and date::date = NEW.date::date
        and id <> NEW.id
    ) into first_today;
    if not first_today then
      return NEW;
    end if;

    select count(distinct date::date) into total_days
    from public.workout_logs where student_id = NEW.student_id;
    select count(distinct date::date) into month_days
    from public.workout_logs where student_id = NEW.student_id and date::date >= ms;
    select count(distinct date::date) into sessions_week
    from public.workout_logs where student_id = NEW.student_id and date::date >= ws;
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

-- premia (idempotente) e, se for inédita, publica no feed + avisa no sino
create or replace function public.grant_achievement(
  p_gym uuid, p_student uuid, p_code text,
  p_disp text, p_first text, p_action text, p_post boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  aid uuid;
  aname text;
  inserted_count integer;
  fresh boolean;
begin
  select id, name into aid, aname from public.achievements where code = p_code;
  if aid is null then
    return;
  end if;

  insert into public.student_achievements (gym_id, student_id, achievement_id)
  values (p_gym, p_student, aid)
  on conflict (student_id, achievement_id) do nothing;

  get diagnostics inserted_count = row_count;
  fresh := inserted_count > 0;

  if not fresh then
    return;
  end if;

  insert into public.notifications (gym_id, user_id, channel, title, body)
  values (p_gym, p_student, 'in_app', 'Conquista liberada: ' || aname,
    'Você ganhou a conquista ' || aname || '. Ela já apareceu no feed da academia.');

  if p_post then
    insert into public.feed_posts (gym_id, author_id, type, body, expires_at)
    values (p_gym, p_student, 'conquista',
      p_disp || ' ' || p_action || ' Parabéns, ' || p_first || '! 🎉❤️',
      now() + interval '30 days');
  end if;
exception when others then
  raise warning 'grant_achievement falhou: %', sqlerrm;
end;
$function$;

drop trigger if exists trg_award_workout_achievements on public.workout_logs;
create trigger trg_award_workout_achievements
after insert on public.workout_logs
for each row execute function public.award_workout_achievements();

-- ===== 6) reações no feed =====
alter table public.feed_likes
  add column if not exists reaction text not null default 'like'
  check (reaction in ('like', 'fire', 'clap'));

-- ===== 7) curtida e comentário avisam o autor (sem duplicar) =====
create or replace function public.notify_feed_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists trg_notify_feed_like on public.feed_likes;
create trigger trg_notify_feed_like
after insert on public.feed_likes
for each row execute function public.notify_feed_activity();

drop trigger if exists trg_notify_feed_comment on public.feed_comments;
create trigger trg_notify_feed_comment
after insert on public.feed_comments
for each row execute function public.notify_feed_activity();

-- ===== 8) comunicado do staff vira recado no sino dos alunos =====
create or replace function public.notify_gym_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists trg_notify_gym_broadcast on public.feed_posts;
create trigger trg_notify_gym_broadcast
after insert on public.feed_posts
for each row execute function public.notify_gym_broadcast();
