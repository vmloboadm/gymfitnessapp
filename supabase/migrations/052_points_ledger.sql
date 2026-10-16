-- 052_points_ledger.sql
-- Gamificação por AÇÕES, concedida no servidor (sem opção de roubar).
--   1) ledger point_events (fonte única) + dedupe por ação (anti-farm).
--   2) recompute_leaderboard soma os pontos de ação ao placar por período.
--   3) premiação automática: post no feed, curtida, comentário, foto e check-in.
--   4) notificação "você ganhou X pontos" a cada ação.
--   5) RPC treinar_junto (convite de treino -> ambos ganham 30).

-- ===== 1) ledger =====
create table if not exists public.point_events (
  id uuid primary key default uuid_generate_v4(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  points integer not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_point_events_student on public.point_events (student_id, created_at desc);

alter table public.point_events enable row level security;

drop policy if exists point_events_select_own on public.point_events;
create policy point_events_select_own on public.point_events
  for select using (student_id = auth.uid() or public.current_role() in ('trainer','manager','admin'));

-- ===== 2) recompute do placar (treino + ações) =====
create or replace function public.recompute_leaderboard(p_student uuid, p_gym uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  ws date := date_trunc('week', now())::date;
  ms date := date_trunc('month', now())::date;
  sess_w int; load_w numeric; sess_m int; load_m numeric; sess_a int; load_a numeric;
  pts_w int; pts_m int; pts_a int; cur_streak int;
begin
  select count(distinct date::date), coalesce(sum(coalesce(weight_kg,0)*coalesce(reps,0)),0)
    into sess_a, load_a from public.workout_logs where student_id = p_student;
  select count(distinct date::date), coalesce(sum(coalesce(weight_kg,0)*coalesce(reps,0)),0)
    into sess_w, load_w from public.workout_logs where student_id = p_student and date::date >= ws;
  select count(distinct date::date), coalesce(sum(coalesce(weight_kg,0)*coalesce(reps,0)),0)
    into sess_m, load_m from public.workout_logs where student_id = p_student and date::date >= ms;

  select coalesce(sum(points),0) into pts_a from public.point_events where student_id = p_student;
  select coalesce(sum(points),0) into pts_w from public.point_events where student_id = p_student and created_at >= ws;
  select coalesce(sum(points),0) into pts_m from public.point_events where student_id = p_student and created_at >= ms;

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

-- bump_leaderboard passa a usar o recompute (mantém o comportamento antigo + ações)
create or replace function public.bump_leaderboard()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  begin
    perform public.recompute_leaderboard(NEW.student_id, NEW.gym_id);
  exception when others then
    raise warning 'bump_leaderboard falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;

-- ===== 3) concede pontos (idempotente) + notifica =====
create or replace function public.add_points(
  p_gym uuid, p_student uuid, p_source text, p_points int, p_key text, p_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

-- ===== 4) gatilhos de ações =====
create or replace function public.award_feed_post() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  if NEW.author_id is not null and not NEW.is_pinned then
    perform public.add_points(NEW.gym_id, NEW.author_id, 'feed_post', 10, 'post:'||NEW.id, 'postar no feed');
  end if;
  return NEW;
end; $f$;
drop trigger if exists trg_award_feed_post on public.feed_posts;
create trigger trg_award_feed_post after insert on public.feed_posts
  for each row execute function public.award_feed_post();

create or replace function public.award_feed_like() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  perform public.add_points(NEW.gym_id, NEW.user_id, 'feed_like', 2, 'like:'||NEW.post_id||':'||NEW.user_id, 'curtir uma publicação');
  return NEW;
end; $f$;
drop trigger if exists trg_award_feed_like on public.feed_likes;
create trigger trg_award_feed_like after insert on public.feed_likes
  for each row execute function public.award_feed_like();

create or replace function public.award_feed_comment() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  perform public.add_points(NEW.gym_id, NEW.user_id, 'feed_comment', 3, 'comment:'||NEW.id, 'comentar no feed');
  return NEW;
end; $f$;
drop trigger if exists trg_award_feed_comment on public.feed_comments;
create trigger trg_award_feed_comment after insert on public.feed_comments
  for each row execute function public.award_feed_comment();

create or replace function public.award_progress_photo() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  perform public.add_points(NEW.gym_id, NEW.student_id, 'photo', 20, 'photo:'||NEW.id, 'postar uma foto de evolução');
  return NEW;
end; $f$;
drop trigger if exists trg_award_progress_photo on public.progress_photos;
create trigger trg_award_progress_photo after insert on public.progress_photos
  for each row execute function public.award_progress_photo();

create or replace function public.award_checkin() returns trigger
language plpgsql security definer set search_path = public as $f$
declare v_day date := (NEW.checked_at at time zone 'America/Sao_Paulo')::date;
begin
  if NEW.type = 'entrada' then
    perform public.add_points(NEW.gym_id, NEW.student_id, 'checkin', 5, 'checkin:'||NEW.student_id||':'||v_day, 'fazer check-in na academia');
  end if;
  return NEW;
end; $f$;
drop trigger if exists trg_award_checkin on public.checkins;
create trigger trg_award_checkin after insert on public.checkins
  for each row execute function public.award_checkin();

-- ===== 5) treinar junto (convite -> ambos ganham 30) =====
create or replace function public.invite_train_together(p_invitee uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

grant execute on function public.invite_train_together(uuid) to authenticated;
grant execute on function public.recompute_leaderboard(uuid, uuid) to authenticated;

-- ===== 6) recomputa o placar de todos os alunos agora =====
do $$
declare r record;
begin
  for r in select id, gym_id from public.profiles where role = 'student' loop
    begin
      perform public.recompute_leaderboard(r.id, r.gym_id);
    exception when others then null;
    end;
  end loop;
end $$;
