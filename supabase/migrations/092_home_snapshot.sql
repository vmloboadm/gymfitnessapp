-- 092: a Home carrega tudo numa chamada só (antes eram 6 a 8 idas ao banco em cascata).
-- security invoker: as políticas RLS continuam valendo, o aluno só lê o próprio dado
-- e o ranking da própria academia.

create or replace function public.home_snapshot(p_day_start timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select id, gym_id, name from profiles where id = auth.uid()
  )
  select jsonb_build_object(
    'checkin_today', (
      select to_jsonb(c) from (
        select id, checked_at, type from checkins
         where student_id = auth.uid() and checked_at >= p_day_start
         order by checked_at desc limit 1
      ) c
    ),
    'logs', coalesce((
      select jsonb_agg(l) from (
        select date, exercise_id, weight_kg, reps from workout_logs
         where student_id = auth.uid()
         order by date desc limit 60
      ) l
    ), '[]'::jsonb),
    'board', coalesce((
      select jsonb_agg(b) from (
        select student_id, points from leaderboard
         where gym_id = (select gym_id from me)
           and period = 'all' and week_start = '2000-01-01' and rank_type = 'load'
           and points > 0
         order by points desc limit 200
      ) b
    ), '[]'::jsonb),
    'completed_today', exists (
      select 1 from workout_sessions
       where student_id = auth.uid() and status = 'completed' and ended_at >= p_day_start
    ),
    'streak', public.day_streak(auth.uid()),
    'motivation', (
      select phrase from gym_motivation where gym_id = (select gym_id from me)
    )
  );
$$;

grant execute on function public.home_snapshot(timestamptz) to authenticated;
