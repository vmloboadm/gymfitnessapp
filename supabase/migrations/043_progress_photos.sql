-- 043_progress_photos.sql
-- Fotos de evolução (antes/depois): só o aluno vê por padrão; o personal
-- vinculado vê apenas as marcadas como visíveis para ele. O dev acessa via
-- service role quando necessário. URLs ficam no bucket avatars com prefixo
-- progress/ (leitura pública por URL, listagem fechada por RLS).

create table if not exists public.progress_photos (
  id uuid not null default uuid_generate_v4() primary key,
  gym_id uuid not null references public.gyms(id),
  student_id uuid not null references public.profiles(id),
  url text not null,
  angle text not null check (angle in ('frente', 'lado', 'costas')),
  phase text not null check (phase in ('antes', 'depois')),
  visibility text not null default 'self' check (visibility in ('self', 'trainer')),
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_progress_student
  on public.progress_photos (student_id, created_at desc);

alter table public.progress_photos enable row level security;

grant select, insert, update, delete on public.progress_photos to authenticated;

drop policy if exists pphoto_insert_own on public.progress_photos;
create policy pphoto_insert_own on public.progress_photos for insert to authenticated
  with check (student_id = auth.uid() and gym_id = public.current_gym_id());

drop policy if exists pphoto_select_own on public.progress_photos;
create policy pphoto_select_own on public.progress_photos for select to authenticated
  using (student_id = auth.uid());

drop policy if exists pphoto_select_trainer on public.progress_photos;
create policy pphoto_select_trainer on public.progress_photos for select to authenticated
  using (
    visibility = 'trainer'
    and gym_id = public.current_gym_id()
    and (
      public.current_role() in ('manager', 'admin')
      or exists (
        select 1 from public.student_trainers st
        where st.student_id = progress_photos.student_id
          and st.trainer_id = auth.uid()
      )
    )
  );

drop policy if exists pphoto_update_own on public.progress_photos;
create policy pphoto_update_own on public.progress_photos for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists pphoto_delete_own on public.progress_photos;
create policy pphoto_delete_own on public.progress_photos for delete to authenticated
  using (student_id = auth.uid());
