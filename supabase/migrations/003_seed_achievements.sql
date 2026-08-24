-- =====================================================================
-- 003_seed_achievements.sql — Conquistas base (global)
-- =====================================================================

insert into public.achievements (gym_id, code, name, description, points) values
(null, 'first_checkin',    'Primeiro check-in',    'Registrou a chegada na academia pela primeira vez', 10),
(null, 'first_workout',    'Primeiro treino',      'Completou o primeiro treino completo',              50),
(null, 'streak_3',         'Raio de 3 dias',       'Treinou 3 dias consecutivos',                       30),
(null, 'streak_7',         'Semana de fogo',       'Treinou 7 dias consecutivos',                       100),
(null, 'streak_30',        'Mês consecutivo',      'Treinou 30 dias em sequência',                      400),
(null, 'volume_10k',       'Pesos pesados',        'Acumulou 10.000 kg de volume em uma semana',        60),
(null, 'pr_new_record',    'Novo recorde',         'Bateu um recorde pessoal em algum exercício',       25),
(null, 'workout_10',       'Dez treinos',          'Completou 10 treinos no total',                     80),
(null, 'workout_50',       'Cinco décimos',        'Completou 50 treinos no total',                     250),
(null, 'day_pass_used',    'Conheceu a academia',  'Usou uma day-pass e voltou para se matricular',     20),
(null, 'plato_buster',     'Quebrador de platô',   'Saiu de um platô identificado pela IA',             35),
(null, 'squad_winner',     'Campeão do squad',     'Venceu um desafio de squad',                        120);