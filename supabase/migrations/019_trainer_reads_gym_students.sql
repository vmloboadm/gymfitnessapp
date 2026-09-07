-- 019: Trainers enxergam todos os alunos do gym (sem exclusividade).
-- A tabela student_trainers segue como "responsável" opcional, mas a LEITURA
-- não exige mais vínculo: qualquer personal do gym vê todos os alunos.
-- Managers/admins mantêm a leitura total via profiles_select_gym_by_manager.

drop policy if exists "profiles_select_linked_by_trainer" on public.profiles;

create policy "profiles_select_gym_staff" on public.profiles
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
    and (role = 'student' or id = auth.uid())
  );
