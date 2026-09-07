-- 018: Vincula exercícios globais aos aparelhos reais do gym piloto.
-- Só seta equipment_id quando o aparelho existe de verdade na academia.
-- Idempotente: nunca sobrescreve um vínculo já existente.

do $$
declare
  g uuid := '00000000-0000-0000-0000-000000000001';
  eq_barra uuid;
  eq_halteres uuid;
  eq_puxada uuid;
  eq_legpress uuid;
  eq_extensora uuid;
  eq_esteira uuid;
  eq_bike uuid;
begin
  select id into eq_barra     from public.equipment where gym_id = g and name = 'Supino reto com barra';
  select id into eq_halteres  from public.equipment where gym_id = g and name = 'Halteres (duplex)';
  select id into eq_puxada    from public.equipment where gym_id = g and name = 'Puxada frontal';
  select id into eq_legpress  from public.equipment where gym_id = g and name = 'Leg press 45°';
  select id into eq_extensora from public.equipment where gym_id = g and name = 'Cadeira extensora';
  select id into eq_esteira   from public.equipment where gym_id = g and name = 'Esteira 1';
  select id into eq_bike      from public.equipment where gym_id = g and name = 'Bicicleta ergométrica';

  -- Peito
  update public.exercises set equipment_id = eq_barra
    where gym_id is null and equipment_id is null and name = 'Supino reto com barra' and eq_barra is not null;
  update public.exercises set equipment_id = eq_halteres
    where gym_id is null and equipment_id is null and name in
      ('Supino reto com halteres', 'Supino inclinado com halteres', 'Crucifixo com halteres') and eq_halteres is not null;

  -- Costas
  update public.exercises set equipment_id = eq_puxada
    where gym_id is null and equipment_id is null and name in ('Puxada frontal (pulldown)', 'Barra fixa (puxada)') and eq_puxada is not null;
  update public.exercises set equipment_id = eq_halteres
    where gym_id is null and equipment_id is null and name = 'Remada serrote (1 halter)' and eq_halteres is not null;

  -- Ombro e braços (halteres)
  update public.exercises set equipment_id = eq_halteres
    where gym_id is null and equipment_id is null and name in
      ('Desenvolvimento com halteres', 'Elevação lateral', 'Elevação frontal', 'Crucifixo invertido',
       'Rosca alternada com halteres', 'Rosca martelo', 'Rosca concentrada', 'Tríceps francês halter',
       'Afundo com halteres') and eq_halteres is not null;

  -- Perna
  update public.exercises set equipment_id = eq_legpress
    where gym_id is null and equipment_id is null and name = 'Leg press 45°' and eq_legpress is not null;
  update public.exercises set equipment_id = eq_extensora
    where gym_id is null and equipment_id is null and name = 'Cadeira extensora' and eq_extensora is not null;

  -- Cardio
  update public.exercises set equipment_id = eq_esteira
    where gym_id is null and equipment_id is null and name = 'Esteira' and eq_esteira is not null;
  update public.exercises set equipment_id = eq_bike
    where gym_id is null and equipment_id is null and name = 'Bicicleta ergométrica' and eq_bike is not null;
end $$;

-- Relatório: quantos vinculados
select
  count(*) filter (where equipment_id is not null) as linked,
  count(*) as total
from public.exercises where gym_id is null;
