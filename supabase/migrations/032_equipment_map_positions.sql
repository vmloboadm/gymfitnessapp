-- 032: Posições aproximadas dos equipamentos no mapa do salão (Ticket 12).
-- Grade 0-100 (x = esquerda→direita, y = entrada→fundo), baseada nas 44 fotos:
--   - Cardio à direita (esteiras, bikes, elípticos)
--   - Máquinas no centro (pernas, peito, costas)
--   - Pesos livres/funcional no fundo (halteres, supinos, rack)
-- Idempotente: só preenche onde map_position IS NULL.

do $$
declare
  g uuid := '00000000-0000-0000-0000-000000000001';
begin
  -- ── CARDIO (lado direito) ──
  update public.equipment set map_position = '{"x":78,"y":12}' where gym_id = g and name = 'Esteira 1' and map_position is null;
  update public.equipment set map_position = '{"x":82,"y":12}' where gym_id = g and name = 'Esteira 2' and map_position is null;
  update public.equipment set map_position = '{"x":86,"y":12}' where gym_id = g and name = 'Esteira 3' and map_position is null;
  update public.equipment set map_position = '{"x":90,"y":12}' where gym_id = g and name = 'Esteira 4' and map_position is null;
  update public.equipment set map_position = '{"x":94,"y":12}' where gym_id = g and name = 'Esteira 5' and map_position is null;
  update public.equipment set map_position = '{"x":78,"y":25}' where gym_id = g and name = 'Bike spinning 1' and map_position is null;
  update public.equipment set map_position = '{"x":83,"y":25}' where gym_id = g and name = 'Bike spinning 2' and map_position is null;
  update public.equipment set map_position = '{"x":88,"y":25}' where gym_id = g and name = 'Bike spinning 3' and map_position is null;
  update public.equipment set map_position = '{"x":93,"y":25}' where gym_id = g and name = 'Bike spinning 4' and map_position is null;
  update public.equipment set map_position = '{"x":80,"y":33}' where gym_id = g and name = 'Elíptico 1' and map_position is null;
  update public.equipment set map_position = '{"x":88,"y":33}' where gym_id = g and name = 'Elíptico 2' and map_position is null;
  update public.equipment set map_position = '{"x":76,"y":40}' where gym_id = g and name = 'Escada ergométrica' and map_position is null;
  update public.equipment set map_position = '{"x":84,"y":40}' where gym_id = g and name = 'Remo ergômetro' and map_position is null;
  update public.equipment set map_position = '{"x":92,"y":40}' where gym_id = g and name = 'Bicicleta ergométrica' and map_position is null;

  -- ── PERNAS (centro) ──
  update public.equipment set map_position = '{"x":45,"y":30}' where gym_id = g and name = 'Leg press 45°' and map_position is null;
  update public.equipment set map_position = '{"x":55,"y":30}' where gym_id = g and name = 'Hack squat' and map_position is null;
  update public.equipment set map_position = '{"x":62,"y":32}' where gym_id = g and name = 'Agachamento hack' and map_position is null;
  update public.equipment set map_position = '{"x":40,"y":42}' where gym_id = g and name = 'Smith machine' and map_position is null;
  update public.equipment set map_position = '{"x":50,"y":42}' where gym_id = g and name = 'Cadeira extensora' and map_position is null;
  update public.equipment set map_position = '{"x":58,"y":42}' where gym_id = g and name = 'Cadeira flexora' and map_position is null;
  update public.equipment set map_position = '{"x":44,"y":52}' where gym_id = g and name = 'Cadeira abdutora' and map_position is null;
  update public.equipment set map_position = '{"x":52,"y":52}' where gym_id = g and name = 'Cadeira adutora' and map_position is null;
  update public.equipment set map_position = '{"x":60,"y":52}' where gym_id = g and name = 'Panturrilha em pé' and map_position is null;
  update public.equipment set map_position = '{"x":66,"y":52}' where gym_id = g and name = 'Panturrilha sentado' and map_position is null;

  -- ── GLÚTEO ──
  update public.equipment set map_position = '{"x":46,"y":60}' where gym_id = g and name = 'Glúteo kickback' and map_position is null;
  update public.equipment set map_position = '{"x":54,"y":60}' where gym_id = g and name = 'Elevação pélvica máquina' and map_position is null;

  -- ── PEITO ──
  update public.equipment set map_position = '{"x":38,"y":30}' where gym_id = g and name = 'Crossover' and map_position is null;
  update public.equipment set map_position = '{"x":64,"y":44}' where gym_id = g and name = 'Peck deck' and map_position is null;
  update public.equipment set map_position = '{"x":70,"y":44}' where gym_id = g and name = 'Multi press' and map_position is null;
  update public.equipment set map_position = '{"x":20,"y":70}' where gym_id = g and name = 'Supino reto com barra' and map_position is null;
  update public.equipment set map_position = '{"x":28,"y":70}' where gym_id = g and name = 'Supino inclinado' and map_position is null;
  update public.equipment set map_position = '{"x":36,"y":70}' where gym_id = g and name = 'Supino declinado' and map_position is null;
  update public.equipment set map_position = '{"x":14,"y":62}' where gym_id = g and name = 'Halteres (duplex)' and map_position is null;

  -- ── COSTAS ──
  update public.equipment set map_position = '{"x":38,"y":44}' where gym_id = g and name = 'Puxada frontal' and map_position is null;
  update public.equipment set map_position = '{"x":44,"y":44}' where gym_id = g and name = 'Puxada alta articulada' and map_position is null;
  update public.equipment set map_position = '{"x":50,"y":60}' where gym_id = g and name = 'Remada baixa' and map_position is null;
  update public.equipment set map_position = '{"x":58,"y":60}' where gym_id = g and name = 'Remada cavalinho' and map_position is null;
  update public.equipment set map_position = '{"x":64,"y":60}' where gym_id = g and name = 'Barra fixa assistida' and map_position is null;

  -- ── OMBRO ──
  update public.equipment set map_position = '{"x":62,"y":44}' where gym_id = g and name = 'Desenvolvimento articulado' and map_position is null;
  update public.equipment set map_position = '{"x":68,"y":36}' where gym_id = g and name = 'Elevação lateral máquina' and map_position is null;
  update public.equipment set map_position = '{"x":72,"y":36}' where gym_id = g and name = 'Crucifixo invertido máquina' and map_position is null;

  -- ── BRAÇOS ──
  update public.equipment set map_position = '{"x":36,"y":60}' where gym_id = g and name = 'Tríceps pulley' and map_position is null;
  update public.equipment set map_position = '{"x":30,"y":60}' where gym_id = g and name = 'Tríceps testa banco' and map_position is null;
  update public.equipment set map_position = '{"x":24,"y":60}' where gym_id = g and name = 'Mergulho paralelas' and map_position is null;
  update public.equipment set map_position = '{"x":18,"y":78}' where gym_id = g and name = 'Rosca concentrada banco' and map_position is null;
  update public.equipment set map_position = '{"x":24,"y":78}' where gym_id = g and name = 'Rosca direta máquina' and map_position is null;

  -- ── CORE / FUNCIONAL (fundo) ──
  update public.equipment set map_position = '{"x":10,"y":85}' where gym_id = g and name = 'Abdominal máquina' and map_position is null;
  update public.equipment set map_position = '{"x":20,"y":88}' where gym_id = g and name = 'Prancha solo área' and map_position is null;
  update public.equipment set map_position = '{"x":30,"y":88}' where gym_id = g and name = 'Mini trampolim' and map_position is null;
  update public.equipment set map_position = '{"x":10,"y":72}' where gym_id = g and name = 'Kettlebell rack' and map_position is null;
  update public.equipment set map_position = '{"x":28,"y":80}' where gym_id = g and name = 'Half rack' and map_position is null;
end $$;

select count(*) filter (where map_position is not null) as com_posicao, count(*) as total
from public.equipment where gym_id = '00000000-0000-0000-0000-000000000001';
