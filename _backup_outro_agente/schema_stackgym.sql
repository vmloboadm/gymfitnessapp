-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PERFIS E ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'trainer', 'manager', 'admin')),
  gym_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  checkin_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  open_time TIME DEFAULT '06:00',
  close_time TIME DEFAULT '22:00',
  max_capacity INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed da GymFitness
INSERT INTO public.gyms (id, name, slug, address, phone)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'GymFitness',
  'gymfitness',
  'Rua Manoel Viana de Abreu, 144, Bairro Novo Jockey, Campos dos Goytacazes/RJ',
  '(22) 99778-7186'
) ON CONFLICT (slug) DO NOTHING;

-- 2. MATRÍCULAS E ASSINATURAS
CREATE TABLE IF NOT EXISTS public.student_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'overdue', 'cancelled')),
  plan_name TEXT DEFAULT 'Mensal',
  price DECIMAL(10,2) DEFAULT 120.00,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  payment_method TEXT DEFAULT 'pix',
  last_checkin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, gym_id)
);

CREATE INDEX idx_subscriptions_status ON public.student_subscriptions(status);
CREATE INDEX idx_subscriptions_end_date ON public.student_subscriptions(end_date);

-- 3. EQUIPAMENTOS E MÁQUINAS (NFC + QR)
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('strength', 'cardio', 'functional', 'free_weight', 'machine')),
  muscle_group TEXT[],
  photo_url TEXT,
  nfc_tag_id TEXT UNIQUE,
  qr_code_url TEXT,
  qr_code_data TEXT, -- URL completa: https://app.gymfitness.com/checkin?eq=UUID&src=nfc
  max_capacity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'out_of_order')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_equipment_gym ON public.equipment(gym_id);
CREATE INDEX idx_equipment_nfc ON public.equipment(nfc_tag_id);

