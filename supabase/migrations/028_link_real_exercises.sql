-- 028: Vincula exercícios globais (gym_id IS NULL) aos equipamentos reais.
-- Idempotente: nunca sobrescreve um vínculo já existente (só WHERE equipment_id IS NULL).
-- Os 12 exercícios restantes são peso corporal / barra livre — ficam sem vínculo (correto).

do $$
declare
  g uuid := '00000000-0000-0000-0000-000000000001';
  eq uuid;
begin
  -- Rosca scott → Rosca concentrada banco
  select id into eq from public.equipment where gym_id = g and name = 'Rosca concentrada banco';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Rosca scott' and eq is not null;

  -- Elíptico → Elíptico 1
  select id into eq from public.equipment where gym_id = g and name = 'Elíptico 1';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Elíptico' and eq is not null;

  -- Remo ergômetro → Remo ergômetro
  select id into eq from public.equipment where gym_id = g and name = 'Remo ergômetro';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Remo ergômetro' and eq is not null;

  -- Elevação de pernas → Abdominal máquina
  select id into eq from public.equipment where gym_id = g and name = 'Abdominal máquina';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Elevação de pernas' and eq is not null;

  -- Prancha → Prancha solo área
  select id into eq from public.equipment where gym_id = g and name = 'Prancha solo área';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Prancha' and eq is not null;

  -- Remada na máquina → Remada baixa
  select id into eq from public.equipment where gym_id = g and name = 'Remada baixa';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Remada na máquina' and eq is not null;

  -- Abdução de quadril → Cadeira abdutora
  select id into eq from public.equipment where gym_id = g and name = 'Cadeira abdutora';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Abdução de quadril' and eq is not null;

  -- Elevação pélvica (glute bridge) → Elevação pélvica máquina
  select id into eq from public.equipment where gym_id = g and name = 'Elevação pélvica máquina';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Elevação pélvica (glute bridge)' and eq is not null;

  -- Panturrilha em pé → Panturrilha em pé
  select id into eq from public.equipment where gym_id = g and name = 'Panturrilha em pé';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Panturrilha em pé' and eq is not null;

  -- Panturrilha sentado → Panturrilha sentado
  select id into eq from public.equipment where gym_id = g and name = 'Panturrilha sentado';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Panturrilha sentado' and eq is not null;

  -- Voador (peck deck) → Peck deck
  select id into eq from public.equipment where gym_id = g and name = 'Peck deck';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Voador (peck deck)' and eq is not null;

  -- Agachamento na máquina smith → Smith machine
  select id into eq from public.equipment where gym_id = g and name = 'Smith machine';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Agachamento na máquina smith' and eq is not null;

  -- Cadeira flexora → Cadeira flexora
  select id into eq from public.equipment where gym_id = g and name = 'Cadeira flexora';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Cadeira flexora' and eq is not null;

  -- Mergulho no banco → Mergulho paralelas
  select id into eq from public.equipment where gym_id = g and name = 'Mergulho paralelas';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Mergulho no banco' and eq is not null;

  -- Tríceps na polia (corda) → Tríceps pulley
  select id into eq from public.equipment where gym_id = g and name = 'Tríceps pulley';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Tríceps na polia (corda)' and eq is not null;

  -- Tríceps testa → Tríceps testa banco
  select id into eq from public.equipment where gym_id = g and name = 'Tríceps testa banco';
  update public.exercises set equipment_id = eq
    where gym_id is null and equipment_id is null and name = 'Tríceps testa' and eq is not null;
end $$;

-- ── Verificação ─────────────────────────────────────────────────────────
select 'com_equip' as tipo, count(*) from public.exercises where gym_id is null and equipment_id is not null
union all
select 'sem_equip', count(*) from public.exercises where gym_id is null and equipment_id is null;
