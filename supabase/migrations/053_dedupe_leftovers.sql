-- 053_dedupe_leftovers.sql
-- Remove 2 duplicatas criadas pela curadoria (050):
--   "Supino Inclinado com Halteres" (mescla aliases no original referenciado)
--   "Elevação Pélvica" classificada como perna (mantém a de glúteo).
-- Idempotente: reexecutar não altera nada.

update public.exercises k
  set aliases = (select array_agg(distinct x) from unnest(k.aliases || d.aliases) x)
  from public.exercises d
  where k.id = '1ad2406f-430c-4dcb-ba65-195c4ecf616a'
    and d.id = 'f7c6b431-ce9d-4d04-b51e-09741bed1708';

delete from public.exercises
  where id in ('f7c6b431-ce9d-4d04-b51e-09741bed1708', 'ed0601eb-1539-4844-9352-3c0121b1b547')
    and not exists (select 1 from public.workout_exercises we where we.exercise_id = exercises.id)
    and not exists (select 1 from public.workout_logs wl where wl.exercise_id = exercises.id);