-- 4. SESSÕES DE EQUIPAMENTO (TEMPO REAL)
CREATE TABLE IF NOT EXISTS public.equipment_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  parent_session_id UUID REFERENCES public.equipment_sessions(id),
  is_superset BOOLEAN DEFAULT FALSE,
  superset_type TEXT CHECK (superset_type IN ('biset', 'triset', 'dropset')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_equipment ON public.equipment_sessions(equipment_id, status);
CREATE INDEX idx_sessions_student ON public.equipment_sessions(student_id, status);
CREATE INDEX idx_sessions_active ON public.equipment_sessions(status) WHERE status = 'active';

-- VIEW: Contagem de pessoas online por equipamento
CREATE OR REPLACE VIEW public.equipment_occupancy AS
SELECT 
  e.id AS equipment_id,
  e.name,
  e.gym_id,
  e.max_capacity,
  COUNT(es.id) FILTER (WHERE es.status = 'active') AS active_users,
  CASE 
    WHEN COUNT(es.id) FILTER (WHERE es.status = 'active') = 0 THEN 'available'
    WHEN COUNT(es.id) FILTER (WHERE es.status = 'active') < e.max_capacity THEN 'busy'
    ELSE 'full'
  END AS occupancy_status
FROM public.equipment e
LEFT JOIN public.equipment_sessions es ON e.id = es.equipment_id
GROUP BY e.id, e.name, e.gym_id, e.max_capacity;

-- VIEW: Total de pessoas online na academia
CREATE OR REPLACE VIEW public.gym_online_count AS
SELECT 
  gym_id,
  COUNT(DISTINCT student_id) AS total_online
FROM public.equipment_sessions
WHERE status = 'active'
GROUP BY gym_id;

-- 5. CHECK-INS (RECEPÇÃO)
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  checkin_type TEXT NOT NULL DEFAULT 'qr_code' CHECK (checkin_type IN ('qr_code', 'nfc', 'manual')),
  equipment_id UUID REFERENCES public.equipment(id),
  validated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_checkins_student ON public.checkins(student_id, created_at DESC);
CREATE INDEX idx_checkins_gym_date ON public.checkins(gym_id, DATE(created_at));

-- 6. EXERCÍCIOS E BIBLIOTECA
CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID REFERENCES public.gyms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_normalized TEXT GENERATED ALWAYS AS (lower(unaccent(name))) STORED,
  muscle_group TEXT[],
  secondary_muscles TEXT[],
  category TEXT CHECK (category IN ('strength', 'cardio', 'functional', 'stretching')),
  equipment_needed TEXT[],
  description TEXT,
  tips TEXT,
  video_url TEXT,
  photo_url TEXT,
  difficulty TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  is_system BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exercises_gym ON public.exercises(gym_id);
CREATE INDEX idx_exercises_name ON public.exercises(name_normalized);

-- Seed: Biblioteca base de exercícios
INSERT INTO public.exercises (name, muscle_group, secondary_muscles, category, equipment_needed, description, difficulty, is_system) VALUES
('Supino Reto', ARRAY['peitoral'], ARRAY['tríceps', 'ombro anterior'], 'strength', ARRAY['barra', 'banco'], 'Deitado no banco, empurre a barra para cima até estender os braços.', 'beginner', TRUE),
('Supino Inclinado', ARRAY['peitoral superior'], ARRAY['ombro anterior', 'tríceps'], 'strength', ARRAY['barra', 'banco inclinado'], 'Supino com banco inclinado a 45 graus.', 'intermediate', TRUE),
('Crucifixo', ARRAY['peitoral'], ARRAY['ombro anterior'], 'strength', ARRAY['halteres', 'banco'], 'Abra os braços lateralmente e una-os acima do peito.', 'beginner', TRUE),
('Agachamento Livre', ARRAY['quadríceps'], ARRAY['glúteos', 'posterior', 'core'], 'strength', ARRAY['barra', 'rack'], 'Barra nas costas, agache até as coxas paralelas ao chão.', 'intermediate', TRUE),
('Leg Press', ARRAY['quadríceps'], ARRAY['glúteos', 'posterior'], 'strength', ARRAY['máquina leg press'], 'Empurre a plataforma com os pés até estender as pernas.', 'beginner', TRUE),
('Cadeira Extensora', ARRAY['quadríceps'], ARRAY[], 'strength', ARRAY['máquina extensora'], 'Sente na máquina e estenda as pernas.', 'beginner', TRUE),
('Mesa Flexora', ARRAY['posterior'], ARRAY['glúteos'], 'strength', ARRAY['máquina flexora'], 'Deitado de bruços, flexione os joelhos puxando o peso.', 'beginner', TRUE),
('Stiff', ARRAY['posterior'], ARRAY['glúteos', 'core', 'trapézio'], 'strength', ARRAY['barra', 'halteres'], 'Mantenha as pernas semi-estendidas e abaixe o peso.', 'intermediate', TRUE),
('Levantamento Terra', ARRAY['costas'], ARRAY['posterior', 'glúteos', 'core', 'trapézio'], 'strength', ARRAY['barra'], 'Levante a barra do chão mantendo as costas retas.', 'advanced', TRUE),
('Puxada Aberta', ARRAY['costas'], ARRAY['bíceps', 'ombro posterior'], 'strength', ARRAY['máquina pulley'], 'Puxe a barra até a parte superior do peito.', 'beginner', TRUE),
('Remada Curvada', ARRAY['costas'], ARRAY['bíceps', 'posterior', 'core'], 'strength', ARRAY['barra', 'halteres'], 'Inclinado à frente, puxe o peso em direção ao abdômen.', 'intermediate', TRUE),
('Rosca Direta', ARRAY['bíceps'], ARRAY['antebraço'], 'strength', ARRAY['barra', 'halteres'], 'Flexione os cotovelos levantando o peso.', 'beginner', TRUE),
('Rosca Martelo', ARRAY['bíceps'], ARRAY['antebraço'], 'strength', ARRAY['halteres'], 'Rosca com pegada neutra (palmas uma para a outra).', 'beginner', TRUE),
('Tríceps Testa', ARRAY['tríceps'], ARRAY[], 'strength', ARRAY['barra', 'halteres'], 'Deitado, abaixe o peso em direção à testa e estenda.', 'beginner', TRUE),
('Tríceps Corda', ARRAY['tríceps'], ARRAY[], 'strength', ARRAY['máquina pulley', 'corda'], 'Puxe a corda para baixo e separe as mãos no final.', 'beginner', TRUE),
('Desenvolvimento com Halteres', ARRAY['ombro'], ARRAY['tríceps'], 'strength', ARRAY['halteres', 'banco'], 'Sente e empurre os halteres acima da cabeça.', 'beginner', TRUE),
('Elevação Lateral', ARRAY['ombro'], ARRAY[], 'strength', ARRAY['halteres'], 'Levante os halteres lateralmente até a altura dos ombros.', 'beginner', TRUE),
('Elevação Frontal', ARRAY['ombro anterior'], ARRAY[], 'strength', ARRAY['halteres', 'barra'], 'Levante o peso à frente do corpo até a altura dos olhos.', 'beginner', TRUE),
('Abdominal Supra', ARRAY['abdominal'], ARRAY['core'], 'strength', ARRAY['colchonete'], 'Deitado, levante o tronco contraindo o abdômen.', 'beginner', TRUE),
('Abdominal Infra', ARRAY['abdominal inferior'], ARRAY['core'], 'strength', ARRAY['colchonete'], 'Levante as pernas contraindo o abdômen inferior.', 'beginner', TRUE),
('Prancha', ARRAY['core'], ARRAY['ombro', 'glúteos'], 'strength', ARRAY['colchonete'], 'Mantenha a posição de prancha com o corpo reto.', 'beginner', TRUE),
('Panturrilha em Pé', ARRAY['panturrilha'], ARRAY[], 'strength', ARRAY['máquina panturrilha', 'peso corporal'], 'Eleve os calcanhares contraindo as panturrilhas.', 'beginner', TRUE),
('Panturrilha Sentado', ARRAY['panturrilha'], ARRAY['tibial anterior'], 'strength', ARRAY['máquina panturrilha sentado'], 'Sente e eleve os calcanhares.', 'beginner', TRUE),
('Cadeira Adutora', ARRAY['adutores'], ARRAY(), 'strength', ARRAY['máquina adutora'], 'Aproxime as pernas contraindo os adutores.', 'beginner', TRUE),
('Cadeira Abdutora', ARRAY['glúteos'], ARRAY['abdutores'], 'strength', ARRAY['máquina abdutora'], 'Afaste as pernas lateralmente.', 'beginner', TRUE),
('Remada Unilateral', ARRAY['costas'], ARRAY['bíceps', 'core'], 'strength', ARRAY['halteres', 'banco'], 'Apoiado no banco, puxe o halter em direção ao quadril.', 'intermediate', TRUE),
('Pullover', ARRAY['peitoral'], ARRAY['costas', 'tríceps'], 'strength', ARRAY['halter', 'banco'], 'Deitado, leve o peso atrás da cabeça e retorne.', 'intermediate', TRUE),
('Agachamento Hack', ARRAY['quadríceps'], ARRAY['glúteos'], 'strength', ARRAY['máquina hack'], 'Agachamento guiado na máquina hack.', 'beginner', TRUE),
('Avanço', ARRAY['quadríceps'], ARRAY['glúteos', 'panturrilha'], 'strength', ARRAY['halteres', 'barra'], 'Dê um passo à frente e agache.', 'intermediate', TRUE),
('Elevação de Quadril', ARRAY['glúteos'], ARRAY['posterior', 'core'], 'strength', ARRAY['halter', 'banco'], 'Deitado, eleve o quadril contraindo os glúteos.', 'beginner', TRUE),
('Puxada Neutra', ARRAY['costas'], ARRAY['bíceps'], 'strength', ARRAY['máquina pulley'], 'Puxe com pegada neutra (palmas uma para a outra).', 'beginner', TRUE),
('Remada Baixa', ARRAY['costas'], ARRAY['bíceps', 'posterior'], 'strength', ARRAY['máquina remada'], 'Puxe a barra em direção ao abdômen.', 'beginner', TRUE),
('Crossover', ARRAY['peitoral'], ARRAY[], 'strength', ARRAY['máquina crossover'], 'Cruze os braços à frente do peito.', 'intermediate', TRUE),
('Voador', ARRAY['peitoral'], ARRAY(), 'strength', ARRAY['máquina voador'], 'Aproxime os braços como se estivesse abraçando uma árvore.', 'beginner', TRUE),
('Remada Cavalinho', ARRAY['costas'], ARRAY['bíceps', 'posterior'], 'strength', ARRAY['máquina remada'], 'Apoiado no banco inclinado, puxe o peso.', 'intermediate', TRUE),
('Rosca Scott', ARRAY['bíceps'], ARRAY['antebraço'], 'strength', ARRAY['máquina scott', 'barra'], 'Rosca com os braços apoiados no banco Scott.', 'beginner', TRUE),
('Tríceps Máquina', ARRAY['tríceps'], ARRAY(), 'strength', ARRAY['máquina tríceps'], 'Empurre para baixo estendendo os cotovelos.', 'beginner', TRUE),
('Desenvolvimento Máquina', ARRAY['ombro'], ARRAY['tríceps'], 'strength', ARRAY['máquina desenvolvimento'], 'Empurre para cima na máquina.', 'beginner', TRUE),
('Extensão de Tronco', ARRAY['costas'], ARRAY['core'], 'strength', ARRAY['máquina hiperextensão'], 'Incline o tronco para baixo e retorne.', 'beginner', TRUE),
('Russian Twist', ARRAY['core'], ARRAY['oblíquos'], 'strength', ARRAY['halter', 'colchonete'], 'Gire o tronco de um lado para o outro.', 'intermediate', TRUE),
('Mountain Climber', ARRAY['core'], ARRAY['ombro', 'quadríceps'], 'functional', ARRAY['colchonete'], 'Posição de prancha, traga os joelhos alternadamente.', 'intermediate', TRUE),
('Burpee', ARRAY['corpo inteiro'], ARRAY(), 'functional', ARRAY['peso corporal'], 'Agache, apoie as mãos, salte para trás, flexão, volte e salte.', 'advanced', TRUE),
('Jumping Jack', ARRAY['cardio'], ARRAY['ombro', 'panturrilha'], 'cardio', ARRAY['peso corporal'], 'Salte abrindo braços e pernas lateralmente.', 'beginner', TRUE),
('Corrida na Esteira', ARRAY['cardio'], ARRAY['panturrilha', 'quadríceps'], 'cardio', ARRAY['esteira'], 'Corra na esteira no ritmo desejado.', 'beginner', TRUE),
('Bicicleta Ergométrica', ARRAY['cardio'], ARRAY['quadríceps', 'posterior'], 'cardio', ARRAY['bicicleta'], 'Pedale na bicicleta ergométrica.', 'beginner', TRUE),
('Elíptico', ARRAY['cardio'], ARRAY['glúteos', 'quadríceps'], 'cardio', ARRAY['elíptico'], 'Simule a corrida no elíptico.', 'beginner', TRUE),
('Remo', ARRAY['cardio'], ARRAY['costas', 'bíceps'], 'cardio', ARRAY['remo'], 'Puxe o remo com os pés apoiados.', 'beginner', TRUE),
('Esteira Inclinada', ARRAY['cardio'], ARRAY['glúteos', 'panturrilha'], 'cardio', ARRAY['esteira'], 'Caminhe ou corra com inclinação.', 'intermediate', TRUE)
ON CONFLICT (name_normalized) DO NOTHING;

-- 7. TREINOS E PROGRAMAS
CREATE TABLE IF NOT EXISTS public.workout_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  gym_id UUID REFERENCES public.gyms(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  split_type TEXT DEFAULT 'full' CHECK (split_type IN ('full', 'upper_lower', 'push_pull_legs', 'bro_split', 'custom')),
  level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  goal TEXT DEFAULT 'hypertrophy' CHECK (goal IN ('hypertrophy', 'strength', 'endurance', 'weight_loss', 'maintenance')),
  duration_weeks INTEGER DEFAULT 4,
  is_template BOOLEAN DEFAULT FALSE,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_model TEXT,
  ai_draft JSONB,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES public.workout_programs(id) ON DELETE CASCADE,
  day_name TEXT NOT NULL, -- ex: "A - Peito e Ombro", "Segunda", "Push"
  day_order INTEGER NOT NULL DEFAULT 1,
  muscle_groups TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID NOT NULL REFERENCES public.workout_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id),
  sets INTEGER NOT NULL DEFAULT 3,
  reps TEXT NOT NULL DEFAULT '10-12',
  rest_seconds INTEGER DEFAULT 60,
  order_index INTEGER NOT NULL DEFAULT 0,
  technique TEXT CHECK (technique IN ('normal', 'dropset', 'superset', 'biset', 'triset', 'rest_pause', 'cluster')),
  rpe_target INTEGER CHECK (rpe_target BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TREINOS DO ALUNO (ATRIBUIÇÃO)
CREATE TABLE IF NOT EXISTS public.student_workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.workout_programs(id),
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  active_from DATE DEFAULT CURRENT_DATE,
  active_until DATE,
  current_day_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. LOGS DE TREINO (HISTÓRICO)
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  program_id UUID REFERENCES public.workout_programs(id),
  day_id UUID REFERENCES public.workout_days(id),
  exercise_id UUID NOT NULL REFERENCES public.exercises(id),
  equipment_session_id UUID REFERENCES public.equipment_sessions(id),
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sets JSONB NOT NULL DEFAULT '[]',
  total_volume DECIMAL(10,2) GENERATED ALWAYS AS (
    (SELECT COALESCE(SUM((s->>'weight')::numeric * (s->>'reps')::numeric), 0)
     FROM jsonb_array_elements(sets) AS s)
  ) STORED,
  notes TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_logs_student_date ON public.workout_logs(student_id, workout_date DESC);
CREATE INDEX idx_logs_exercise ON public.workout_logs(student_id, exercise_id, workout_date DESC);

-- 10. MÉTRICAS CORPORAIS
CREATE TABLE IF NOT EXISTS public.body_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  measured_by UUID REFERENCES public.profiles(id),
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,2),
  body_fat_pct DECIMAL(5,2),
  muscle_mass_kg DECIMAL(5,2),
  visceral_fat DECIMAL(5,2),
  bmi DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN height_cm > 0 THEN weight_kg / ((height_cm/100)^2) ELSE NULL END
  ) STORED,
  waist_cm DECIMAL(5,2),
  chest_cm DECIMAL(5,2),
  arm_cm DECIMAL(5,2),
  thigh_cm DECIMAL(5,2),
  measured_at DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_metrics_student ON public.body_metrics(student_id, measured_at DESC);

