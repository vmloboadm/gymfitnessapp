-- =====================================================================
-- 064_security_hardening.sql — correções da auditoria de 2026-10-27
--
-- 1. profiles: o aluno não pode mudar role, gym_id, status nem approved_at
--    (a 024 devolveu UPDATE em todas as colunas e desfez a trava da 007).
-- 2. notifications: ninguém cria notificação para outra pessoa pelo app.
--    Os avisos automáticos usam funções SECURITY DEFINER e não são afetados.
-- 3. storage medical: laudo só pode ser lido pelo dono e pela equipe da
--    academia (antes: qualquer usuário lia qualquer laudo).
-- 4. Policies que comparavam a coluna com ela mesma (p.gym_id = p.gym_id).
-- 5. delete_user_data(): exclusão de conta numa transação só.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Trava das colunas sensíveis do perfil
-- Só age em requisições do app (roles authenticated/anon). Service role,
-- funções SECURITY DEFINER (approve_student, staff_update_student...) e o
-- SQL Editor rodam como outro usuário e passam direto.
-- ---------------------------------------------------------------------
create or replace function public.guard_profile_privileged()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'student';
    new.approved_at := null;
    if new.status is distinct from 'active' then
      new.status := 'active'; -- trg_profiles_medical ainda marca pending_clearance se houver risco
    end if;
    return new;
  end if;

  -- UPDATE: valores sensíveis voltam ao que eram (sem erro, para não quebrar
  -- telas que mandam a linha inteira com os mesmos valores)
  new.role        := old.role;
  new.gym_id      := old.gym_id;
  new.status      := old.status;
  new.approved_at := old.approved_at;
  return new;
end;
$$;

-- nome com "a_" para rodar antes de trg_profiles_medical (ordem alfabética)
drop trigger if exists trg_a_guard_profile_privileged on public.profiles;
create trigger trg_a_guard_profile_privileged
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged();

-- ---------------------------------------------------------------------
-- 2. Notificações: só para si mesmo
-- ---------------------------------------------------------------------
drop policy if exists "notifications_insert_system" on public.notifications;
drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own" on public.notifications
  for insert to authenticated
  with check (user_id = auth.uid() and gym_id = public.current_gym_id());

-- ---------------------------------------------------------------------
-- 3. Laudos médicos (caminho: clearances/<student_id>/<arquivo>)
-- ---------------------------------------------------------------------
drop policy if exists "medical_select_any" on storage.objects;
drop policy if exists "medical_select_owner_or_staff" on storage.objects;
create policy "medical_select_owner_or_staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        public.current_role() in ('trainer', 'manager', 'admin')
        and exists (
          select 1 from public.profiles p
          where p.id::text = (storage.foldername(name))[2]
            and p.gym_id = public.current_gym_id()
        )
      )
    )
  );

-- ---------------------------------------------------------------------
-- 4. Policies com auto-comparação (sempre verdadeiras)
-- ---------------------------------------------------------------------
drop policy if exists "checkins_insert_gym_staff" on public.checkins;
create policy "checkins_insert_gym_staff" on public.checkins
  for insert to authenticated
  with check (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );

drop policy if exists "checkins_select_trainer" on public.checkins;
create policy "checkins_select_trainer" on public.checkins
  for select using (
    exists (
      select 1 from public.student_trainers st
      where st.student_id = checkins.student_id
        and st.trainer_id = auth.uid()
        and st.gym_id = public.current_gym_id()
    )
  );

drop policy if exists "sessions_update_gym_staff" on public.equipment_sessions;
create policy "sessions_update_gym_staff" on public.equipment_sessions
  for update to authenticated
  using (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  )
  with check (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );

drop policy if exists "wsession_select_gym_staff" on public.workout_sessions;
create policy "wsession_select_gym_staff" on public.workout_sessions
  for select to authenticated
  using (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );

drop policy if exists "wsession_update_gym_staff" on public.workout_sessions;
create policy "wsession_update_gym_staff" on public.workout_sessions
  for update to authenticated
  using (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  )
  with check (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );

drop policy if exists "leaderboard_system" on public.leaderboard;
create policy "leaderboard_system" on public.leaderboard
  for all
  using (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  )
  with check (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );

drop policy if exists "feed_delete_own_or_manager" on public.feed_posts;
create policy "feed_delete_own_or_manager" on public.feed_posts
  for delete using (
    author_id = auth.uid()
    or (
      public.current_role() in ('manager', 'admin')
      and gym_id = public.current_gym_id()
    )
  );

-- ---------------------------------------------------------------------
-- 5. Exclusão de conta atômica (chamada só pela rota /api/account/delete)
-- Pula tabelas/colunas que não existam, para tolerar diferença entre o
-- repositório e o banco. Qualquer erro desfaz tudo.
-- ---------------------------------------------------------------------
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
begin
  if p_user is null then
    raise exception 'p_user obrigatório';
  end if;

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
