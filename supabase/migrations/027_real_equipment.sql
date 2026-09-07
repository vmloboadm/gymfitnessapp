-- 027: Substitui equipamentos de exemplo pelos REAIS da academia (fotos 07/09/2026).
--
-- ESTRATÉGIA:
--   1. Deleta os 37 pending (exemplo, sem sessões/exercises/NFC)
--   2. Mantém os 8 available (já são os reais: Bike, Extensora, Esteira 1-2,
--      Halteres, Leg Press, Puxada, Supino — todos com NFC tags)
--   3. Adiciona 4 equipamentos reais que faltavam no banco
--   4. Total final: 12 equipamentos reais verificados
--
-- NOTA: Os nomes dos 8 available foram mantidos como estão (batem com o banco
-- de exercises vinculados). Os 4 novos seguem o mesmo padrão de nomenclatura.

-- ── 1. Deleta equipamentos pending (exemplo) ──────────────────────────
DELETE FROM public.equipment
WHERE gym_id = '00000000-0000-0000-0000-000000000001'
  AND status = 'pending';

-- ── 2. Adiciona equipamentos reais que faltavam ───────────────────────
-- Estes foram fotografados mas não existiam no banco:
--   - Mini trampolim (foto 14, área funcional)
--   - Remada máquina / T-bar row (foto 40, plate loaded)
--   - Multi press (foto 26, máquina multifuncional)
--   - Half rack / power rack (foto 27, marca THOLD)

INSERT INTO public.equipment (gym_id, name, category, capacity, status)
VALUES
  -- Mini trampolim (área funcional, foto 14)
  ('00000000-0000-0000-0000-000000000001', 'Mini trampolim', 'cardio', 1, 'available'),

  -- Remada cavalinho / T-bar row (foto 40, plate loaded)
  ('00000000-0000-0000-0000-000000000001', 'Remada cavalinho', 'costas', 1, 'available'),

  -- Multi press (foto 26, máquina multifuncional peito/ombro)
  ('00000000-0000-0000-0000-000000000001', 'Multi press', 'peito', 1, 'available'),

  -- Half rack / power rack (foto 27, marca THOLD)
  ('00000000-0000-0000-0000-000000000001', 'Half rack', 'perna', 2, 'available')

ON CONFLICT DO NOTHING;

-- ── 3. Verificação final ──────────────────────────────────────────────
SELECT status, count(*) as total
FROM public.equipment
WHERE gym_id = '00000000-0000-0000-0000-000000000001'
GROUP BY status
ORDER BY status;
