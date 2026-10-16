-- 050_exercise_curation.sql
-- Curadoria da nomenclatura: nomes em PT-BR de academia.
-- Estrangeiro só quando MUITO consagrado, entre parênteses.
-- Cada renomeação guarda o nome antigo nos aliases (a busca continua achando).

-- Renomeações (old exato -> novo PT-BR). Sem renomes encadeados.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- peito
      ('Close Grip Barbell Supino Reto', 'Supino Reto Pegada Fechada com Barra'),
      ('Decline Dumbbell Supino Reto', 'Supino Declinado com Halteres'),
      ('Wide Grip Decline Supino Reto', 'Supino Declinado Pegada Aberta'),
      ('Wide Grip Supino Reto', 'Supino Reto Pegada Aberta'),
      ('Hammer Grip Incline Supino Reto', 'Supino Inclinado Pegada Neutra com Halteres'),
      ('Smith Máquina Incline Supino Reto', 'Supino Inclinado na Máquina Smith'),
      ('Dumbbell Incline Supino Reto', 'Supino Inclinado com Halteres'),
      ('Decline Crucifixo com Halteres', 'Crucifixo Declinado com Halteres'),
      ('Incline Crucifixo com Halteres', 'Crucifixo Inclinado com Halteres'),
      ('One Arm Supino Reto', 'Supino Reto Unilateral com Halter'),
      ('Pullover Declinado Pegada Aberta', 'Pullover Declinado com Pegada Aberta'),
      ('Crucifixo no crossover', 'Crucifixo no Crossover (Polia Alta)'),
      -- costas
      ('Puxada articulada', 'Puxada Articulada na Máquina'),
      ('Shrugg', 'Encolhimento de Ombros (Shrug)'),
      ('Superman (Costas)', 'Superman'),
      ('Pullover Braços Estendidos com Halteres', 'Pullover Costas com Braços Estendidos'),
      ('Pullover Cotovelos Flexionados com Halteres', 'Pullover Costas com Cotovelos Flexionados'),
      ('Pullover na Bola com Carga', 'Pullover na Bola'),
      -- ombro
      ('Remada Alta no Smith', 'Remada Alta na Máquina Smith'),
      ('Remada Posterior no Smith', 'Remada Posterior na Máquina Smith'),
      ('Smith Máquina Encolhimento de Ombros', 'Encolhimento de Ombros na Máquina Smith'),
      -- bíceps
      ('Close Grip Rosca Direta com Barra W', 'Rosca Direta Pegada Fechada com Barra W'),
      ('Close Grip Standing Rosca Direta com Barra', 'Rosca Direta em Pé Pegada Fechada com Barra'),
      ('Incline Inner Rosca Direta com Halteres', 'Rosca Direta Inclinada Pegada Fechada com Halteres'),
      ('Standing Inner Rosca Direta com Halteres', 'Rosca Direta em Pé Pegada Fechada com Halteres'),
      ('Lying Supine Rosca Direta com Halteres', 'Rosca Direta Deitado com Halteres'),
      ('Prone Incline Rosca Direta com Halteres', 'Rosca Direta Deitado no Banco Inclinado com Halteres'),
      ('Farmer Walk', 'Caminhada do Fazendeiro (Farmer Walk)'),
      -- tríceps
      ('Close Triceps Pushup', 'Flexão Fechada para Tríceps'),
      ('Reverse Triceps Supino Reto com Barbell', 'Supino Reto Pegada Invertida'),
      ('Seated Tríceps Extensão Unilateral com Halter', 'Tríceps Extensão Unilateral Sentado com Halter'),
      ('Smith Máquina Close Grip Supino Reto', 'Supino Fechado na Máquina Smith'),
      ('Tríceps Kickback com Halter', 'Tríceps Coice com Halter (Kickback)'),
      ('Tríceps Pushdown Inclinado', 'Tríceps na Polia Inclinado'),
      -- perna
      ('Agachamento Hack na Máquina', 'Agachamento Hack na Máquina (Hack Squat)'),
      ('Agachamento Hack no Smith', 'Agachamento Hack na Máquina Smith'),
      ('Agachamento Hack com Barra', 'Agachamento Hack com Barra (Hack Squat)'),
      ('Agachamento Hack Pegada Fechada', 'Agachamento Hack Pegada Fechada (Hack Squat)'),
      ('Agachamento na máquina smith', 'Agachamento na Máquina Smith'),
      ('Agachamento Sissy com Anilha', 'Agachamento Sissy'),
      ('Flutter Kicks', 'Tesourinho no Solo'),
      ('Jefferson Squats com Barbell', 'Agachamento Jefferson'),
      ('Kettlebell swing', 'Swing com Kettlebell'),
      ('Step Up com Barra', 'Subida no Banco com Barra (Step Up)'),
      ('Step Up com Halteres', 'Subida no Banco com Halteres (Step Up)'),
      -- glúteo
      ('Hip thrust com barra', 'Elevação Pélvica com Barra (Hip Thrust)'),
      ('Elevação pélvica (glute bridge)', 'Elevação Pélvica'),
      ('Kickback', 'Glúteo Coice na Polia (Kickback)'),
      -- core / cardio / panturrilha
      ('Ab Rollout com Barra', 'Abdominal com Roda (Ab Wheel)'),
      ('Ab Rollout de Joelhos com Barra', 'Abdominal com Roda de Joelhos (Ab Wheel)'),
      ('Elevação de Quadril com Joelhos Dobrados', 'Elevação de Quadril com Joelhos Flexionados'),
      ('Box Jump', 'Salto na Caixa (Box Jump)'),
      ('Jump no mini trampolim', 'Salto no Mini Trampolim'),
      ('Panturrilha Reversa no Smith', 'Panturrilha Reversa na Máquina Smith')
    ) as t(old_name, new_name)
  loop
    update public.exercises
      set name = r.new_name,
          aliases = (select array_agg(distinct x) from unnest(aliases || array[r.old_name]) x)
      where gym_id is null and name = r.old_name;
  end loop;
end $$;

-- Junk / duplicatas sem uso: apaga só o que NÃO está referenciado.
delete from public.exercises e
where e.gym_id is null
  and e.name in (
    'One Arm Bicep Concentration na Stability Ball com Dumbbell',
    'JM Press (Tríceps)',
    'Press Tate (Tríceps)',
    'Press Tate com Dumbbell',
    'Iron Cross com Dumbbells',
    'Elevação Frontal com Pullover',
    'Dumbbell Pullover com Cotovelos Flexionados',
    'Pullover Braços Estendidos',
    'Hip Thrust',
    'Agachamento hack',
    'Agachamento no Smith',
    'Swing de Kettlebell'
  )
  and not exists (select 1 from public.workout_exercises we where we.exercise_id = e.id)
  and not exists (select 1 from public.workout_logs wl where wl.exercise_id = e.id);