-- 11. FEED SOCIAL
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES public.gyms(id),
  content TEXT NOT NULL,
  media_urls TEXT[],
  post_type TEXT DEFAULT 'general' CHECK (post_type IN ('general', 'achievement', 'announcement', 'challenge')),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feed_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.feed_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. GAMIFICAÇÃO E RANKING
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  points INTEGER DEFAULT 0,
  condition_type TEXT NOT NULL, -- 'checkins_total', 'streak_days', 'pr_count', 'volume_total', etc
  condition_value INTEGER NOT NULL DEFAULT 1
);

-- Seed de conquistas
INSERT INTO public.achievements (code, name, description, points, condition_type, condition_value) VALUES
('first_workout', 'Primeiro Treino', 'Completou o primeiro treino no app', 50, 'workouts_total', 1),
('week_warrior', 'Guerreiro da Semana', 'Treinou 5 dias na semana', 100, 'weekly_checkins', 5),
('streak_7', 'Fogo no Parquinho', '7 dias de streak', 200, 'streak_days', 7),
('streak_30', 'Imparável', '30 dias de streak', 500, 'streak_days', 30),
('pr_5', 'Monstro', 'Bateu PR em 5 exercícios diferentes', 300, 'pr_count', 5),
('volume_10k', '10 Toneladas', 'Acumulou 10.000kg de volume total', 150, 'volume_total', 10000),
('early_bird', 'Madrugador', 'Treinou antes das 7h', 50, 'early_checkin', 1),
('night_owl', 'Coruja', 'Treinou depois das 21h', 50, 'late_checkin', 1)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.student_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS public.leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  period TEXT NOT NULL DEFAULT 'weekly' CHECK (period IN ('daily', 'weekly', 'monthly', 'all_time')),
  points INTEGER DEFAULT 0,
  workouts_count INTEGER DEFAULT 0,
  checkins_count INTEGER DEFAULT 0,
  volume_total DECIMAL(12,2) DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  rank_position INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gym_id, student_id, period)
);

