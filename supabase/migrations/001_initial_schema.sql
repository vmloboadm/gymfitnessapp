-- =====================================================================
-- GymFitness App — 001_initial_schema.sql
-- Schema completo multi-tenant + RLS por role
-- REGRA 0.1: toda tabela tem gym_id e toda policy filtra por gym_id
-- SQL padrão Postgres/Supabase (sem UUID gen_random_uuid p/ compat: usa extensions)
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Tabelas base
-- ---------------------------------------------------------------------

create table if not exists public.gyms (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  logo_url    text,
  address     text,
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  gym_id               uuid not null references public.gyms(id),
  role                 text not null default 'student' check (role in ('student','trainer','manager','admin')),
  status               text not null default 'active' check (status in ('active','blocked','pending_clearance')),
  name                 text not null,
  email                text not null,
  phone                text,
  avatar_url           text,
  birth_date           date,
  goal                 text,
  medical_risk         boolean not null default false,
  onboarding_completed boolean not null default false,
  onboarding_step      int  not null default 0,
  lgpd_consent_at      timestamptz,
  daily_intake         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funções de segurança (helpers multi-tenant)
-- ---------------------------------------------------------------------

-- gym_id do usuário autenticado (null se não tem perfil / não logado)
create or replace function public.current_gym_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select gym_id from public.profiles where id = auth.uid();
$$;

-- role do usuário autenticado
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;
-- =====================================================================
-- Vínculo aluno <-> personal
-- =====================================================================

create table if not exists public.student_trainers (
  id          uuid primary key default uuid_generate_v4(),
  gym_id      uuid not null references public.gyms(id),
  student_id  uuid not null references public.profiles(id),
  trainer_id  uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  unique (student_id, trainer_id)
);

alter table public.student_trainers enable row level security;

create policy "strainers_select_self" on public.student_trainers
  for select using (student_id = auth.uid() or trainer_id = auth.uid());

create policy "strainers_select_manager" on public.student_trainers
  for select using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "strainers_assign_trainer" on public.student_trainers
  for insert with check (
    trainer_id = auth.uid()
    or public.current_role() in ('manager','admin')
  );

-- true se é aluno vinculado ao trainer autenticado (função precisa da tabela
-- student_trainers existir — por isso fica aqui, após a criação da tabela)
create or replace function public.trainer_owns_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.student_trainers st
    where st.trainer_id = auth.uid()
      and st.student_id = p_student_id
      and st.gym_id = public.current_gym_id()
  ) or auth.uid() = p_student_id;
$$;



-- =====================================================================
-- RLS: habilita em todas as tabelas
-- =====================================================================

alter table public.gyms     enable row level security;
alter table public.profiles enable row level security;

-- =====================================================================
-- Policies
-- =====================================================================

-- gyms: qualquer um logado lê a própria academia; ninguém altera via RLS
create policy "gyms_select_own" on public.gyms
  for select using (id = public.current_gym_id());

-- profiles: cada um vê o próprio; trainer vê alunos vinculados; gestor/adm vê tudo da academia
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_gym_by_manager" on public.profiles
  for select using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "profiles_select_linked_by_trainer" on public.profiles
  for select using (
    public.current_role() = 'trainer'
    and public.trainer_owns_student(id)
    and gym_id = public.current_gym_id()
  );

-- cada usuário atualiza o próprio perfil
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- inserção de perfil: apenas o próprio usuário no cadastro (LGPD)
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- =====================================================================
-- Matrículas
-- =====================================================================

create table if not exists public.student_subscriptions (
  id             uuid primary key default uuid_generate_v4(),
  gym_id         uuid not null references public.gyms(id),
  student_id     uuid not null references public.profiles(id),
  plan_name      text not null,
  type           text not null default 'monthly' check (type in ('monthly','gympass','totalpass')),
  status         text not null default 'active' check (status in ('active','expired','blocked','cancelled')),
  price          numeric(10,2) not null default 0,
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null,
  payment_method text,
  auto_renew     boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.student_subscriptions enable row level security;

-- aluno vê só as próprias matrículas
create policy "student_subs_select_own" on public.student_subscriptions
  for select using (student_id = auth.uid());

-- personal/gestor veem da academia
create policy "student_subs_select_gym" on public.student_subscriptions
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

-- gestor/admin gerencia
create policy "student_subs_manage_manager" on public.student_subscriptions
  for all using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

-- =====================================================================
-- Check-ins e day-passes
-- =====================================================================

create table if not exists public.checkins (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id),
  student_id uuid not null references public.profiles(id),
  type       text not null default 'entrada' check (type in ('entrada','saida')),
  source     text not null default 'qrcode' check (source in ('qrcode','nfc','app')),
  checked_at timestamptz not null default now()
);

