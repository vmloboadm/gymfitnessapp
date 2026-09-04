-- 011: Frase motivacional editável pelo staff, visível para todos os alunos
create table if not exists public.gym_motivation (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  phrase text not null default '',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.gym_motivation enable row level security;

drop policy if exists "motivation_read_all" on public.gym_motivation;
create policy "motivation_read_all" on public.gym_motivation
  for select using (true);

drop policy if exists "motivation_staff_insert" on public.gym_motivation;
create policy "motivation_staff_insert" on public.gym_motivation
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'manager', 'admin')
        and p.gym_id = gym_motivation.gym_id
    )
  );

drop policy if exists "motivation_staff_update" on public.gym_motivation;
create policy "motivation_staff_update" on public.gym_motivation
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'manager', 'admin')
        and p.gym_id = gym_motivation.gym_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('trainer', 'manager', 'admin')
        and p.gym_id = gym_motivation.gym_id
    )
  );

-- Realtime: alunos veem a nova frase na hora
alter table public.gym_motivation replica identity full;
alter publication supabase_realtime add table public.gym_motivation;
