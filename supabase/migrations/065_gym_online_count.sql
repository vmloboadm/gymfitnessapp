-- =====================================================================
-- 065_gym_online_count.sql — "X pessoas treinando agora" para o aluno
--
-- O contador lia checkins/equipment_sessions direto, mas a RLS só deixa o
-- aluno ver os próprios registros: para ele o número era sempre 0 ou 1.
-- Esta função devolve só a CONTAGEM da academia de quem chama (nenhum
-- nome ou id sai daqui). Quem fez check-out ("saida") deixa de contar.
-- =====================================================================

create or replace function public.gym_online_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with g as (
    select public.current_gym_id() as gym_id
  ),
  sess as (
    select s.student_id
    from public.equipment_sessions s, g
    where s.gym_id = g.gym_id
      and s.status = 'active'
      and s.started_at >= now() - interval '3 hours'
  ),
  ultimo_checkin as (
    select distinct on (c.student_id) c.student_id, c.type
    from public.checkins c, g
    where c.gym_id = g.gym_id
      and c.checked_at >= now() - interval '3 hours'
    order by c.student_id, c.checked_at desc
  )
  select count(*)::integer
  from (
    select student_id from sess
    union
    select student_id from ultimo_checkin where type = 'entrada'
  ) presentes;
$$;

revoke all on function public.gym_online_count() from public, anon;
grant execute on function public.gym_online_count() to authenticated;
