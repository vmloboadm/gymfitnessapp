-- 025: Staff pode atualizar student_workouts do próprio gym
-- (concluir plano antigo ao gerar v2 ajustada, pausar/retomar).
-- Aluno não atualiza (só lê os próprios).

create policy "sworkouts_update_staff" on public.student_workouts
  for update to authenticated
  using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  )
  with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );
