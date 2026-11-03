-- 072_backfill_conquistas.sql
-- Conquistas que os alunos já tinham merecido, mas nunca foram liberadas
-- (gatilho não existia na época, ou a conquista nunca foi ligada).
-- Dá a conquista e os pontos do catálogo, com UM aviso por aluno no sininho.
-- NÃO posta no feed: dezenas de posts de uma vez afogariam o feed.
-- Idempotente: pode rodar de novo sem duplicar nada.

create temp table _cand (student uuid, gym uuid, code text) on commit drop;

insert into _cand
select p.id, p.gym_id, x.code
from public.profiles p
cross join lateral (
  select 'first_checkin' code where exists (
    select 1 from public.checkins c where c.student_id = p.id and c.type = 'entrada')
  union all
  select 'first_workout' where exists (select 1 from public.workout_logs l where l.student_id = p.id)
  union all
  select 'workout_10' where (select count(distinct public.local_day(date)) from public.workout_logs where student_id = p.id) >= 10
  union all
  select 'workout_50' where (select count(distinct public.local_day(date)) from public.workout_logs where student_id = p.id) >= 50
  union all
  select 'month_12' where exists (
    select 1 from public.workout_logs where student_id = p.id
    group by date_trunc('month', public.local_day(date))
    having count(distinct public.local_day(date)) >= 12)
  union all
  select 'volume_10k' where exists (
    select 1 from public.workout_logs where student_id = p.id
    group by date_trunc('week', public.local_day(date))
    having sum(coalesce(weight_kg, 0) * coalesce(reps, 0)) >= 10000)
  union all
  select 'pr_new_record' where exists (
    select 1 from public.workout_logs l
    where l.student_id = p.id and l.weight_kg > 0
      and l.weight_kg > (
        select max(l2.weight_kg) from public.workout_logs l2
        where l2.student_id = l.student_id and l2.exercise_id = l.exercise_id
          and public.local_day(l2.date) < public.local_day(l.date)))
  union all
  select 'cardio_first' where exists (select 1 from public.cardio_logs cl where cl.student_id = p.id)
) x
where p.role = 'student' and p.gym_id is not null;

create temp table _granted on commit drop as
with ins as (
  insert into public.student_achievements (gym_id, student_id, achievement_id)
  select c.gym, c.student, a.id
  from _cand c join public.achievements a on a.code = c.code and a.gym_id is null
  on conflict (student_id, achievement_id) do nothing
  returning gym_id, student_id, achievement_id
)
select ins.gym_id, ins.student_id, a.code, a.name, coalesce(a.points, 0) points
from ins join public.achievements a on a.id = ins.achievement_id;

insert into public.point_events (gym_id, student_id, source, points, dedupe_key)
select gym_id, student_id, 'achievement', points, 'ach:' || student_id || ':' || code
from _granted where points > 0
on conflict (dedupe_key) do nothing;

insert into public.notifications (gym_id, user_id, channel, title, body)
select gym_id, student_id, 'in_app',
  case when count(*) = 1 then 'Conquista liberada: ' || min(name)
       else count(*) || ' conquistas liberadas' end,
  'Você desbloqueou ' || string_agg(name, ', ' order by points)
    || ' (+' || sum(points) || ' pontos). Veja no seu perfil e continue subindo no ranking!'
from _granted
group by gym_id, student_id;

do $$
declare r record;
begin
  for r in select distinct student_id, gym_id from _granted loop
    perform public.recompute_leaderboard(r.student_id, r.gym_id);
  end loop;
end $$;

select count(*) as conquistas, count(distinct student_id) as alunos, coalesce(sum(points), 0) as pontos from _granted;
