-- 060_ranking_90d_points.sql
-- O ranking de 90 dias contava só treino e ignorava o ledger de pontos
-- (check-in, feed, foto, treinar junto). Agora soma as duas fontes sem
-- tocar em nenhum dado existente.

create or replace function public.ranking_90d(p_gym_id uuid)
returns table(student_id uuid, sessions integer, load_kg numeric, points integer)
language sql
stable
security definer
set search_path = public
as $function$
  with cutoff as (
    select ((now() at time zone 'America/Sao_Paulo')::date - 90) as d
  ),
  logs as (
    select
      wl.student_id,
      count(distinct public.local_day(wl.date))::int as sessions,
      coalesce(sum(coalesce(wl.weight_kg, 0) * coalesce(wl.reps, 0)), 0) as load_kg
    from public.workout_logs wl, cutoff
    where wl.gym_id = p_gym_id
      and public.local_day(wl.date) >= cutoff.d
    group by wl.student_id
  ),
  pts as (
    select
      pe.student_id,
      coalesce(sum(pe.points), 0)::int as points
    from public.point_events pe, cutoff
    where pe.gym_id = p_gym_id
      and public.local_day(pe.created_at) >= cutoff.d
    group by pe.student_id
  )
  select
    coalesce(l.student_id, p.student_id) as student_id,
    coalesce(l.sessions, 0)::int as sessions,
    coalesce(l.load_kg, 0) as load_kg,
    (coalesce(l.sessions, 0) * 100 + floor(coalesce(l.load_kg, 0) / 100)::int + coalesce(p.points, 0))::int as points
  from logs l
  full join pts p using (student_id)
  order by points desc
  limit 50;
$function$;

grant execute on function public.ranking_90d(uuid) to authenticated;