alter table public.checkins enable row level security;

create policy "checkins_select_own" on public.checkins
  for select using (student_id = auth.uid());

create policy "checkins_select_gym_staff" on public.checkins
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "checkins_insert_own" on public.checkins
  for insert with check (student_id = auth.uid() and gym_id = public.current_gym_id());

create table if not exists public.day_passes (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id),
  code       text unique not null,
  name       text not null,
  phone      text,
  email      text,
  status     text not null default 'active' check (status in ('active','expired','used')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.day_passes enable row level security;

-- visitantes criam e leem o próprio (por código)
create policy "day_passes_insert_anon" on public.day_passes
  for insert with check (true);

create policy "day_passes_select_own_code" on public.day_passes
  for select using (true);

create policy "day_passes_manage_manager" on public.day_passes
  for all using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

-- =====================================================================
-- Equipamentos e sessões
-- =====================================================================

create table if not exists public.equipment (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  name         text not null,
  category     text not null check (category in ('peito','costas','ombro','biceps','triceps','perna','gluteo','core','cardio','panturrilha')),
  capacity     int not null default 1,
  status       text not null default 'available' check (status in ('available','in_use','maintenance')),
  nfc_tag_url  text,
  qr_url       text,
  map_position jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.equipment enable row level security;

create policy "equipment_select_gym" on public.equipment
  for select using (gym_id = public.current_gym_id());

create policy "equipment_manage_manager" on public.equipment
  for all using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

create table if not exists public.equipment_variations (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  exercise_id  uuid,
  name         text not null,
  default_sets int,
  default_reps int
);

alter table public.equipment_variations enable row level security;

create policy "equipment_variations_select_gym" on public.equipment_variations
  for select using (gym_id = public.current_gym_id());

create policy "equipment_variations_manage_manager" on public.equipment_variations
  for all using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

create table if not exists public.equipment_sessions (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  equipment_id uuid not null references public.equipment(id),
  variation_id uuid references public.equipment_variations(id),
  student_id   uuid not null references public.profiles(id),
  status       text not null default 'active' check (status in ('active','completed')),
  type         text not null default 'regular' check (type in ('regular','biset','triset')),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  meta         jsonb
);

alter table public.equipment_sessions enable row level security;

create policy "sessions_select_own" on public.equipment_sessions
  for select using (student_id = auth.uid());

create policy "sessions_select_gym_staff" on public.equipment_sessions
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "sessions_insert_own" on public.equipment_sessions
  for insert with check (student_id = auth.uid() and gym_id = public.current_gym_id());

create policy "sessions_update_own" on public.equipment_sessions
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());

create table if not exists public.equipment_maintenance_logs (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  reason       text not null,
  status       text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

alter table public.equipment_maintenance_logs enable row level security;

create policy "maintenance_select_gym" on public.equipment_maintenance_logs
  for select using (gym_id = public.current_gym_id());

create policy "maintenance_insert_staff" on public.equipment_maintenance_logs
  for insert with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "maintenance_manage_manager" on public.equipment_maintenance_logs
  for all using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

-- =====================================================================
-- Exercícios, treinos e logs
-- =====================================================================

create table if not exists public.exercises (
  id                uuid primary key default uuid_generate_v4(),
  gym_id            uuid references public.gyms(id), -- null = global do produto
  name              text not null,
  category          text not null check (category in ('peito','costas','ombro','biceps','triceps','perna','gluteo','core','cardio','panturrilha')),
  muscles           text[] not null default '{}',
  equipment_id      uuid references public.equipment(id),
  photo_url         text,
  tips              text[] default '{}',
  technique_default text not null default 'normal' check (technique_default in ('normal','dropset','biset','triset')),
  high_impact       boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "exercises_select_gym_or_global" on public.exercises
  for select using (
    gym_id is null or gym_id = public.current_gym_id()
  );

create policy "exercises_manage_manager" on public.exercises
  for all using (
    public.current_role() in ('manager','admin')
    and (gym_id = public.current_gym_id() or gym_id is null)
  ) with check (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

create table if not exists public.workout_programs (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  trainer_id   uuid not null references public.profiles(id),
  name         text not null,
  objective    text,
  created_via  text not null default 'manual' check (created_via in ('manual','ia','foto','template')),
  ai_model     text,
  ai_draft     text,
  reviewed_by  uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.workout_programs enable row level security;

create policy "workouts_select_trainer" on public.workout_programs
  for select using (
    trainer_id = auth.uid()
    or public.current_role() in ('manager','admin')
  );

create policy "workouts_insert_trainer" on public.workout_programs
  for insert with check (
    trainer_id = auth.uid()
    or public.current_role() in ('manager','admin')
  );

create policy "workouts_update_trainer" on public.workout_programs
  for update using (
    trainer_id = auth.uid()
    or public.current_role() in ('manager','admin')
  ) with check (
    trainer_id = auth.uid()
    or public.current_role() in ('manager','admin')
  );

create table if not exists public.workout_days (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id),
  program_id uuid not null references public.workout_programs(id) on delete cascade,
  name       text not null,
  day_order  int not null default 1
);

alter table public.workout_days enable row level security;

create policy "days_select_trainer_gym" on public.workout_days
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "days_insert_trainer_gym" on public.workout_days
  for insert with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "days_update_trainer_gym" on public.workout_days
  for update using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create table if not exists public.workout_exercises (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  day_id       uuid not null references public.workout_days(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id),
  variation_id uuid references public.equipment_variations(id),
  sets         int not null default 3,
  reps         text not null default '12',
  rest_seconds int not null default 60,
  rpe          int check (rpe between 1 and 10),
  notes        text,
  technique    text not null default 'normal' check (technique in ('normal','dropset','biset','triset')),
  ord          int not null default 1
);

alter table public.workout_exercises enable row level security;

create policy "wex_select_trainer_gym" on public.workout_exercises
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "wex_insert_trainer_gym" on public.workout_exercises
  for insert with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "wex_update_trainer_gym" on public.workout_exercises
  for update using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create table if not exists public.student_workouts (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  student_id   uuid not null references public.profiles(id),
  program_id   uuid not null references public.workout_programs(id),
  status       text not null default 'active' check (status in ('active','paused','completed')),
  assigned_at  timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz
);

alter table public.student_workouts enable row level security;

create policy "sworkouts_select_own" on public.student_workouts
  for select using (student_id = auth.uid());

create policy "sworkouts_select_trainer_linked" on public.student_workouts
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "sworkouts_insert_trainer" on public.student_workouts
  for insert with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create table if not exists public.workout_logs (
  id          uuid primary key default uuid_generate_v4(),
  gym_id      uuid not null references public.gyms(id),
  student_id  uuid not null references public.profiles(id),
  workout_id  uuid references public.student_workouts(id),
  exercise_id uuid not null references public.exercises(id),
  session_id  uuid references public.equipment_sessions(id),
  date        timestamptz not null default now(),
  weight_kg   numeric(6,2) not null default 0,
  reps        int not null default 0,
  rpe         int check (rpe between 1 and 10),
  technique   text not null default 'normal' check (technique in ('normal','dropset','biset','triset'))
);

alter table public.workout_logs enable row level security;

create policy "logs_select_own" on public.workout_logs
  for select using (student_id = auth.uid());

create policy "logs_select_trainer_linked" on public.workout_logs
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "logs_insert_own" on public.workout_logs
  for insert with check (student_id = auth.uid() and gym_id = public.current_gym_id());

-- =====================================================================
-- Métricas corporais
-- =====================================================================

create table if not exists public.body_metrics (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  student_id   uuid not null references public.profiles(id),
  recorded_at  timestamptz not null default now(),
  weight_kg    numeric(5,2),
  height_m     numeric(4,2),
  body_fat_pct numeric(4,1),
  bmi          numeric(4,1),
  muscle_kg    numeric(5,2),
  waist_cm     numeric(5,1),
  source       text not null default 'manual' check (source in ('manual','bioimpedancia','doctor'))
);

alter table public.body_metrics enable row level security;

create policy "metrics_select_own" on public.body_metrics
  for select using (student_id = auth.uid());

create policy "metrics_select_trainer_linked" on public.body_metrics
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "metrics_insert_own" on public.body_metrics
  for insert with check (student_id = auth.uid() and gym_id = public.current_gym_id());

create policy "metrics_insert_trainer" on public.body_metrics
  for insert with check (
    public.current_role() in ('trainer','manager')
    and gym_id = public.current_gym_id()
  );

-- =====================================================================
-- Social
-- =====================================================================

create table if not exists public.feed_posts (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id),
  author_id  uuid not null references public.profiles(id),
  type       text not null default 'geral' check (type in ('geral','conquista','comunicado','desafio')),
  body       text not null,
  media_url  text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  is_pinned  boolean not null default false
);

alter table public.feed_posts enable row level security;

create policy "feed_select_gym" on public.feed_posts
  for select using (gym_id = public.current_gym_id());

create policy "feed_insert_gym" on public.feed_posts
  for insert with check (
    author_id = auth.uid()
    and gym_id = public.current_gym_id()
  );

create policy "feed_delete_own_or_manager" on public.feed_posts
  for delete using (
    author_id = auth.uid()
    or public.current_role() in ('manager','admin')
  );

create table if not exists public.feed_likes (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id),
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.feed_likes enable row level security;

create policy "likes_select_gym" on public.feed_likes
  for select using (gym_id = public.current_gym_id());

create policy "likes_insert_own" on public.feed_likes
  for insert with check (user_id = auth.uid() and gym_id = public.current_gym_id());

create policy "likes_delete_own" on public.feed_likes
  for delete using (user_id = auth.uid());

create table if not exists public.feed_comments (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id),
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);

alter table public.feed_comments enable row level security;

create policy "comments_select_gym" on public.feed_comments
  for select using (gym_id = public.current_gym_id());

create policy "comments_insert_own" on public.feed_comments
  for insert with check (user_id = auth.uid() and gym_id = public.current_gym_id());

create policy "comments_delete_own_or_manager" on public.feed_comments
  for delete using (
    user_id = auth.uid()
    or public.current_role() in ('manager','admin')
  );

create table if not exists public.squads (
  id              uuid primary key default uuid_generate_v4(),
  gym_id          uuid not null references public.gyms(id),
  name            text not null,
  description     text,
  challenge_start timestamptz,
  challenge_end   timestamptz,
  type            text not null default 'grupo' check (type in ('desafio','grupo')),
  created_at      timestamptz not null default now()
);

alter table public.squads enable row level security;

create policy "squads_select_gym" on public.squads
  for select using (gym_id = public.current_gym_id());

create policy "squads_insert_trainer" on public.squads
  for insert with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create table if not exists public.squad_members (
  id        uuid primary key default uuid_generate_v4(),
  gym_id    uuid not null references public.gyms(id),
  squad_id  uuid not null references public.squads(id) on delete cascade,
  user_id   uuid not null references public.profiles(id),
  joined_at timestamptz not null default now(),
  unique (squad_id, user_id)
);

alter table public.squad_members enable row level security;

create policy "smembers_select_gym" on public.squad_members
  for select using (gym_id = public.current_gym_id());

create policy "smembers_insert_own" on public.squad_members
  for insert with check (user_id = auth.uid() and gym_id = public.current_gym_id());

create policy "smembers_join" on public.squad_members
  for delete using (user_id = auth.uid() or public.current_role() in ('manager','admin'));

create table if not exists public.squad_messages (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  squad_id     uuid not null references public.squads(id) on delete cascade,
  user_id      uuid not null references public.profiles(id),
  sender_type  text not null default 'student' check (sender_type in ('student','trainer','manager','admin','ai')),
  ai_embedding boolean not null default false,
  body         text not null,
  created_at   timestamptz not null default now()
);

alter table public.squad_messages enable row level security;

create policy "smessages_select_member" on public.squad_messages
  for select using (
    exists (select 1 from public.squad_members sm
            where sm.squad_id = squad_messages.squad_id
              and sm.user_id = auth.uid())
  );

create policy "smessages_insert_member" on public.squad_messages
  for insert with check (
    exists (select 1 from public.squad_members sm
            where sm.squad_id = squad_messages.squad_id
              and sm.user_id = auth.uid())
  );

-- =====================================================================
-- Gamificação
-- =====================================================================

create table if not exists public.achievements (
  id          uuid primary key default uuid_generate_v4(),
  gym_id      uuid references public.gyms(id), -- null = global
  code        text unique not null,
  name        text not null,
  description text not null,
  badge_url   text,
  points      int not null default 0
);

alter table public.achievements enable row level security;

create policy "achievements_select" on public.achievements
  for select using (gym_id is null or gym_id = public.current_gym_id());

create table if not exists public.student_achievements (
  id             uuid primary key default uuid_generate_v4(),
  gym_id         uuid not null references public.gyms(id),
  student_id     uuid not null references public.profiles(id),
  achievement_id uuid not null references public.achievements(id),
  earned_at      timestamptz not null default now(),
  unique (student_id, achievement_id)
);

alter table public.student_achievements enable row level security;

create policy "sachievements_select_own" on public.student_achievements
  for select using (student_id = auth.uid());

create policy "sachievements_select_staff" on public.student_achievements
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "sachievements_insert" on public.student_achievements
  for insert with check (
    student_id = auth.uid()
    or public.current_role() in ('manager','admin')
  );

create table if not exists public.leaderboard (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id),
  week_start date not null,
  student_id uuid not null references public.profiles(id),
  rank_type  text not null check (rank_type in ('load','constancy')),
  points     int not null default 0,
  load_kg    numeric(12,2) not null default 0,
  sessions   int not null default 0,
  unique (gym_id, week_start, student_id, rank_type)
);

alter table public.leaderboard enable row level security;

create policy "leaderboard_select_gym" on public.leaderboard
  for select using (gym_id = public.current_gym_id());

create policy "leaderboard_system" on public.leaderboard
  for all using (public.current_role() in ('trainer','manager','admin'))
  with check (public.current_role() in ('trainer','manager','admin'));

-- =====================================================================
-- Notificações
-- =====================================================================

create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  gym_id     uuid not null references public.gyms(id),
  user_id    uuid not null references public.profiles(id),
  channel    text not null default 'in_app' check (channel in ('in_app','push','email')),
  title      text not null,
  body       text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications_insert_system" on public.notifications
  for insert with check (true);

create table if not exists public.notification_settings (
  id              uuid primary key default uuid_generate_v4(),
  gym_id          uuid not null references public.gyms(id),
  user_id         uuid not null references public.profiles(id),
  push_workouts   boolean not null default true,
  push_social     boolean not null default true,
  push_reminders  boolean not null default true,
  push_promotions boolean not null default false,
  unique (user_id)
);

alter table public.notification_settings enable row level security;

create policy "nsettings_select_own" on public.notification_settings
  for select using (user_id = auth.uid());

create policy "nsettings_insert_own" on public.notification_settings
  for insert with check (user_id = auth.uid());

create policy "nsettings_update_own" on public.notification_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- IA & Auditoria (LGPD)
-- =====================================================================

create table if not exists public.ai_generation_logs (
  id                   uuid primary key default uuid_generate_v4(),
  gym_id               uuid not null references public.gyms(id),
  user_id              uuid not null references public.profiles(id),
  purpose              text not null check (purpose in ('generate_workout','parse_ficha','edit_template','plato_detection','insight_student','insight_trainer','insight_manager','register_student')),
  created_via          text not null default 'manual' check (created_via in ('manual','ia','foto','template')),
  ai_model             text,
  prompt_tokens        int,
  completion_tokens    int,
  estimated_cost       numeric(10,6),
  ai_draft             text,
  reviewed_by          uuid,
  used_sensitive_data  boolean not null default false,
  created_at           timestamptz not null default now()
);

alter table public.ai_generation_logs enable row level security;

create policy "ai_logs_insert" on public.ai_generation_logs
  for insert with check (
    user_id = auth.uid()
    or public.current_role() in ('trainer','manager','admin')
  );

create policy "ai_logs_select_staff" on public.ai_generation_logs
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create table if not exists public.premium_requests (
  id          uuid primary key default uuid_generate_v4(),
  gym_id      uuid not null references public.gyms(id),
  student_id  uuid not null references public.profiles(id),
  request_type text not null default 'pdf' check (request_type in ('pdf','report','other')),
  details     text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

alter table public.premium_requests enable row level security;

create policy "premium_insert_own" on public.premium_requests
  for insert with check (student_id = auth.uid() and gym_id = public.current_gym_id());

create policy "premium_select_own" on public.premium_requests
  for select using (student_id = auth.uid());

create policy "premium_select_manager" on public.premium_requests
  for select using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "premium_manage_manager" on public.premium_requests
  for update using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

create table if not exists public.medical_clearances (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  student_id   uuid not null references public.profiles(id),
  document_url text not null,
  approved     boolean not null default false,
  reviewed_by  uuid,
  created_at   timestamptz not null default now(),
  approved_at  timestamptz
);

alter table public.medical_clearances enable row level security;

create policy "clearances_insert_own" on public.medical_clearances
  for insert with check (student_id = auth.uid() and gym_id = public.current_gym_id());

create policy "clearances_select_own" on public.medical_clearances
  for select using (student_id = auth.uid());

create policy "clearances_select_trainer" on public.medical_clearances
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

create policy "clearances_manage_staff" on public.medical_clearances
  for update using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

-- =====================================================================
-- Triggers e funções de negócio
-- =====================================================================

-- atualiza updated_at automaticamente
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trg_subs_updated before update on public.student_subscriptions
  for each row execute function public.touch_updated_at();
create trigger trg_equipment_updated before update on public.equipment
  for each row execute function public.touch_updated_at();
create trigger trg_programs_updated before update on public.workout_programs
  for each row execute function public.touch_updated_at();

-- TRAVA CLÍNICA: se aluno tem medical_risk=true e NÃO tem clearance aprovado,
-- status do profile vira pending_clearance (bloqueia fluir IA de alto impacto)
create or replace function public.enforce_medical_clearance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.medical_risk and not exists (
    select 1 from public.medical_clearances mc
    where mc.student_id = new.id and mc.approved and mc.gym_id = new.gym_id
  ) then
    new.status = 'pending_clearance';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_medical before insert or update of medical_risk on public.profiles
  for each row execute function public.enforce_medical_clearance();

-- CHECK-IN único por dia: evita double check-in de entrada no mesmo dia
create or replace function public.prevent_duplicate_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'entrada' and exists (
    select 1 from public.checkins c
    where c.student_id = new.student_id
      and c.gym_id = new.gym_id
      and c.type = 'entrada'
      and c.checked_at::date = new.checked_at::date
  ) then
    raise exception 'Check-in de entrada já realizado hoje';
  end if;
  return new;
end;
$$;

create trigger trg_checkin_duplicate before insert on public.checkins
  for each row execute function public.prevent_duplicate_checkin();

-- =====================================================================
-- Inserts automáticos: o join de 'gyms' => 'profiles' já é por FKs +
-- policy. Índices de performance para multi-tenant (queries por gym_id)
-- =====================================================================

create index if not exists idx_profiles_gym        on public.profiles(gym_id);
create index if not exists idx_subs_student         on public.student_subscriptions(student_id);
create index if not exists idx_subs_gym             on public.student_subscriptions(gym_id);
create index if not exists idx_checkins_student_day on public.checkins(student_id, checked_at);
create index if not exists idx_checkins_gym        on public.checkins(gym_id);
create index if not exists idx_sessions_gym_active  on public.equipment_sessions(gym_id, status);
create index if not exists idx_sessions_student     on public.equipment_sessions(student_id, status);
create index if not exists idx_metrics_student      on public.body_metrics(student_id, recorded_at);
create index if not exists idx_logs_student_date    on public.workout_logs(student_id, date);
create index if not exists idx_feed_gym_exp         on public.feed_posts(gym_id, expires_at);
create index if not exists idx_leaderboard_gym_wk   on public.leaderboard(gym_id, week_start);
create index if not exists idx_notifications_user   on public.notifications(user_id, read_at);