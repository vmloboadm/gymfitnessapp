-- 027b: Restaura equipamentos reais que foram deletados indevidamente.
-- Os 37 pending eram equipamentos REAIS da academia, só não tinham NFC/QR.
-- Agora ficam como 'available' (a checagem prévia confirmou 0 sessões/-exercises/NFC).

-- ── Restaura equipamentos reais que estavam como pending ───────────────
INSERT INTO public.equipment (gym_id, name, category, capacity, status)
VALUES
  -- Cardio
  ('00000000-0000-0000-0000-000000000001', 'Esteira 3', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Esteira 4', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Esteira 5', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Bike spinning 1', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Bike spinning 2', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Bike spinning 3', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Bike spinning 4', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Elíptico 1', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Elíptico 2', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Escada ergométrica', 'cardio', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Remo ergômetro', 'cardio', 1, 'available'),

  -- Pernas
  ('00000000-0000-0000-0000-000000000001', 'Hack squat', 'perna', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Smith machine', 'perna', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Cadeira flexora', 'perna', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Cadeira abdutora', 'perna', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Cadeira adutora', 'perna', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Agachamento hack', 'perna', 1, 'available'),

  -- Panturrilha
  ('00000000-0000-0000-0000-000000000001', 'Panturrilha em pé', 'panturrilha', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Panturrilha sentado', 'panturrilha', 1, 'available'),

  -- Glúteo
  ('00000000-0000-0000-0000-000000000001', 'Glúteo kickback', 'gluteo', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Elevação pélvica máquina', 'gluteo', 1, 'available'),

  -- Peito
  ('00000000-0000-0000-0000-000000000001', 'Crossover', 'peito', 2, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Peck deck', 'peito', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Supino inclinado', 'peito', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Supino declinado', 'peito', 1, 'available'),

  -- Costas
  ('00000000-0000-0000-0000-000000000001', 'Remada baixa', 'costas', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Puxada alta articulada', 'costas', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Barra fixa assistida', 'costas', 1, 'available'),

  -- Ombro
  ('00000000-0000-0000-0000-000000000001', 'Desenvolvimento articulado', 'ombro', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Elevação lateral máquina', 'ombro', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Crucifixo invertido máquina', 'ombro', 1, 'available'),

  -- Bíceps
  ('00000000-0000-0000-0000-000000000001', 'Rosca direta máquina', 'biceps', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Rosca concentrada banco', 'biceps', 1, 'available'),

  -- Tríceps
  ('00000000-0000-0000-0000-000000000001', 'Tríceps pulley', 'triceps', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Tríceps testa banco', 'triceps', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Mergulho paralelas', 'triceps', 1, 'available'),

  -- Core
  ('00000000-0000-0000-0000-000000000001', 'Abdominal máquina', 'core', 1, 'available'),
  ('00000000-0000-0000-0000-000000000001', 'Prancha solo área', 'core', 1, 'available'),

  -- Cardio (adicional)
  ('00000000-0000-0000-0000-000000000001', 'Kettlebell rack', 'perna', 1, 'available')

ON CONFLICT DO NOTHING;

-- ── Verificação final ──────────────────────────────────────────────────
SELECT status, count(*) as total
FROM public.equipment
WHERE gym_id = '00000000-0000-0000-0000-000000000001'
GROUP BY status
ORDER BY status;
