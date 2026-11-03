-- 071_conquistas_feed_push.sql
-- Engajamento:
--   * toda conquista vai pro feed (inclusive o raio de 3 dias) e credita os
--     pontos do catálogo (achievements.points), com UM aviso no sininho;
--   * post automático não ganha os +10 de "postar no feed";
--   * conquistas que existiam no catálogo mas nunca disparavam: primeiro
--     check-in, recorde pessoal e 10.000 kg na semana;
--   * recorde pessoal vira post no feed (no máximo 1 por dia por aluno);
--   * todo aviso do sininho também vira push (pg_net → /api/push/dispatch).

-- ---------------------------------------------------------------------------
-- Nome de exibição "Maria S." e primeiro nome
create or replace function public.athlete_display(p_student uuid, out disp text, out firstn text)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  aname text;
begin
  select coalesce(nullif(trim(name), ''), 'Atleta') into aname from public.profiles where id = p_student;
  aname := coalesce(aname, 'Atleta');
  firstn := split_part(aname, ' ', 1);
  disp := firstn || case when split_part(aname, ' ', 2) <> ''
    then ' ' || left(split_part(aname, ' ', 2), 1) || '.' else '' end;
end;
$function$;

-- Post criado pelo sistema (conquista/recorde): não conta como "postar no feed"
create or replace function public.system_feed_post(p_gym uuid, p_author uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform set_config('gf.system_post', '1', true);
  insert into public.feed_posts (gym_id, author_id, type, body, expires_at)
  values (p_gym, p_author, 'conquista', p_body, now() + interval '30 days');
  perform set_config('gf.system_post', '', true);
end;
$function$;

create or replace function public.award_feed_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if NEW.author_id is not null and not NEW.is_pinned
     and coalesce(current_setting('gf.system_post', true), '') <> '1' then
    perform public.add_points(NEW.gym_id, NEW.author_id, 'feed_post', 10, 'post:'||NEW.id, 'postar no feed');
  end if;
  return NEW;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Conquista: pontos do catálogo + 1 aviso + post no feed (sempre)
create or replace function public.grant_achievement(
  p_gym uuid, p_student uuid, p_code text, p_disp text, p_first text, p_action text,
  p_post boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

-- ---------------------------------------------------------------------------
-- Primeiro check-in
create or replace function public.award_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

-- ---------------------------------------------------------------------------
-- Recorde pessoal e volume da semana (a cada exercício gravado)
create or replace function public.fmt_kg(p numeric)
returns text
language sql
immutable
as $function$
  select case when p = trunc(p) then trunc(p)::text
              else rtrim(rtrim(round(p, 2)::text, '0'), '.') end;
$function$;

create or replace function public.award_log_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists trg_award_log_milestones on public.workout_logs;
create trigger trg_award_log_milestones
  after insert on public.workout_logs
  for each row execute function public.award_log_milestones();

-- ---------------------------------------------------------------------------
-- Sininho → push. Cada aviso novo chama /api/push/dispatch (pg_net, assíncrono,
-- depois do commit). A rota marca pushed_at e respeita as preferências.
alter table public.notifications add column if not exists pushed_at timestamptz;
-- histórico já existente não dispara push retroativo
update public.notifications set pushed_at = created_at where pushed_at is null;

create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net indisponível: %', sqlerrm;
end $$;

create or replace function public.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists trg_dispatch_push on public.notifications;
create trigger trg_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push();
