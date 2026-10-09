-- 039_slot_checks.sql
-- Checks de treino por slot (A..F), histórico contínuo sem reset semanal.
-- O aluno treina qualquer slot em qualquer dia (faltou quarta, faz quinta):
-- cada conclusão grava uma linha; "treino de hoje" = próximo slot da rotação
-- após o último concluído. A meta semanal e o ranking continuam por janela
-- de datas (inalterados).

create table if not exists public.slot_checks (
  id uuid not null default uuid_generate_v4() primary key,
  gym_id uuid not null references public.gyms(id),
  student_id uuid not null references public.profiles(id),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  slot text not null check (slot in ('A', 'B', 'C', 'D', 'E', 'F')),
  checked_at timestamptz not null default now()
);

create index if not exists idx_slot_student_prog
  on public.slot_checks (student_id, program_id, checked_at desc);

alter table public.slot_checks enable row level security;

grant select, insert on public.slot_checks to authenticated;

drop policy if exists slot_insert_own on public.slot_checks;
create policy slot_insert_own on public.slot_checks for insert to authenticated
  with check (student_id = auth.uid() and gym_id = public.current_gym_id());

drop policy if exists slot_select_own on public.slot_checks;
create policy slot_select_own on public.slot_checks for select to authenticated
  using (student_id = auth.uid());

drop policy if exists slot_select_staff on public.slot_checks;
create policy slot_select_staff on public.slot_checks for select to authenticated
  using (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );
