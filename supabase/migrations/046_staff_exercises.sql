-- 046_staff_exercises.sql
-- Personal cria, edita e apaga exercícios DA ACADEMIA (gym_id próprio).
-- Global (gym_id null) continua só leitura para staff; gestão mantém tudo.
-- Com isso o que o personal cria entra na biblioteca, no picker, nos
-- equivalentes e na IA (que já lê gym_id null + gym).

drop policy if exists exercises_manage_staff on public.exercises;
create policy exercises_manage_staff on public.exercises for all to authenticated
  using (
    gym_id = public.current_gym_id()
    and public.current_role() in ('trainer', 'manager', 'admin')
  )
  with check (
    gym_id = public.current_gym_id()
    and gym_id is not null
    and public.current_role() in ('trainer', 'manager', 'admin')
  );

grant select, insert, update, delete on public.exercises to authenticated;
grant all on public.exercises to service_role;
