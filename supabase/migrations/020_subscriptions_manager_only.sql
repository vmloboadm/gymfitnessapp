-- 020: Assinaturas/receita visíveis só para manager/admin (+ o próprio aluno).
-- Trainers não enxergam valores (financeiro não é exposto para personais).

drop policy if exists "student_subs_select_gym" on public.student_subscriptions;

create policy "student_subs_select_manager" on public.student_subscriptions
  for select using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );
