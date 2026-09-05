-- 015: realtime completo — todas as tabelas com CRUD visível ao usuário.
-- + revoke anon em workout_sessions (segurança).

-- Tabelas adicionadas à publicação supabase_realtime:
ALTER PUBLICATION supabase_realtime ADD TABLE student_workouts;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard_adjustments;
ALTER PUBLICATION supabase_realtime ADD TABLE medical_clearances;
ALTER PUBLICATION supabase_realtime ADD TABLE squad_messages;
-- profiles já estava na publicação

-- Segurança: workout_sessions não deve ser editável por anônimos
REVOKE DELETE, INSERT, UPDATE ON workout_sessions FROM anon;
