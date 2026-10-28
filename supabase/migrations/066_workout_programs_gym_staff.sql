-- =====================================================================
-- 066_workout_programs_gym_staff.sql — auditoria de 2026-10-28
--
-- workout_programs só deixava o personal ver as fichas que ELE criou,
-- enquanto dias, exercícios e vínculos (student_workouts) já eram da
-- academia inteira. Efeito: uma personal via "5 de 14 planos", não abria
-- nem editava a ficha montada por outra pessoa da equipe, e "Usar treino
-- de outro aluno" falhava com "Plano original não encontrado".
--
-- Agora: a equipe (trainer/manager/admin) lê e atualiza as fichas da
-- própria academia. O filtro por gym_id também passa a valer para o
-- gerente (antes ele via programas de qualquer academia).
-- =====================================================================

drop policy if exists "workouts_select_trainer" on public.workout_programs;
create policy "workouts_select_trainer" on public.workout_programs
  for select to authenticated
  using (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );

drop policy if exists "workouts_update_trainer" on public.workout_programs;
create policy "workouts_update_trainer" on public.workout_programs
  for update to authenticated
  using (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  )
  with check (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );

drop policy if exists "workouts_insert_trainer" on public.workout_programs;
create policy "workouts_insert_trainer" on public.workout_programs
  for insert to authenticated
  with check (
    gym_id = public.current_gym_id()
    and (
      trainer_id = auth.uid()
      or public.current_role() in ('manager', 'admin')
    )
    and public.current_role() in ('trainer', 'manager', 'admin')
  );
