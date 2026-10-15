-- 048_more_exercises.sql
-- Amplia a biblioteca global com os movimentos que mais faltavam,
-- com ênfase no treino feminino (glúteos/pernas) e nos clássicos de
-- academia do interior. Nomes exatos PT-BR, com apelidos de ficha.

insert into public.exercises (gym_id, name, category, muscles, tips, aliases) values
  (null, 'Agachamento sumô com halter', 'perna', array['quadríceps', 'glúteos', 'adutores'], array['Pés bem abertos, joelhos acompanhando a ponta do pé'], array['Agachamento Sumô', 'Sumô']),
  (null, 'Levantamento terra sumô', 'perna', array['posterior', 'glúteos', 'lombar'], array['Coluna neutra do início ao fim'], array['Terra Sumô']),
  (null, 'Afundo búlgaro', 'perna', array['quadríceps', 'glúteos'], array['Pé de trás no banco, tronco levemente à frente'], array['Búlgaro']),
  (null, 'Passada com halteres', 'perna', array['quadríceps', 'glúteos'], array['Passos firmes sem bater o joelho no chão'], array['Passada', 'Avanço']),
  (null, 'Glúteo na polia', 'gluteo', array['glúteos'], array['Tronco parado, estenda o quadril até trás'], array['Coice na polia']),
  (null, 'Elevação pélvica unilateral', 'gluteo', array['glúteos'], array['Uma perna de cada vez, sem rodar o quadril'], array['Ponte unilateral']),
  (null, 'Agachamento frontal com barra', 'perna', array['quadríceps'], array['Cotovelos altos o tempo todo'], array['Agachamento Frontal']),
  (null, 'Panturrilha no leg press', 'panturrilha', array['panturrilha'], array['Só a ponta do pé na plataforma'], array['Panturrilha Leg Press']),
  (null, 'Puxada supinada', 'costas', array['dorsal', 'bíceps'], array['Pegada invertida, cotovelos junto ao corpo'], array['Puxada Supinada', 'Pulldown supinado']),
  (null, 'Desenvolvimento Arnold', 'ombro', array['deltoides'], array['Gire os halteres subindo até em cima'], array['Arnold']),
  (null, 'Rosca inversa com barra', 'biceps', array['antebraço', 'bíceps'], array['Pegada pronada, sem balanço'], array['Rosca Inversa']),
  (null, 'Rosca 21', 'biceps', array['bíceps'], array['7 embaixo, 7 em cima, 7 completas'], array['Rosca 21']),
  (null, 'Abdominal infra', 'core', array['abdômen'], array['Suba as pernas sem impulso'], array['Infra']),
  (null, 'Abdominal oblíquo', 'core', array['oblíquos'], array['Gire o tronco de um lado por vez'], array['Oblíquo']),
  (null, 'Russian twist', 'core', array['oblíquos'], array['Pés fora do chão para avançar'], array['Russian']),
  (null, 'Mountain climber', 'core', array['abdômen'], array['Quadril baixo, joelho ao peito'], array['Escalador']),
  (null, 'Abdominal na polia', 'core', array['abdômen'], array['Enrole a coluna descendo'], array['Crunch na polia'])
on conflict do nothing;
