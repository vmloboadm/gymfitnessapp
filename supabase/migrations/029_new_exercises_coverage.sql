-- 029: Cria 19 exercícios globais para cobrir equipamentos reais sem cobertura.
-- Todos já nascem com equipment_id apontando para o equipamento do gym piloto.
-- Idempotente: só insere se não existir exercício global com o mesmo nome.

do $$
declare
  g uuid := '00000000-0000-0000-0000-000000000001';
  eq uuid;
begin
  -- 1. Crucifixo no crossover → Crossover
  select id into eq from public.equipment where gym_id = g and name = 'Crossover';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Crucifixo no crossover', 'peito', array['peito'], eq, array['Polias na altura dos ombros', 'Cruze as mãos à frente do peito']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Crucifixo no crossover');

  -- 2. Supino inclinado com barra → Supino inclinado
  select id into eq from public.equipment where gym_id = g and name = 'Supino inclinado';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Supino inclinado com barra', 'peito', array['peito','ombro'], eq, array['Banco a 30-45 graus', 'Desça a barra até o peito superior']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Supino inclinado com barra');

  -- 3. Supino declinado com barra → Supino declinado
  select id into eq from public.equipment where gym_id = g and name = 'Supino declinado';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Supino declinado com barra', 'peito', array['peito'], eq, array['Banco declinado', 'Foco na porção inferior do peito']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Supino declinado com barra');

  -- 4. Supino na máquina → Multi press
  select id into eq from public.equipment where gym_id = g and name = 'Multi press';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Supino na máquina', 'peito', array['peito','ombro','triceps'], eq, array['Ajuste o banco', 'Empurre até estender os braços']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Supino na máquina');

  -- 5. Crucifixo inverso na máquina → Crucifixo invertido máquina
  select id into eq from public.equipment where gym_id = g and name = 'Crucifixo invertido máquina';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Crucifixo inverso na máquina', 'ombro', array['ombro','costas'], eq, array['Peito apoiado', 'Abra os braços até a linha dos ombros']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Crucifixo inverso na máquina');

  -- 6. Desenvolvimento na máquina → Desenvolvimento articulado
  select id into eq from public.equipment where gym_id = g and name = 'Desenvolvimento articulado';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Desenvolvimento na máquina', 'ombro', array['ombro','triceps'], eq, array['Costas apoiadas', 'Empurre até o topo sem travar os cotovelos']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Desenvolvimento na máquina');

  -- 7. Elevação lateral na máquina → Elevação lateral máquina
  select id into eq from public.equipment where gym_id = g and name = 'Elevação lateral máquina';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Elevação lateral na máquina', 'ombro', array['ombro'], eq, array['Cotovelos levemente flexionados', 'Eleve até a linha dos ombros']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Elevação lateral na máquina');

  -- 8. Remada cavalinho → Remada cavalinho
  select id into eq from public.equipment where gym_id = g and name = 'Remada cavalinho';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Remada cavalinho', 'costas', array['costas','biceps'], eq, array['Peito apoiado no suporte', 'Puxe até o abdômen']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Remada cavalinho');

  -- 9. Puxada articulada → Puxada alta articulada
  select id into eq from public.equipment where gym_id = g and name = 'Puxada alta articulada';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Puxada articulada', 'costas', array['costas','biceps'], eq, array['Pegada pronada', 'Puxe até a linha do peito']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Puxada articulada');

  -- 10. Barra fixa assistida → Barra fixa assistida
  select id into eq from public.equipment where gym_id = g and name = 'Barra fixa assistida';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Barra fixa assistida', 'costas', array['costas','biceps'], eq, array['Ajuste o contrapeso', 'Suba até o queixo passar a barra']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Barra fixa assistida');

  -- 11. Rosca na máquina → Rosca direta máquina
  select id into eq from public.equipment where gym_id = g and name = 'Rosca direta máquina';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Rosca na máquina', 'biceps', array['biceps'], eq, array['Cotovelos fixos', 'Suba até a contração máxima']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Rosca na máquina');

  -- 12. Glúteo coice na máquina → Glúteo kickback
  select id into eq from public.equipment where gym_id = g and name = 'Glúteo kickback';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Glúteo coice na máquina', 'gluteo', array['gluteo'], eq, array['Tronco apoiado', 'Estenda a perna para trás contraindo o glúteo']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Glúteo coice na máquina');

  -- 13. Agachamento hack → Hack squat
  select id into eq from public.equipment where gym_id = g and name = 'Hack squat';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Agachamento hack', 'perna', array['perna','gluteo'], eq, array['Costas apoiadas na plataforma', 'Desça até 90 graus']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Agachamento hack');

  -- 14. Adução na máquina → Cadeira adutora
  select id into eq from public.equipment where gym_id = g and name = 'Cadeira adutora';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips)
  select null, 'Adução na máquina', 'perna', array['perna'], eq, array['Pernas abertas no início', 'Feche contraindo a parte interna da coxa']
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Adução na máquina');

  -- 15. Spinning → Bike spinning 1
  select id into eq from public.equipment where gym_id = g and name = 'Bike spinning 1';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips, high_impact)
  select null, 'Spinning', 'cardio', array['perna'], eq, array['Ajuste banco e guidão', 'Alterne ritmo e carga'], true
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Spinning');

  -- 16. Escada ergométrica → Escada ergométrica
  select id into eq from public.equipment where gym_id = g and name = 'Escada ergométrica';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips, high_impact)
  select null, 'Escada ergométrica', 'cardio', array['perna','gluteo'], eq, array['Postura ereta sem segurar com força', 'Alterne o ritmo'], true
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Escada ergométrica');

  -- 17. Jump no mini trampolim → Mini trampolim
  select id into eq from public.equipment where gym_id = g and name = 'Mini trampolim';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips, high_impact)
  select null, 'Jump no mini trampolim', 'cardio', array['perna','core'], eq, array['Joelhos semiflexionados', 'Aterrisse no centro da lona'], true
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Jump no mini trampolim');

  -- 18. Kettlebell swing → Kettlebell rack
  select id into eq from public.equipment where gym_id = g and name = 'Kettlebell rack';
  insert into public.exercises (gym_id, name, category, muscles, equipment_id, tips, high_impact)
  select null, 'Kettlebell swing', 'perna', array['perna','gluteo','core'], eq, array['Quadril para trás como dobradiça', 'Impulsione com o quadril, não com os braços'], true
  where eq is not null and not exists (select 1 from public.exercises where gym_id is null and name = 'Kettlebell swing');

  -- 19. Agachamento livre (vincula ao Half rack — onde se executa com segurança)
  select id into eq from public.equipment where gym_id = g and name = 'Half rack';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Agachamento livre' and eq is not null;
end $$;

-- ── Verificação ─────────────────────────────────────────────────────────
select 'com_equip' as tipo, count(*) from public.exercises where gym_id is null and equipment_id is not null
union all
select 'sem_equip', count(*) from public.exercises where gym_id is null and equipment_id is null;