CREATE INDEX idx_leaderboard_gym ON public.leaderboard(gym_id, period, points DESC);

-- 13. NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'general' CHECK (type IN ('general', 'workout', 'checkin', 'subscription', 'achievement', 'message', 'equipment')),
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

-- 14. RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: todos veem perfis básicos, mas só editam o próprio
CREATE POLICY "Profiles viewable by all" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Subscriptions: aluno vê a própria, gestor vê todas da academia
CREATE POLICY "Subscriptions viewable by owner" ON public.student_subscriptions
  FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Subscriptions viewable by manager" ON public.student_subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin'))
  );

-- Equipment: todos veem da academia
CREATE POLICY "Equipment viewable by gym members" ON public.equipment
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND gym_id = equipment.gym_id)
  );

-- Equipment Sessions: aluno vê as próprias, gestor vê todas
CREATE POLICY "Sessions viewable by owner" ON public.equipment_sessions
  FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Sessions viewable by manager" ON public.equipment_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin'))
  );

-- Checkins: aluno vê as próprias, gestor vê todas
CREATE POLICY "Checkins viewable by owner" ON public.checkins
  FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Checkins viewable by manager" ON public.checkins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin'))
  );

-- Exercises: todos veem (sistema + da academia)
CREATE POLICY "Exercises viewable by all" ON public.exercises
  FOR SELECT USING (is_system = TRUE OR gym_id IS NULL OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND gym_id = exercises.gym_id
  ));

-- Workout Programs: aluno vê os próprios, personal vê os que criou, gestor vê todos da academia
CREATE POLICY "Programs viewable by student" ON public.workout_programs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.student_workouts WHERE program_id = workout_programs.id AND student_id = auth.uid())
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager', 'admin') AND gym_id = workout_programs.gym_id)
  );

-- Workout Logs: aluno vê o próprio, personal/gestor vê dos alunos vinculados
CREATE POLICY "Logs viewable by owner" ON public.workout_logs
  FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Logs viewable by trainer" ON public.workout_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('trainer', 'manager', 'admin'))
  );

-- Body Metrics: aluno vê o próprio, personal/gestor vê dos alunos
CREATE POLICY "Metrics viewable by owner" ON public.body_metrics
  FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Metrics viewable by trainer" ON public.body_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('trainer', 'manager', 'admin'))
  );

-- Feed: todos da academia veem
CREATE POLICY "Feed viewable by gym members" ON public.feed_posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND gym_id = feed_posts.gym_id)
  );
CREATE POLICY "Feed likes viewable by all" ON public.feed_likes
  FOR SELECT USING (true);
CREATE POLICY "Feed comments viewable by all" ON public.feed_comments
  FOR SELECT USING (true);

-- Notifications: só o dono
CREATE POLICY "Notifications viewable by owner" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- 15. TRIGGERS
-- Trigger: criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, gym_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'gym_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.student_subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.student_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger: atualizar likes_count e comments_count no feed
CREATE OR REPLACE FUNCTION public.update_post_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'feed_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.feed_posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'feed_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.feed_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.feed_posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_like_change ON public.feed_likes;
CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.feed_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_counts();

DROP TRIGGER IF EXISTS on_comment_change ON public.feed_comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_counts();

-- 16. FUNÇÃO: VERIFICAR STATUS DA MATRÍCULA
CREATE OR REPLACE FUNCTION public.check_subscription_status(p_student_id UUID)
RETURNS TABLE (
  is_active BOOLEAN,
  days_remaining INTEGER,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.status = 'active' AND ss.end_date >= CURRENT_DATE AS is_active,
    GREATEST((ss.end_date - CURRENT_DATE), 0)::INTEGER AS days_remaining,
    ss.status
  FROM public.student_subscriptions ss
  WHERE ss.student_id = p_student_id
  ORDER BY ss.end_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. EDGE FUNCTION HELPERS (SQL — Edge Functions vão no código)
-- Função: fechar sessões abandonadas (chamada por cron job)
CREATE OR REPLACE FUNCTION public.close_abandoned_sessions()
RETURNS VOID AS $$
BEGIN
  UPDATE public.equipment_sessions
  SET status = 'abandoned', ended_at = now()
  WHERE status = 'active' AND started_at < now() - INTERVAL '90 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- EDGE FUNCTION HELPERS (SQL — Edge Functions vão no código)
-- ============================================================
-- Função: fechar sessões abandonadas (chamada por cron job)
CREATE OR REPLACE FUNCTION public.close_abandoned_sessions()
RETURNS void AS $$
BEGIN
  UPDATE public.equipment_sessions
  SET status = 'abandoned', ended_at = now()
  WHERE status = 'active' AND started_at < now() - INTERVAL '90 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- EDGE FUNCTION HELPERS (SQL — Edge Functions vão no código)
-- ============================================================
-- Função: fechar sessões abandonadas (chamada por cron job)
CREATE OR REPLACE FUNCTION public.close_abandoned_sessions()
RETURNS void AS $$
BEGIN
  UPDATE public.equipment_sessions
  SET status = 'abandoned', ended_at = now()
  WHERE status = 'active' AND started_at < now() - INTERVAL '90 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- EDGE FUNCTION HELPERS (SQL — Edge Functions vão no código)
-- ============================================================
-- Função: fechar sessões abandonadas (chamada por cron job)
CREATE OR REPLACE FUNCTION public.close_abandoned_sessions()
RETURNS void AS $$
BEGIN
  UPDATE public.equipment_sessions
  SET status = 'abandoned', ended_at = now()
  WHERE status = 'active' AND started_at < now() - INTERVAL '90 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
# End of schema_stackgym.sql