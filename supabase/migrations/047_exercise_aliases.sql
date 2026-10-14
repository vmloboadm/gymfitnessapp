-- 047_exercise_aliases.sql
-- Apelidos de busca: a personal pensa nos nomes da ficha ("Puxada Alta",
-- "Supino Reto") e o banco tem outros ("Puxada frontal (pulldown)").
-- Aliases entram na BUSCA do picker/biblioteca; a IA continua recebendo
-- só nomes exatos. Curadoria manual (match automático errava).
-- Também semeia 2 movimentos que faltavam de verdade.

alter table public.exercises
  add column if not exists aliases text[] not null default '{}';

-- mesma academia pode apelidar os globais? não: aliases valem global.
-- (linhas da academia usam a coluna do mesmo jeito)

insert into public.exercises (gym_id, name, category, muscles, tips) values
  (null, 'Encolhimento com halteres', 'ombro', array['trapézio'], array['Suba os ombros sem dobrar o cotovelo']),
  (null, 'Hiperextensão lombar', 'costas', array['lombar'], array['Desça controlado até a linha do quadril'])
on conflict do nothing;

-- apelidos curados (nome da ficha -> nome exato)
update public.exercises set aliases = array['Supino Reto', 'Supino com Halteres'] where gym_id is null and name = 'Supino reto com barra';
update public.exercises set aliases = array['Supino Inclinado'] where gym_id is null and name = 'Supino inclinado com barra';
update public.exercises set aliases = array['Supino Declinado'] where gym_id is null and name = 'Supino declinado com barra';
update public.exercises set aliases = array['Puxada Alta', 'Puxada Alta Aberta', 'Puxada Alta Fechada', 'Puxada com Triângulo', 'Pulldown', 'Pulldown Supinado'] where gym_id is null and name = 'Puxada frontal (pulldown)';
update public.exercises set aliases = array['Barra Fixa', 'Barra Fixa Pronada', 'Barra Fixa Supinada'] where gym_id is null and name = 'Barra fixa (puxada)';
update public.exercises set aliases = array['Remada Curvada'] where gym_id is null and name = 'Remada curvada com barra';
update public.exercises set aliases = array['Remada Baixa (Cabo)', 'Remada na Polia Baixa', 'Remada Unilateral'] where gym_id is null and name = 'Remada cavalinho';
update public.exercises set aliases = array['Rosca Direta'] where gym_id is null and name = 'Rosca direta com barra';
update public.exercises set aliases = array['Rosca Alternada'] where gym_id is null and name = 'Rosca alternada com halteres';
update public.exercises set aliases = array['Tríceps Corda', 'Tríceps Pulley'] where gym_id is null and name = 'Tríceps na polia (corda)';
update public.exercises set aliases = array['Tríceps Francês'] where gym_id is null and name = 'Tríceps francês halter';
update public.exercises set aliases = array['Leg Press Pés Altos', 'Leg Press Unilateral'] where gym_id is null and name = 'Leg press 45°';
update public.exercises set aliases = array['Mesa Flexora'] where gym_id is null and name = 'Cadeira flexora';
update public.exercises set aliases = array['Stiff', 'Bom Dia'] where gym_id is null and name = 'Stiff com barra';
update public.exercises set aliases = array['Elevação Pélvica'] where gym_id is null and name = 'Elevação pélvica (glute bridge)';
update public.exercises set aliases = array['Hip Thrust'] where gym_id is null and name = 'Hip thrust com barra';
update public.exercises set aliases = array['Afundo', 'Passada'] where gym_id is null and name = 'Afundo com halteres';
update public.exercises set aliases = array['Prancha Isométrica'] where gym_id is null and name = 'Prancha';
update public.exercises set aliases = array['Elevação de Perna (Infra)'] where gym_id is null and name = 'Elevação de pernas';
update public.exercises set aliases = array['Desenvolvimento Arnold'] where gym_id is null and name = 'Desenvolvimento com halteres';
update public.exercises set aliases = array['Elevação Lateral na Polia'] where gym_id is null and name = 'Elevação lateral';
update public.exercises set aliases = array['Kickback'] where gym_id is null and name = 'Glúteo coice na máquina';
update public.exercises set aliases = array['Remador'] where gym_id is null and name = 'Remo ergômetro';
update public.exercises set aliases = array['Cadeira Abdutora', 'Quadril (Borboleta)'] where gym_id is null and name = 'Abdução de quadril';
update public.exercises set aliases = array['Sprint na Esteira'] where gym_id is null and name = 'Esteira';
