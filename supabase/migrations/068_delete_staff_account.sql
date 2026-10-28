-- 068_delete_staff_account.sql
-- Exclusão de conta de personal/gerente falhava: fichas (workout_programs),
-- registros de manutenção e vínculos com alunos ainda apontavam para ele.
-- Agora essas fichas passam para outra pessoa da equipe da mesma academia.

create or replace function public.delete_user_data(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- ordem: filhas primeiro (workout_logs aponta para sessões e fichas)
  targets text[][] := array[
    ['direct_messages', 'sender_id'],
    ['conversations', 'student_id'],
    ['conversations', 'staff_id'],
    ['workout_logs', 'student_id'],
    ['slot_checks', 'student_id'],
    ['cardio_logs', 'student_id'],
    ['progress_photos', 'student_id'],
    ['checkins', 'student_id'],
    ['equipment_sessions', 'student_id'],
    ['workout_sessions', 'student_id'],
    ['student_workouts', 'student_id'],
    ['premium_requests', 'student_id'],
    ['body_metrics', 'student_id'],
    ['leaderboard', 'student_id'],
    ['student_achievements', 'student_id'],
    ['student_trainers', 'student_id'],
    ['student_subscriptions', 'student_id'],
    ['medical_clearances', 'student_id'],
    ['point_events', 'student_id'],
    ['notifications', 'user_id'],
    ['notification_settings', 'user_id'],
    ['push_subscriptions', 'user_id'],
    ['feed_likes', 'user_id'],
    ['feed_comments', 'user_id'],
    ['squad_messages', 'user_id'],
    ['squad_members', 'user_id'],
    ['feed_posts', 'author_id'],
    ['ai_generation_logs', 'user_id']
  ];
  i int;
  v_gym uuid;
  v_heir uuid;
begin
  if p_user is null then
    raise exception 'p_user obrigatório';
  end if;

  -- Staff: o que ele criou passa para outra pessoa da equipe da academia
  -- (gerente/admin primeiro). Assim nenhum aluno perde a ficha.
  select gym_id into v_gym from public.profiles where id = p_user;
  select id into v_heir
  from public.profiles
  where gym_id is not distinct from v_gym
    and id <> p_user
    and role in ('manager', 'admin', 'trainer')
  order by case role when 'admin' then 0 when 'manager' then 1 else 2 end, created_at
  limit 1;

  if exists (select 1 from public.workout_programs where trainer_id = p_user)
     or exists (select 1 from public.equipment_maintenance_logs where requested_by = p_user) then
    if v_heir is null then
      raise exception 'Não há outra pessoa da equipe para receber as fichas deste personal';
    end if;
    update public.workout_programs set trainer_id = v_heir where trainer_id = p_user;
    update public.equipment_maintenance_logs set requested_by = v_heir where requested_by = p_user;
  end if;

  update public.gym_motivation set updated_by = null where updated_by = p_user;
  delete from public.student_trainers where trainer_id = p_user;

  for i in 1 .. array_length(targets, 1) loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = targets[i][1]
        and column_name = targets[i][2]
    ) then
      execute format('delete from public.%I where %I = $1', targets[i][1], targets[i][2])
        using p_user;
    end if;
  end loop;

  delete from public.profiles where id = p_user;
end;
$$;

revoke all on function public.delete_user_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_data(uuid) to service_role;
