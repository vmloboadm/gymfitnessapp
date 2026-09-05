-- 014: treino em andamento visível ao personal (realtime).
-- O aluno inicia a sessão de treino; gestor/personal vê "em treino",
-- tempo decorrido e pode encerrar junto com a presença.

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id),
  student_id uuid not null references profiles(id),
  workout_id uuid references student_workouts(id),
  status text not null default 'active' check (status in ('active', 'completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  meta jsonb default '{}'
);

alter table workout_sessions enable row level security;

create policy "wsession_insert_own"
  on workout_sessions for insert to authenticated
  with check (student_id = auth.uid());

create policy "wsession_select_own"
  on workout_sessions for select to authenticated
  using (student_id = auth.uid());

create policy "wsession_update_own"
  on workout_sessions for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "wsession_select_gym_staff"
  on workout_sessions for select to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.gym_id = gym_id
        and p.role in ('manager', 'trainer')
    )
  );

create policy "wsession_update_gym_staff"
  on workout_sessions for update to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.gym_id = gym_id
        and p.role in ('manager', 'trainer')
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.gym_id = gym_id
        and p.role in ('manager', 'trainer')
    )
  );

create unique index if not exists ux_wsession_active on workout_sessions (student_id) where status = 'active';
create index if not exists ix_wsession_gym_started on workout_sessions (gym_id, started_at desc);

alter publication supabase_realtime add table workout_sessions;
