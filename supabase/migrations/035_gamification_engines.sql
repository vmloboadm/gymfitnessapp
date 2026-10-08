-- 035_gamification_engines.sql
-- Motores de gamificação que faltavam em produção:
--   1) workout_logs estava sempre vazio no app e leaderboard/feed/notifications
--      também, porque nada escrevia nessas tabelas. Este arquivo liga os motores:
--   2) trigger bump_leaderboard: cada treino gravado soma sessões, carga e pontos
--      da semana (segunda a domingo) do aluno.
--   3) triggers de notificações in-app (sem spam, só marcos): plano liberado,
--      cadastro aprovado, aluno novo para o staff, meta da semana e sequência.
--   4) função gym_roster(): ficha pública mínima (nome, foto, papel) dos membros
--      da academia para ranking, feed e perfis (RLS de profiles é fechada).
--   5) posts iniciais da academia no feed (boas-vindas, check-in, desafio).

-- ===== 1) leaderboard a partir de workout_logs =====
create or replace function public.bump_leaderboard()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  ws date := date_trunc('week', NEW.date)::date;
  w numeric := coalesce(NEW.weight_kg, 0);
  r integer := coalesce(NEW.reps, 0);
  first_today boolean;
  load_add numeric := w * r;
begin
  begin
    -- só a primeira linha do dia conta como sessão (um treino tem N linhas)
    select not exists (
      select 1 from public.workout_logs
      where student_id = NEW.student_id
        and date::date = NEW.date::date
        and id <> NEW.id
    ) into first_today;

    insert into public.leaderboard (gym_id, week_start, student_id, rank_type, points, load_kg, sessions)
    values (
      NEW.gym_id, ws, NEW.student_id, 'load',
      100 + floor(load_add / 100)::int,
      load_add,
      case when first_today then 1 else 0 end
    )
    on conflict (gym_id, week_start, student_id, rank_type) do update set
      sessions = public.leaderboard.sessions + case when first_today then 1 else 0 end,
      load_kg = public.leaderboard.load_kg + excluded.load_kg,
      points = (public.leaderboard.sessions + case when first_today then 1 else 0 end) * 100
        + floor((public.leaderboard.load_kg + excluded.load_kg) / 100)::int;
  exception when others then
    -- motor auxiliar nunca pode derrubar a gravação do treino
    raise warning 'bump_leaderboard falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;

drop trigger if exists trg_bump_leaderboard on public.workout_logs;
create trigger trg_bump_leaderboard
after insert on public.workout_logs
for each row execute function public.bump_leaderboard();

-- ===== 2) sequência de dias (streak) em SQL =====
create or replace function public.day_streak(p_student uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  s integer := 0;
  d date := current_date;
begin
  -- se hoje ainda não treinou, a sequência conta até ontem
  if not exists (
    select 1 from public.workout_logs
    where student_id = p_student and date::date = d
  ) then
    d := d - 1;
  end if;
  loop
    exit when not exists (
      select 1 from public.workout_logs
      where student_id = p_student and date::date = d
    );
    s := s + 1;
    d := d - 1;
  end loop;
  return s;
end;
$function$;

-- ===== 3) notificações: marcos do treino (meta da semana, sequência) =====
create or replace function public.notify_workout_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  ws date := date_trunc('week', NEW.date)::date;
  sessions_week integer;
  goal integer;
  streak integer;
  first_today boolean;
begin
  begin
    select not exists (
      select 1 from public.workout_logs
      where student_id = NEW.student_id
        and date::date = NEW.date::date
        and id <> NEW.id
    ) into first_today;
    -- só avalia marcos uma vez por dia (primeira linha do dia)
    if not first_today then
      return NEW;
    end if;

    select count(distinct date::date) into sessions_week
    from public.workout_logs
    where student_id = NEW.student_id and date::date >= ws;

    select coalesce(array_length(available_days, 1), 3) into goal
    from public.profiles where id = NEW.student_id;

    if sessions_week >= goal and goal > 0
      -- uma vez por semana: sem esse guarda, todo treino da semana
      -- geraria um aviso repetido (poluição na central)
      and not exists (
        select 1 from public.notifications
        where user_id = NEW.student_id
          and title = 'Meta da semana batida'
          and created_at >= ws
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

drop trigger if exists trg_notify_workout_milestones on public.workout_logs;
create trigger trg_notify_workout_milestones
after insert on public.workout_logs
for each row execute function public.notify_workout_milestones();

-- ===== 4) notificações: plano liberado para o aluno =====
create or replace function public.notify_plan_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists trg_notify_plan_assigned on public.student_workouts;
create trigger trg_notify_plan_assigned
after insert on public.student_workouts
for each row execute function public.notify_plan_assigned();

-- ===== 5) notificações: aluno novo (staff) e cadastro aprovado (aluno) =====
create or replace function public.notify_student_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

drop trigger if exists trg_notify_student_lifecycle on public.profiles;
create trigger trg_notify_student_lifecycle
after insert or update on public.profiles
for each row execute function public.notify_student_lifecycle();

-- ===== 6) ficha pública mínima dos membros (ranking, feed, perfis) =====
create or replace function public.gym_roster(p_gym_id uuid)
returns table (id uuid, name text, avatar_url text, role text)
language sql
stable
security definer
set search_path = public
as $function$
  select p.id, p.name, p.avatar_url, p.role
  from public.profiles p
  where p.gym_id = p_gym_id
    and p.role in ('student', 'trainer', 'manager', 'admin')
    and (p.role <> 'student' or p.approved_at is not null)
  order by p.name;
$function$;

grant execute on function public.gym_roster(uuid) to authenticated;
grant execute on function public.day_streak(uuid) to authenticated;

-- ===== 7) posts iniciais da academia no feed =====
do $seed$
declare
  v_gym uuid := '00000000-0000-0000-0000-000000000001';
  v_author uuid;
begin
  select id into v_author
  from public.profiles
  where gym_id = v_gym and role in ('manager', 'admin')
  order by created_at
  limit 1;

  if v_author is null then
    raise notice 'seed do feed pulado: sem gestor na academia padrão';
    return;
  end if;

  if exists (select 1 from public.feed_posts where gym_id = v_gym and type = 'comunicado' and is_pinned) then
    return;
  end if;

  insert into public.feed_posts (gym_id, author_id, type, body, is_pinned, expires_at)
  values
    (v_gym, v_author, 'comunicado',
     'Bem-vindo ao feed da GymFitness. Aqui a academia avisa, incentiva e acompanha. Poste sua evolução, curta a galera e participe dos desafios. Respeito sempre.',
     true, now() + interval '90 days'),
    (v_gym, v_author, 'comunicado',
     'Check-in libera seu treino. Escaneie o QR da portaria ou peça a senha do dia na recepção. Com check-in tudo conta: sequência, ranking e progresso da semana.',
     false, now() + interval '90 days'),
    (v_gym, v_author, 'desafio',
     'Desafio da semana: feche sua meta de treinos e suba no ranking. O pódio zera toda segunda, todo mundo recomeça junto.',
     false, now() + interval '90 days');
end;
$seed$;
