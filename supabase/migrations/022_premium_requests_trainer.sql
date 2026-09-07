-- 022: Trainers também veem e resolvem solicitações de alunos
-- (ajustes de treino, relatórios, cargas). Antes era só manager/admin,
-- o que travava o fluxo "pedir ajuste" para personais comuns.

drop policy if exists "premium_select_manager" on public.premium_requests;
create policy "premium_select_staff" on public.premium_requests
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

drop policy if exists "premium_manage_manager" on public.premium_requests;
create policy "premium_manage_staff" on public.premium_requests
  for update using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );
