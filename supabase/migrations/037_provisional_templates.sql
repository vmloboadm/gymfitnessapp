-- 037_provisional_templates.sql
-- Treino provisório: modelos de referência (4 masculinos + 4 femininos) para o
-- aluno sem plano não ficar sem nada. É SÓ referência, em aba separada, com
-- selo provisório: nunca vira plano atribuído (sem student_workouts).
-- Treinar um modelo grava workout_logs com workout_id nulo (permitido).

create table if not exists public.workout_templates (
  id uuid not null default uuid_generate_v4() primary key,
  gym_id uuid references public.gyms(id),
  sex text not null default 'all' check (sex in ('M', 'F', 'all')),
  name text not null,
  goal text not null default 'Condicionamento',
  level text not null default 'Iniciante',
  days jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.workout_templates enable row level security;

grant select on public.workout_templates to anon, authenticated;

drop policy if exists templates_select_gym on public.workout_templates;
create policy templates_select_gym on public.workout_templates for select
  using (gym_id is null or gym_id = public.current_gym_id());

-- 8 modelos básicos com nomes EXATOS da biblioteca (resolução 100% confiável)
insert into public.workout_templates (gym_id, sex, name, goal, level, days) values
(null, 'M', 'Full Body Inicial', 'Condicionamento', 'Iniciante',
 '[{"nome": "Treino provisório · corpo inteiro", "exercicios": [
   {"exercicio": "Supino na máquina", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Ajuste o banco na altura do peito"},
   {"exercicio": "Puxada frontal (pulldown)", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Peito aberto"},
   {"exercicio": "Leg press 45°", "series": 3, "reps": "10-12", "descanso": "90s", "rpe": 7, "dica": "Não trave o joelho"},
   {"exercicio": "Desenvolvimento na máquina", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Movimento controlado"},
   {"exercicio": "Rosca na máquina", "series": 2, "reps": "10-12", "descanso": "60s", "rpe": 7, "dica": ""},
   {"exercicio": "Tríceps na polia (corda)", "series": 2, "reps": "10-12", "descanso": "60s", "rpe": 7, "dica": "Abra a corda no final"},
   {"exercicio": "Abdominal crunch", "series": 2, "reps": "12-15", "descanso": "45-60s", "rpe": 6, "dica": "Expire subindo"}
 ]}]'::jsonb),
(null, 'M', 'Superiores', 'Hipertrofia', 'Intermediário',
 '[{"nome": "Treino provisório · superiores", "exercicios": [
   {"exercicio": "Supino reto com barra", "series": 4, "reps": "8-12", "descanso": "90-120s", "rpe": 8, "dica": "Pegada pouco além dos ombros"},
   {"exercicio": "Remada curvada com barra", "series": 4, "reps": "8-12", "descanso": "90-120s", "rpe": 8, "dica": "Tronco inclinado 45 graus"},
   {"exercicio": "Desenvolvimento militar", "series": 3, "reps": "8-12", "descanso": "60-120s", "rpe": 8, "dica": "Core travado"},
   {"exercicio": "Rosca direta com barra", "series": 3, "reps": "8-12", "descanso": "60-90s", "rpe": 8, "dica": "Sem balanço"},
   {"exercicio": "Tríceps testa", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Cotovelos fixos"},
   {"exercicio": "Crucifixo com halteres", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Banco reto"}
 ]}]'::jsonb),
(null, 'M', 'Inferiores', 'Hipertrofia', 'Intermediário',
 '[{"nome": "Treino provisório · inferiores", "exercicios": [
   {"exercicio": "Agachamento livre", "series": 4, "reps": "8-12", "descanso": "90-120s", "rpe": 8, "dica": "Profundidade com controle"},
   {"exercicio": "Cadeira extensora", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 8, "dica": "Segure 1s contraído"},
   {"exercicio": "Cadeira flexora", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 8, "dica": "Quadril colado"},
   {"exercicio": "Elevação pélvica (glute bridge)", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Aperte em cima"},
   {"exercicio": "Panturrilha em pé", "series": 3, "reps": "12-15", "descanso": "45-60s", "rpe": 7, "dica": "Pausa em cima"},
   {"exercicio": "Stiff com barra", "series": 3, "reps": "8-12", "descanso": "90s", "rpe": 8, "dica": "Coluna neutra"}
 ]}]'::jsonb),
(null, 'M', 'Peito e Braços', 'Hipertrofia', 'Intermediário',
 '[{"nome": "Treino provisório · peito e braços", "exercicios": [
   {"exercicio": "Supino inclinado com halteres", "series": 4, "reps": "8-12", "descanso": "90-120s", "rpe": 8, "dica": "Banco em 30 graus"},
   {"exercicio": "Crucifixo no crossover", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Alongue bem"},
   {"exercicio": "Rosca alternada com halteres", "series": 3, "reps": "8-12", "descanso": "60s", "rpe": 8, "dica": "Gire o punho"},
   {"exercicio": "Rosca martelo", "series": 3, "reps": "10-12", "descanso": "60s", "rpe": 7, "dica": "Pegada neutra"},
   {"exercicio": "Tríceps francês halter", "series": 3, "reps": "10-12", "descanso": "60s", "rpe": 7, "dica": "Cotovelo para cima"},
   {"exercicio": "Flexão de braço", "series": 3, "reps": "8-12", "descanso": "60s", "rpe": 7, "dica": "Corpo em prancha"}
 ]}]'::jsonb),
(null, 'F', 'Full Body Inicial', 'Condicionamento', 'Iniciante',
 '[{"nome": "Treino provisório · corpo inteiro", "exercicios": [
   {"exercicio": "Supino na máquina", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Ajuste o banco"},
   {"exercicio": "Puxada articulada", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Controle a volta"},
   {"exercicio": "Cadeira extensora", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Segure 1s"},
   {"exercicio": "Elevação pélvica (glute bridge)", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Aperte em cima"},
   {"exercicio": "Abdução de quadril", "series": 3, "reps": "12-15", "descanso": "60s", "rpe": 7, "dica": ""},
   {"exercicio": "Desenvolvimento na máquina", "series": 2, "reps": "10-12", "descanso": "60s", "rpe": 7, "dica": ""},
   {"exercicio": "Abdominal crunch", "series": 2, "reps": "12-15", "descanso": "45-60s", "rpe": 6, "dica": "Expire subindo"}
 ]}]'::jsonb),
(null, 'F', 'Glúteos e Pernas', 'Hipertrofia', 'Intermediário',
 '[{"nome": "Treino provisório · glúteos e pernas", "exercicios": [
   {"exercicio": "Agachamento livre", "series": 4, "reps": "8-12", "descanso": "90-120s", "rpe": 8, "dica": "Profundidade com controle"},
   {"exercicio": "Hip thrust com barra", "series": 4, "reps": "8-12", "descanso": "90s", "rpe": 8, "dica": "Aperte em cima"},
   {"exercicio": "Afundo com halteres", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Passos firmes"},
   {"exercicio": "Cadeira flexora", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 8, "dica": "Quadril colado"},
   {"exercicio": "Glúteo coice na máquina", "series": 3, "reps": "12-15", "descanso": "60s", "rpe": 7, "dica": ""},
   {"exercicio": "Panturrilha sentado", "series": 3, "reps": "12-15", "descanso": "45-60s", "rpe": 7, "dica": "Amplitude completa"}
 ]}]'::jsonb),
(null, 'F', 'Superiores', 'Hipertrofia', 'Iniciante',
 '[{"nome": "Treino provisório · superiores", "exercicios": [
   {"exercicio": "Supino inclinado com halteres", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Banco em 30 graus"},
   {"exercicio": "Remada na máquina", "series": 3, "reps": "10-12", "descanso": "60-90s", "rpe": 7, "dica": "Sem balanço"},
   {"exercicio": "Elevação lateral", "series": 3, "reps": "10-15", "descanso": "60s", "rpe": 7, "dica": "Cotovelo à frente"},
   {"exercicio": "Rosca na máquina", "series": 2, "reps": "10-12", "descanso": "60s", "rpe": 7, "dica": ""},
   {"exercicio": "Tríceps na polia (corda)", "series": 2, "reps": "10-12", "descanso": "60s", "rpe": 7, "dica": "Abra a corda"}
 ]}]'::jsonb),
(null, 'F', 'Core e Condicionamento', 'Condicionamento', 'Iniciante',
 '[{"nome": "Treino provisório · core e condicionamento", "exercicios": [
   {"exercicio": "Prancha", "series": 3, "reps": "30-45s", "descanso": "45-60s", "rpe": 7, "dica": "Linha reta"},
   {"exercicio": "Prancha lateral", "series": 2, "reps": "20-30s", "descanso": "45s", "rpe": 7, "dica": "Cada lado"},
   {"exercicio": "Abdominal crunch", "series": 3, "reps": "12-15", "descanso": "45-60s", "rpe": 6, "dica": "Expire subindo"},
   {"exercicio": "Elevação de pernas", "series": 3, "reps": "10-15", "descanso": "45-60s", "rpe": 7, "dica": "Sem impulso"},
   {"exercicio": "Flexão de braço", "series": 2, "reps": "6-10", "descanso": "60s", "rpe": 7, "dica": "Apoie os joelhos se precisar"},
   {"exercicio": "Agachamento livre", "series": 2, "reps": "10-12", "descanso": "60s", "rpe": 6, "dica": "Só o peso do corpo"}
 ]}]'::jsonb);
