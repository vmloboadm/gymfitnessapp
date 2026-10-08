-- 036_leaderboard_streak.sql
-- A chama de sequência de cada aluno no ranking e nos perfis.
-- Alunos não leem workout_logs uns dos outros (RLS), então o próprio
-- leaderboard carrega o streak, atualizado pelo trigger a cada treino.
-- Sem travessão em textos visíveis (padrão do app).

alter table public.leaderboard
  add column if not exists streak integer not null default 0;

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
  cur_streak integer;
begin
  begin
    -- só a primeira linha do dia conta como sessão (um treino tem N linhas)
    select not exists (
      select 1 from public.workout_logs
      where student_id = NEW.student_id
        and date::date = NEW.date::date
        and id <> NEW.id
    ) into first_today;

    cur_streak := public.day_streak(NEW.student_id);

    insert into public.leaderboard (gym_id, week_start, student_id, rank_type, points, load_kg, sessions, streak)
    values (
      NEW.gym_id, ws, NEW.student_id, 'load',
      100 + floor(load_add / 100)::int,
      load_add,
      case when first_today then 1 else 0 end,
      cur_streak
    )
    on conflict (gym_id, week_start, student_id, rank_type) do update set
      sessions = public.leaderboard.sessions + case when first_today then 1 else 0 end,
      load_kg = public.leaderboard.load_kg + excluded.load_kg,
      points = (public.leaderboard.sessions + case when first_today then 1 else 0 end) * 100
        + floor((public.leaderboard.load_kg + excluded.load_kg) / 100)::int,
      streak = excluded.streak;
  exception when others then
    -- motor auxiliar nunca pode derrubar a gravação do treino
    raise warning 'bump_leaderboard falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;
