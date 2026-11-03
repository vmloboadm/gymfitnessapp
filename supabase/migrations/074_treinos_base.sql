-- 074_treinos_base.sql
-- Ninguém espera o personal para começar: 10 treinos base prontos (5
-- masculinos, 5 femininos), nas divisões mais usadas nas academias do RJ
-- (AB, ABC, ABCD, ABCDE). O aluno escolhe e vira a ficha dele na hora; o
-- personal é avisado e pode oferecer ajuste/acompanhamento.
-- Pedidos ao personal (ajuste, treino feito por ele, acompanhamento) agora
-- avisam a equipe no sininho + push.

alter table public.starter_templates
  add column if not exists is_base boolean not null default false,
  add column if not exists audience text check (audience in ('M', 'F')),
  add column if not exists split text,
  add column if not exists days_per_week integer,
  add column if not exists description text,
  add column if not exists sort integer not null default 0;

-- ---------------------------------------------------------------------------
-- Catálogo dos treinos base. Exercícios pelo nome exato da biblioteca global.
-- Cada exercício: [nome, séries, reps, descanso em segundos, dica]
create or replace function public.base_programs_catalog()
returns jsonb
language sql
immutable
as $catalog$
select $json$[
 {"key":"m-ini-ab","audience":"M","level":"Iniciante","split":"AB","dpw":3,"sort":1,
  "label":"Iniciante · AB","objective":"Adaptação",
  "description":"Para quem está começando: superiores num dia, pernas e abdômen no outro. Alterne A e B, 3x por semana.",
  "days":[
   {"nome":"A · Superiores","foco":"Peito, costas, ombros e braços","exs":[
    ["Supino na máquina",3,"12",60,"Desça controlando até a linha do peito"],
    ["Puxada frontal (pulldown)",3,"12",60,"Puxe até o queixo, peito aberto"],
    ["Desenvolvimento na máquina",3,"12",60,"Não trave os cotovelos em cima"],
    ["Remada na máquina",3,"12",60,"Junte as escápulas no final"],
    ["Rosca direta com barra",3,"12",60,"Cotovelo parado ao lado do corpo"],
    ["Tríceps Pulley",3,"12",60,"Só o antebraço se move"]]},
   {"nome":"B · Pernas e abdômen","foco":"Quadríceps, posterior, panturrilha e core","exs":[
    ["Leg press 45°",3,"12",90,"Não estenda totalmente o joelho"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Cadeira flexora",3,"12",60,"Quadril colado no banco"],
    ["Panturrilha em Pé na Máquina",3,"15",45,"Amplitude total"],
    ["Abdominal crunch",3,"15",45,"Solte o ar ao subir"],
    ["Prancha",3,"30s",45,"Abdômen e glúteo contraídos"]]}]},

 {"key":"m-ini-abc","audience":"M","level":"Iniciante","split":"ABC","dpw":3,"sort":2,
  "label":"Iniciante · ABC","objective":"Hipertrofia",
  "description":"O clássico: peito e tríceps, costas e bíceps, pernas e ombros. 3x por semana.",
  "days":[
   {"nome":"A · Peito e tríceps","foco":"Peito, tríceps e abdômen","exs":[
    ["Supino reto com barra",3,"10-12",90,"Pés firmes no chão, escápulas juntas"],
    ["Supino inclinado com halteres",3,"12",60,"Banco a 30-45°"],
    ["Voador (peck deck)",3,"12",60,"Abraço controlado, sem bater as mãos"],
    ["Tríceps Pulley",3,"12",60,"Cotovelos colados no corpo"],
    ["Tríceps francês halter",3,"12",60,"Cotovelos apontando para cima"],
    ["Crunch no Solo",3,"15",45,"Movimento curto e controlado"]]},
   {"nome":"B · Costas e bíceps","foco":"Costas, bíceps e abdômen","exs":[
    ["Puxada frontal (pulldown)",3,"12",60,"Puxe com as costas, não com os braços"],
    ["Remada Baixa (Cabo)",3,"12",60,"Tronco parado, puxe até o umbigo"],
    ["Remada serrote (1 halter)",3,"12",60,"Cotovelo rente ao corpo"],
    ["Rosca direta com barra",3,"12",60,"Sem balançar o tronco"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"],
    ["Abdominal infra",3,"15",45,"Desça as pernas devagar"]]},
   {"nome":"C · Pernas e ombros","foco":"Pernas completas e ombros","exs":[
    ["Leg press 45°",3,"12",90,"Pés na largura do quadril"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Desenvolvimento com halteres",3,"12",60,"Não arqueie a lombar"],
    ["Elevação lateral",3,"12",45,"Até a linha do ombro"],
    ["Panturrilha em pé",3,"15",45,"Pausa embaixo e em cima"]]}]},

 {"key":"m-int-abc","audience":"M","level":"Intermediário","split":"ABC","dpw":3,"sort":3,
  "label":"Intermediário · ABC","objective":"Hipertrofia",
  "description":"ABC com mais volume e trapézio. Faça 3x por semana ou repita a sequência (ABC ABC) para 6x.",
  "days":[
   {"nome":"A · Peito e tríceps","foco":"Peito, tríceps e abdômen","exs":[
    ["Supino reto com barra",4,"8-10",90,"Carga progressiva a cada série"],
    ["Supino inclinado com halteres",4,"10",90,"Banco a 30-45°"],
    ["Crucifixo no Crossover (Polia Alta)",3,"12",60,"Cruze as mãos no final"],
    ["Fundos (Paralelas)",3,"10",90,"Tronco levemente inclinado à frente"],
    ["Tríceps testa",3,"10",60,"Cotovelos fixos"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Abdominal na polia",3,"15",45,"Enrole a coluna"]]},
   {"nome":"B · Costas, bíceps e trapézio","foco":"Costas, bíceps e trapézio","exs":[
    ["Barra fixa assistida",4,"8-10",90,"Peito em direção à barra"],
    ["Remada curvada com barra",4,"10",90,"Coluna neutra, tronco a 45°"],
    ["Puxada com Triângulo",3,"12",60,"Puxe até o peito"],
    ["Remada serrote (1 halter)",3,"10",60,"Cotovelo rente ao corpo"],
    ["Encolhimento com halteres",3,"12",45,"Segure 1s em cima"],
    ["Rosca direta com barra",3,"10",60,"Sem balançar"],
    ["Rosca martelo",3,"12",60,"Alternado ou simultâneo"]]},
   {"nome":"C · Pernas e ombros","foco":"Pernas completas e ombros","exs":[
    ["Agachamento livre",4,"8-10",120,"Desça até a coxa paralela, joelho alinhado ao pé"],
    ["Leg press 45°",4,"12",90,"Amplitude completa"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Stiff com barra",3,"10",90,"Barra rente às pernas, coluna neutra"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Desenvolvimento militar",3,"10",90,"Abdômen firme"],
    ["Elevação lateral",3,"12",45,"Até a linha do ombro"],
    ["Panturrilha em pé",4,"15",45,"Amplitude total"]]}]},

 {"key":"m-int-abcd","audience":"M","level":"Intermediário","split":"ABCD","dpw":4,"sort":4,
  "label":"Intermediário · ABCD","objective":"Hipertrofia",
  "description":"4x por semana: peito e tríceps, costas e bíceps, pernas, ombros com trapézio e abdômen.",
  "days":[
   {"nome":"A · Peito e tríceps","foco":"Peito e tríceps","exs":[
    ["Supino reto com barra",4,"10",90,"Escápulas juntas no banco"],
    ["Supino inclinado com halteres",3,"10",90,"Banco a 30-45°"],
    ["Crucifixo com halteres",3,"12",60,"Cotovelos levemente flexionados"],
    ["Tríceps testa",3,"10",60,"Cotovelos fixos"],
    ["Tríceps Pulley",3,"12",60,"Cotovelos colados no corpo"],
    ["Mergulho no banco",3,"12",60,"Desça até 90° no cotovelo"]]},
   {"nome":"B · Costas e bíceps","foco":"Costas e bíceps","exs":[
    ["Puxada frontal (pulldown)",4,"10",90,"Peito aberto"],
    ["Remada curvada com barra",4,"10",90,"Coluna neutra"],
    ["Remada Baixa (Cabo)",3,"12",60,"Puxe até o umbigo"],
    ["Pullover (Dorsal)",3,"12",60,"Braços quase estendidos"],
    ["Rosca direta com barra",3,"10",60,"Sem balançar"],
    ["Rosca alternada com halteres",3,"12",60,"Gire o punho ao subir"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"]]},
   {"nome":"C · Pernas","foco":"Quadríceps, posterior e panturrilha","exs":[
    ["Agachamento livre",4,"10",120,"Joelho alinhado ao pé"],
    ["Leg press 45°",4,"12",90,"Não estenda totalmente o joelho"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Stiff com barra",3,"10",90,"Coluna neutra"],
    ["Mesa Flexora",3,"12",60,"Quadril colado no banco"],
    ["Panturrilha em pé",4,"15",45,"Amplitude total"],
    ["Panturrilha sentado",3,"15",45,"Pausa embaixo"]]},
   {"nome":"D · Ombros, trapézio e abdômen","foco":"Ombros, trapézio e core","exs":[
    ["Desenvolvimento com halteres",4,"10",90,"Não arqueie a lombar"],
    ["Elevação lateral",4,"12",45,"Até a linha do ombro"],
    ["Elevação frontal",3,"12",45,"Sem impulso"],
    ["Crucifixo inverso na máquina",3,"12",60,"Foco no posterior do ombro"],
    ["Encolhimento com halteres",4,"12",45,"Segure 1s em cima"],
    ["Abdominal infra",3,"15",45,"Desça as pernas devagar"],
    ["Prancha",3,"40s",45,"Corpo alinhado"]]}]},

 {"key":"m-av-abcde","audience":"M","level":"Avançado","split":"ABCDE","dpw":5,"sort":5,
  "label":"Avançado · ABCDE","objective":"Hipertrofia",
  "description":"Um grupo por dia, 5x por semana: peito, costas, pernas, ombros e trapézio, braços e abdômen.",
  "days":[
   {"nome":"A · Peito","foco":"Peito","exs":[
    ["Supino reto com barra",4,"6-8",120,"Aquecimento antes das séries pesadas"],
    ["Supino inclinado com barra",4,"8-10",90,"Banco a 30°"],
    ["Supino Declinado com Halteres",3,"10",90,"Controle na descida"],
    ["Crucifixo Inclinado com Halteres",3,"12",60,"Alongue bem embaixo"],
    ["Crucifixo no Crossover (Polia Alta)",3,"12-15",60,"Cruze as mãos no final"],
    ["Fundos (Paralelas)",3,"10-12",90,"Tronco à frente para o peito"]]},
   {"nome":"B · Costas","foco":"Costas e lombar","exs":[
    ["Barra Fixa",4,"6-10",120,"Se precisar, use a assistida"],
    ["Remada curvada com barra",4,"8",90,"Coluna neutra"],
    ["Puxada Alta Fechada",3,"10",60,"Puxe até o peito"],
    ["Remada serrote (1 halter)",3,"10",60,"Cotovelo rente ao corpo"],
    ["Pulldown Braços Estendidos",3,"12",60,"Braços quase retos"],
    ["Hiperextensão lombar",3,"15",60,"Sem passar da linha do corpo"]]},
   {"nome":"C · Pernas","foco":"Quadríceps, posterior e panturrilha","exs":[
    ["Agachamento livre",5,"6-8",150,"Profundidade com técnica"],
    ["Leg press 45°",4,"10",90,"Amplitude completa"],
    ["Agachamento Búlgaro",3,"10",90,"Cada perna"],
    ["Cadeira extensora",3,"12-15",60,"Última série até a falha"],
    ["Stiff com barra",4,"8-10",90,"Coluna neutra"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Panturrilha em pé",4,"12-15",45,"Pausa embaixo"]]},
   {"nome":"D · Ombros e trapézio","foco":"Ombros e trapézio","exs":[
    ["Desenvolvimento militar",4,"8",120,"Abdômen firme"],
    ["Desenvolvimento Arnold",3,"10",90,"Gire durante a subida"],
    ["Elevação lateral",4,"12-15",45,"Até a linha do ombro"],
    ["Elevação Lateral na Polia",3,"12",45,"Unilateral"],
    ["Crucifixo invertido",3,"12",60,"Posterior do ombro"],
    ["Encolhimento de Ombros (Shrug)",4,"10-12",60,"Segure 1s em cima"]]},
   {"nome":"E · Braços e abdômen","foco":"Bíceps, tríceps e core","exs":[
    ["Rosca direta com barra",4,"8-10",60,"Sem balançar"],
    ["Rosca Scott com Halteres",3,"10",60,"Extensão completa embaixo"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"],
    ["Tríceps testa",4,"8-10",60,"Cotovelos fixos"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Tríceps francês halter",3,"10",60,"Cotovelos para cima"],
    ["Abdominal na polia",4,"15",45,"Enrole a coluna"],
    ["Elevação de pernas",3,"15",45,"Sem balanço"]]}]},

 {"key":"f-ini-ab","audience":"F","level":"Iniciante","split":"AB","dpw":3,"sort":1,
  "label":"Iniciante · AB","objective":"Adaptação",
  "description":"Para começar: inferiores e glúteo num dia, superiores e abdômen no outro. Alterne A e B, 3x por semana.",
  "days":[
   {"nome":"A · Inferiores e glúteo","foco":"Pernas, glúteo e panturrilha","exs":[
    ["Leg press 45°",3,"12",90,"Pés na largura do quadril"],
    ["Cadeira extensora",3,"12",60,"Segure 1s em cima"],
    ["Cadeira flexora",3,"12",60,"Quadril colado no banco"],
    ["Elevação Pélvica",3,"12",60,"Aperte o glúteo em cima"],
    ["Cadeira Abdutora",3,"15",45,"Segure 1s aberta"],
    ["Panturrilha em pé",3,"15",45,"Amplitude total"]]},
   {"nome":"B · Superiores e abdômen","foco":"Costas, peito, ombros, braços e core","exs":[
    ["Puxada frontal (pulldown)",3,"12",60,"Puxe até o queixo"],
    ["Remada na máquina",3,"12",60,"Junte as escápulas"],
    ["Supino na máquina",3,"12",60,"Controle na volta"],
    ["Desenvolvimento na máquina",3,"12",60,"Sem travar os cotovelos"],
    ["Tríceps Pulley",3,"12",60,"Cotovelos colados no corpo"],
    ["Rosca Direta com Halteres",3,"12",60,"Sem balançar"],
    ["Abdominal crunch",3,"15",45,"Solte o ar ao subir"]]}]},

 {"key":"f-ini-abc","audience":"F","level":"Iniciante","split":"ABC","dpw":3,"sort":2,
  "label":"Iniciante · ABC","objective":"Hipertrofia",
  "description":"Quadríceps e glúteo, superiores, posterior e glúteo. O ABC feminino mais pedido, 3x por semana.",
  "days":[
   {"nome":"A · Quadríceps e glúteo","foco":"Quadríceps, glúteo e panturrilha","exs":[
    ["Agachamento livre",3,"12",90,"Comece sem carga, só a barra"],
    ["Leg press 45°",3,"12",90,"Amplitude completa"],
    ["Cadeira extensora",3,"15",60,"Segure 1s em cima"],
    ["Afundo com halteres",3,"10",60,"Cada perna, tronco reto"],
    ["Cadeira Abdutora",3,"15",45,"Segure 1s aberta"],
    ["Panturrilha em pé",3,"15",45,"Amplitude total"]]},
   {"nome":"B · Superiores","foco":"Costas, ombros e braços","exs":[
    ["Puxada frontal (pulldown)",3,"12",60,"Peito aberto"],
    ["Remada Baixa (Cabo)",3,"12",60,"Puxe até o umbigo"],
    ["Desenvolvimento com halteres",3,"12",60,"Não arqueie a lombar"],
    ["Elevação lateral",3,"12",45,"Até a linha do ombro"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"]]},
   {"nome":"C · Posterior, glúteo e abdômen","foco":"Posterior, glúteo e core","exs":[
    ["Stiff com barra",3,"12",90,"Barra rente às pernas"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Elevação Pélvica com Barra (Hip Thrust)",3,"12",90,"Queixo no peito, aperte o glúteo"],
    ["Glúteo Coice na Polia (Kickback)",3,"12",45,"Cada perna, sem girar o quadril"],
    ["Abdominal infra",3,"15",45,"Desça as pernas devagar"],
    ["Prancha",3,"30s",45,"Corpo alinhado"]]}]},

 {"key":"f-int-abc","audience":"F","level":"Intermediário","split":"ABC","dpw":3,"sort":3,
  "label":"Intermediário · ABC glúteo em foco","objective":"Hipertrofia",
  "description":"Mais volume para pernas e glúteo, com superiores num dia só. 3x por semana ou ABC ABC.",
  "days":[
   {"nome":"A · Quadríceps e glúteo","foco":"Quadríceps, glúteo e panturrilha","exs":[
    ["Agachamento livre",4,"10",120,"Desça até a coxa paralela"],
    ["Leg press 45°",4,"12",90,"Pés altos para mais glúteo"],
    ["Agachamento Búlgaro",3,"10",90,"Cada perna"],
    ["Cadeira extensora",4,"12-15",60,"Última série até a falha"],
    ["Cadeira Abdutora",4,"15",45,"Tronco à frente para mais glúteo"],
    ["Panturrilha em pé",4,"15",45,"Pausa embaixo"]]},
   {"nome":"B · Superiores e abdômen","foco":"Costas, ombros, braços e core","exs":[
    ["Puxada frontal (pulldown)",4,"10",90,"Peito aberto"],
    ["Remada curvada com barra",3,"10",90,"Coluna neutra"],
    ["Remada serrote (1 halter)",3,"12",60,"Cotovelo rente ao corpo"],
    ["Desenvolvimento com halteres",3,"10",60,"Abdômen firme"],
    ["Elevação lateral",4,"12",45,"Até a linha do ombro"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Rosca direta com barra",3,"12",60,"Sem balançar"],
    ["Crunch no Solo",3,"15",45,"Movimento controlado"]]},
   {"nome":"C · Posterior e glúteo","foco":"Glúteo, posterior e core","exs":[
    ["Elevação Pélvica com Barra (Hip Thrust)",4,"10",90,"Segure 1s em cima"],
    ["Stiff com barra",4,"10",90,"Alongue o posterior"],
    ["Mesa Flexora",4,"12",60,"Quadril colado no banco"],
    ["Glúteo coice na máquina",3,"12",45,"Cada perna"],
    ["Abdução de quadril",3,"15",45,"Movimento controlado"],
    ["Elevação pélvica unilateral",3,"12",60,"Cada perna"],
    ["Prancha lateral",3,"30s",45,"Cada lado"]]}]},

 {"key":"f-int-abcd","audience":"F","level":"Intermediário","split":"ABCD","dpw":4,"sort":4,
  "label":"Intermediário · ABCD","objective":"Hipertrofia",
  "description":"4x por semana: quadríceps, costas e ombros, glúteo e posterior, peito, tríceps e abdômen.",
  "days":[
   {"nome":"A · Quadríceps","foco":"Quadríceps e panturrilha","exs":[
    ["Agachamento livre",4,"10",120,"Joelho alinhado ao pé"],
    ["Agachamento Hack na Máquina (Hack Squat)",4,"10",90,"Desça controlando"],
    ["Leg press 45°",4,"12",90,"Amplitude completa"],
    ["Cadeira extensora",4,"12-15",60,"Segure 1s em cima"],
    ["Afundo com halteres",3,"10",60,"Cada perna"],
    ["Panturrilha sentado",4,"15",45,"Pausa embaixo"]]},
   {"nome":"B · Costas, ombros e bíceps","foco":"Costas, ombros e bíceps","exs":[
    ["Puxada frontal (pulldown)",4,"10",90,"Peito aberto"],
    ["Remada Baixa (Cabo)",4,"10",60,"Puxe até o umbigo"],
    ["Remada serrote (1 halter)",3,"12",60,"Cotovelo rente ao corpo"],
    ["Desenvolvimento com halteres",3,"10",60,"Não arqueie a lombar"],
    ["Elevação lateral",4,"12",45,"Até a linha do ombro"],
    ["Rosca alternada com halteres",3,"12",60,"Gire o punho ao subir"]]},
   {"nome":"C · Glúteo e posterior","foco":"Glúteo e posterior","exs":[
    ["Elevação Pélvica com Barra (Hip Thrust)",4,"10",90,"Segure 1s em cima"],
    ["Stiff com barra",4,"10",90,"Coluna neutra"],
    ["Cadeira flexora",4,"12",60,"Desça devagar"],
    ["Glúteo Coice na Polia (Kickback)",3,"12",45,"Cada perna"],
    ["Cadeira Abdutora",4,"15",45,"Segure 1s aberta"],
    ["Elevação pélvica unilateral",3,"12",60,"Cada perna"]]},
   {"nome":"D · Peito, tríceps e abdômen","foco":"Peito, tríceps e core","exs":[
    ["Supino reto com halteres",3,"12",60,"Escápulas juntas"],
    ["Crucifixo com halteres",3,"12",60,"Cotovelos levemente flexionados"],
    ["Tríceps na polia (corda)",3,"12",60,"Abra a corda no final"],
    ["Tríceps francês halter",3,"12",60,"Cotovelos para cima"],
    ["Abdominal infra",3,"15",45,"Desça as pernas devagar"],
    ["Abdominal oblíquo",3,"15",45,"Cada lado"],
    ["Prancha",3,"40s",45,"Corpo alinhado"]]}]},

 {"key":"f-av-abcde","audience":"F","level":"Avançado","split":"ABCDE","dpw":5,"sort":5,
  "label":"Avançado · ABCDE","objective":"Hipertrofia",
  "description":"5x por semana: quadríceps, costas e bíceps, glúteo, ombros e tríceps, posterior e glúteo.",
  "days":[
   {"nome":"A · Quadríceps","foco":"Quadríceps e panturrilha","exs":[
    ["Agachamento livre",4,"8-10",120,"Profundidade com técnica"],
    ["Agachamento Hack na Máquina (Hack Squat)",4,"10",90,"Desça controlando"],
    ["Leg press 45°",4,"12",90,"Amplitude completa"],
    ["Agachamento Búlgaro",3,"10",90,"Cada perna"],
    ["Cadeira extensora",4,"15",60,"Última série até a falha"],
    ["Panturrilha em pé",4,"15",45,"Pausa embaixo"]]},
   {"nome":"B · Costas e bíceps","foco":"Costas e bíceps","exs":[
    ["Barra fixa assistida",4,"8-10",90,"Peito em direção à barra"],
    ["Remada curvada com barra",4,"10",90,"Coluna neutra"],
    ["Puxada com Triângulo",3,"12",60,"Puxe até o peito"],
    ["Remada serrote (1 halter)",3,"10",60,"Cotovelo rente ao corpo"],
    ["Rosca direta com barra",3,"10",60,"Sem balançar"],
    ["Rosca martelo",3,"12",60,"Pegada neutra"]]},
   {"nome":"C · Glúteo","foco":"Glúteo","exs":[
    ["Elevação Pélvica com Barra (Hip Thrust)",5,"8-10",90,"Carga alta, segure 1s em cima"],
    ["Agachamento Sumô",4,"10",90,"Pés afastados, pontas para fora"],
    ["Glúteo coice na máquina",4,"12",45,"Cada perna"],
    ["Cadeira Abdutora",4,"15-20",45,"Tronco à frente"],
    ["Abdução de quadril",3,"15",45,"Movimento controlado"],
    ["Elevação pélvica unilateral",3,"12",60,"Cada perna"]]},
   {"nome":"D · Ombros, tríceps e abdômen","foco":"Ombros, tríceps e core","exs":[
    ["Desenvolvimento com halteres",4,"10",90,"Abdômen firme"],
    ["Elevação lateral",4,"12-15",45,"Até a linha do ombro"],
    ["Elevação Posterior no Cabo",3,"12",45,"Posterior do ombro"],
    ["Tríceps na polia (corda)",4,"12",60,"Abra a corda no final"],
    ["Tríceps testa",3,"10",60,"Cotovelos fixos"],
    ["Abdominal na polia",4,"15",45,"Enrole a coluna"],
    ["Prancha",3,"45s",45,"Corpo alinhado"]]},
   {"nome":"E · Posterior e glúteo","foco":"Posterior, glúteo e panturrilha","exs":[
    ["Stiff com barra",4,"8-10",90,"Alongue o posterior"],
    ["Mesa Flexora",4,"12",60,"Quadril colado no banco"],
    ["Cadeira flexora",3,"12",60,"Desça devagar"],
    ["Levantamento terra sumô",3,"8",120,"Coluna neutra, empurre o chão"],
    ["Elevação Pélvica",3,"12",60,"Pausa em cima"],
    ["Panturrilha sentado",4,"15",45,"Pausa embaixo"]]}]}
]$json$::jsonb
$catalog$;

-- Dias da semana padrão para cada frequência
create or replace function public.default_week_days(p_n integer)
returns text[]
language sql
immutable
as $function$
  select case p_n
    when 1 then array['Seg']
    when 2 then array['Seg','Qui']
    when 3 then array['Seg','Qua','Sex']
    when 4 then array['Seg','Ter','Qui','Sex']
    when 5 then array['Seg','Ter','Qua','Qui','Sex']
    when 6 then array['Seg','Ter','Qua','Qui','Sex','Sáb']
    else array['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
  end;
$function$;

-- ---------------------------------------------------------------------------
-- Cria os treinos base de uma academia (idempotente). Dono: 1º personal,
-- senão o gestor. Exercício faltando na biblioteca = erro (não salva pela metade).
create or replace function public.seed_base_programs(p_gym uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_owner uuid;
  p jsonb;
  d jsonb;
  e jsonb;
  v_program uuid;
  v_day uuid;
  v_ex uuid;
  v_dias jsonb;
  v_exs jsonb;
  i integer;
  j integer;
  n integer := 0;
  letters text := 'ABCDEF';
begin
  if exists (select 1 from public.starter_templates where gym_id = p_gym and is_base) then
    return 0;
  end if;

  select id into v_owner from public.profiles
  where gym_id = p_gym and role in ('trainer', 'manager', 'admin')
  order by (role = 'trainer') desc, created_at
  limit 1;
  if v_owner is null then
    return 0;
  end if;

  for p in select * from jsonb_array_elements(public.base_programs_catalog()) loop
    -- monta o rascunho completo (ai_draft) com os ids reais
    v_dias := '[]'::jsonb;
    for i in 0 .. jsonb_array_length(p -> 'days') - 1 loop
      d := p -> 'days' -> i;
      v_exs := '[]'::jsonb;
      for j in 0 .. jsonb_array_length(d -> 'exs') - 1 loop
        e := d -> 'exs' -> j;
        select id into v_ex from public.exercises
        where lower(name) = lower(e ->> 0) and (gym_id is null or gym_id = p_gym)
        order by (gym_id = p_gym) desc nulls last, created_at
        limit 1;
        if v_ex is null then
          raise exception 'Treino base %: exercício "%" não está na biblioteca', p ->> 'key', e ->> 0;
        end if;
        v_exs := v_exs || jsonb_build_object(
          'exerciseId', v_ex, 'exercicio', e ->> 0, 'series', (e ->> 1)::int,
          'reps', e ->> 2, 'descanso', (e ->> 3) || 's', 'rpe', 7, 'dica', e ->> 4,
          'tecnica', 'normal');
      end loop;
      v_dias := v_dias || jsonb_build_object(
        'nome', d ->> 'nome', 'foco', d ->> 'foco', 'slot', substr(letters, i + 1, 1),
        'aquecimento', '[]'::jsonb, 'exercicios', v_exs, 'finalizador', '');
    end loop;

    insert into public.workout_programs
      (gym_id, trainer_id, name, objective, created_via, ai_draft, reviewed_by, notes)
    values
      (p_gym, v_owner, p ->> 'label', p ->> 'objective', 'template',
       jsonb_build_object(
         'nome', p ->> 'label',
         'frequencia', (p ->> 'dpw') || 'x por semana',
         'daysSelected', to_jsonb(public.default_week_days((p ->> 'dpw')::int)),
         'splitType', p ->> 'split',
         'nivel', p ->> 'level',
         'objetivo', p ->> 'objective',
         'observacao_geral', p ->> 'description',
         'dias', v_dias,
         'cardio', '',
         'modo', 'manual')::text,
       v_owner, p ->> 'description')
    returning id into v_program;

    for i in 0 .. jsonb_array_length(v_dias) - 1 loop
      d := v_dias -> i;
      insert into public.workout_days (gym_id, program_id, name, day_order)
      values (p_gym, v_program, d ->> 'nome', i + 1)
      returning id into v_day;
      for j in 0 .. jsonb_array_length(d -> 'exercicios') - 1 loop
        e := d -> 'exercicios' -> j;
        insert into public.workout_exercises
          (gym_id, day_id, exercise_id, sets, reps, rest_seconds, rpe, notes, technique, ord)
        values
          (p_gym, v_day, (e ->> 'exerciseId')::uuid, (e ->> 'series')::int, e ->> 'reps',
           replace(e ->> 'descanso', 's', '')::int, 7,
           (e ->> 'exercicio') || '. ' || (e ->> 'dica'), 'normal', j + 1);
      end loop;
    end loop;

    insert into public.starter_templates
      (gym_id, program_id, label, levels, is_base, audience, split, days_per_week, description, sort, created_by)
    values
      (p_gym, v_program, p ->> 'label', array[p ->> 'level'], true, p ->> 'audience',
       p ->> 'split', (p ->> 'dpw')::int, p ->> 'description', (p ->> 'sort')::int, v_owner);
    n := n + 1;
  end loop;

  return n;
end;
$function$;

revoke all on function public.seed_base_programs(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Copia um modelo (base ou do personal) para a ficha do aluno.
-- Interno: chamado por assign_starter_plan e pick_starter_plan.
create or replace function public.copy_template_for_student(p_template uuid, p_student uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  st record;
  t record;
  prog record;
  d record;
  n integer;
  nd integer;
  v_first text;
  v_draft jsonb;
  v_days text[];
  v_program uuid;
  v_day uuid;
begin
  select id, gym_id, name, available_days into st from public.profiles where id = p_student;
  select * into t from public.starter_templates where id = p_template and gym_id = st.gym_id;
  if t.id is null then
    raise exception 'Modelo não encontrado';
  end if;
  select * into prog from public.workout_programs where id = t.program_id;
  select count(*) into nd from public.workout_days where program_id = prog.id;

  n := coalesce(array_length(st.available_days, 1), 0);
  v_first := split_part(coalesce(nullif(trim(st.name), ''), 'Aluno'), ' ', 1);

  begin
    v_draft := prog.ai_draft::jsonb;
  exception when others then
    v_draft := null;
  end;
  if v_draft is not null and n = nd then
    select array_agg(x order by public.weekday_number(x)) into v_days
    from unnest(st.available_days) x where public.weekday_number(x) is not null;
    if coalesce(array_length(v_days, 1), 0) = nd then
      v_draft := jsonb_set(v_draft, '{daysSelected}', to_jsonb(v_days));
    end if;
  end if;
  if v_draft is not null then
    v_draft := jsonb_set(v_draft, '{nome}', to_jsonb(prog.name || ' · ' || v_first));
  end if;

  -- o treino anterior que veio de modelo vira histórico
  update public.student_workouts sw
  set status = 'completed', completed_at = now()
  from public.workout_programs wp
  where sw.student_id = p_student and sw.status = 'active'
    and wp.id = sw.program_id and wp.created_via = 'template';

  insert into public.workout_programs
    (gym_id, trainer_id, name, objective, created_via, ai_draft, notes, reviewed_by)
  values
    (st.gym_id, prog.trainer_id, prog.name || ' · ' || v_first, prog.objective,
     'template', coalesce(v_draft::text, prog.ai_draft), prog.notes, null)
  returning id into v_program;

  for d in select * from public.workout_days where program_id = prog.id order by day_order loop
    insert into public.workout_days (gym_id, program_id, name, day_order)
    values (st.gym_id, v_program, d.name, d.day_order)
    returning id into v_day;
    insert into public.workout_exercises
      (gym_id, day_id, exercise_id, variation_id, sets, reps, rest_seconds, rpe, notes, technique, ord)
    select st.gym_id, v_day, we.exercise_id, we.variation_id, we.sets, we.reps,
           we.rest_seconds, we.rpe, we.notes, we.technique, we.ord
    from public.workout_exercises we where we.day_id = d.id;
  end loop;

  insert into public.student_workouts (gym_id, student_id, program_id, status)
  values (st.gym_id, p_student, v_program, 'active');

  return v_program;
end;
$function$;

revoke all on function public.copy_template_for_student(uuid, uuid) from public, anon, authenticated;

-- Quem da equipe recebe os avisos do aluno: personal vinculado; sem
-- vínculo, os personais da academia; sem personal, gestores.
create or replace function public.student_staff(p_student uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $function$
  with linked as (
    select trainer_id from public.student_trainers where student_id = p_student
  ),
  gym as (select gym_id from public.profiles where id = p_student),
  trainers as (
    select p.id from public.profiles p, gym
    where p.gym_id = gym.gym_id and p.role = 'trainer'
  ),
  managers as (
    select p.id from public.profiles p, gym
    where p.gym_id = gym.gym_id and p.role in ('manager', 'admin')
  )
  select trainer_id from linked
  union
  select id from trainers where not exists (select 1 from linked)
  union
  select id from managers where not exists (select 1 from linked) and not exists (select 1 from trainers);
$function$;

-- ---------------------------------------------------------------------------
-- Escolha automática (aprovação / equipe): agora considera o público
-- (masculino/feminino) e prefere os modelos do próprio personal.
create or replace function public.assign_starter_plan(p_student uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_caller record;
  st record;
  t record;
  n integer;
  v_program uuid;
  v_owner uuid;
begin
  select id, gym_id, name, approved_at, medical_risk, status, experience_level, available_days, sex
    into st
  from public.profiles where id = p_student and role = 'student';
  if st.id is null then
    return jsonb_build_object('ok', false, 'reason', 'nao_e_aluno');
  end if;

  if v_uid is not null then
    select role, gym_id into v_caller from public.profiles where id = v_uid;
    if not (v_uid = p_student
            or (v_caller.role in ('trainer', 'manager', 'admin') and v_caller.gym_id = st.gym_id)) then
      raise exception 'Sem permissão';
    end if;
  end if;

  if st.approved_at is null then
    return jsonb_build_object('ok', false, 'reason', 'nao_aprovado');
  end if;
  if coalesce(st.medical_risk, false) or coalesce(st.status, 'active') <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'avaliacao_medica');
  end if;

  perform pg_advisory_xact_lock(hashtext('starter:' || p_student::text));

  if exists (select 1 from public.student_workouts
             where student_id = p_student and status = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'ja_tem_ficha');
  end if;

  n := coalesce(array_length(st.available_days, 1), 3);

  select x.* into t from (
    select s.*,
      (select count(*) from public.workout_days wd where wd.program_id = s.program_id)::int as nd
    from public.starter_templates s
    where s.gym_id = st.gym_id and s.active
      and (s.audience is null or st.sex is null or s.audience = st.sex)
  ) x
  where x.nd > 0
  order by (not x.is_base) desc,
           (x.levels is not null and st.experience_level = any(x.levels)) desc,
           (x.levels is null) desc,
           abs(x.nd - n) asc,
           x.sort asc,
           x.created_at asc
  limit 1;

  if t.id is null then
    return jsonb_build_object('ok', false, 'reason', 'sem_modelo');
  end if;

  v_program := public.copy_template_for_student(t.id, p_student);

  select trainer_id into v_owner from public.workout_programs where id = t.program_id;
  if v_owner is not null then
    insert into public.notifications (gym_id, user_id, channel, title, body)
    values (st.gym_id, v_owner, 'in_app', 'Treino inicial aplicado',
      coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' recebeu o modelo "' || t.label
      || '". Já pode treinar; revise e ajuste quando puder.');
  end if;

  return jsonb_build_object('ok', true, 'program_id', v_program, 'template', t.label);
end;
$function$;

grant execute on function public.assign_starter_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Treinos que o aluno pode escolher, já ordenados (os 3 primeiros = sugeridos)
create or replace function public.starter_options()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  with me as (
    select id, gym_id, sex, experience_level,
      coalesce(array_length(available_days, 1), 3) as n
    from public.profiles where id = auth.uid()
  ),
  opts as (
    select s.id, s.label, s.description, s.split, s.is_base, s.audience, s.sort,
      coalesce(s.levels[1], 'Todos os níveis') as level,
      (select count(*) from public.workout_days wd where wd.program_id = s.program_id)::int as nd,
      coalesce(s.days_per_week,
        (select count(*) from public.workout_days wd where wd.program_id = s.program_id)::int) as dpw,
      (select coalesce(jsonb_agg(wd.name order by wd.day_order), '[]'::jsonb)
         from public.workout_days wd where wd.program_id = s.program_id) as days,
      (select count(*) from public.workout_exercises we
         join public.workout_days wd on wd.id = we.day_id
        where wd.program_id = s.program_id)::int as exercises,
      ((s.levels is not null and me.experience_level = any(s.levels))) as level_match,
      abs(coalesce(s.days_per_week, 3) - me.n) as days_gap
    from public.starter_templates s, me
    where s.gym_id = me.gym_id and s.active
      and (s.audience is null or me.sex is null or s.audience = me.sex)
  ),
  ranked as (
    select o.*, row_number() over (
      order by (not o.is_base) desc, o.level_match desc, o.days_gap asc, o.sort asc
    ) as rk
    from opts o where o.nd > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'label', label, 'description', description, 'split', split,
      'level', level, 'days_per_week', dpw, 'days', days, 'exercises', exercises,
      'is_base', is_base, 'recommended', rk <= 3
    ) order by rk), '[]'::jsonb)
  from ranked;
$function$;

grant execute on function public.starter_options() to authenticated;

-- O aluno escolhe (ou troca) o treino base. Não precisa esperar aprovação.
-- Ficha montada pelo personal nunca é substituída por aqui.
create or replace function public.pick_starter_plan(p_template uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  st record;
  t record;
  v_program uuid;
  sid uuid;
begin
  select id, gym_id, name, role, medical_risk, status into st from public.profiles where id = v_uid;
  if st.id is null or st.role <> 'student' then
    raise exception 'Sem permissão';
  end if;
  if coalesce(st.medical_risk, false) or coalesce(st.status, 'active') <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'avaliacao_medica');
  end if;

  select * into t from public.starter_templates
  where id = p_template and gym_id = st.gym_id and active;
  if t.id is null then
    return jsonb_build_object('ok', false, 'reason', 'modelo_indisponivel');
  end if;

  perform pg_advisory_xact_lock(hashtext('starter:' || v_uid::text));

  if exists (
    select 1 from public.student_workouts sw
    join public.workout_programs wp on wp.id = sw.program_id
    where sw.student_id = v_uid and sw.status = 'active' and wp.created_via <> 'template'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'ficha_do_personal');
  end if;

  v_program := public.copy_template_for_student(t.id, v_uid);

  -- equipe sabe quem escolheu o quê (no máximo 1 aviso por aluno por dia)
  if not exists (
    select 1 from public.notifications
    where title = 'Aluno escolheu treino base'
      and body like coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' escolheu%'
      and created_at > now() - interval '24 hours'
  ) then
    for sid in select public.student_staff(v_uid) loop
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (st.gym_id, sid, 'in_app', 'Aluno escolheu treino base',
        coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' escolheu "' || t.label
        || '". Boa hora para oferecer um ajuste ou acompanhamento.');
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'program_id', v_program, 'template', t.label);
end;
$function$;

grant execute on function public.pick_starter_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pedidos do aluno ao personal avisam a equipe (sininho + push)
create or replace function public.notify_student_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tag text := substring(coalesce(NEW.details, '') from '^\[([a-z]+)\]');
  v_msg text := btrim(regexp_replace(coalesce(NEW.details, ''), '^\[[a-z]+\]\s*', ''));
  v_name text;
  v_title text;
  sid uuid;
begin
  begin
    select coalesce(nullif(trim(name), ''), 'Um aluno') into v_name from public.profiles where id = NEW.student_id;
    v_title := case v_tag
      when 'acompanhamento' then 'Pedido de acompanhamento'
      when 'treino' then 'Pedido de treino personalizado'
      when 'ajuste' then 'Pedido de ajuste no treino'
      when 'carga' then 'Pedido de ajuste no treino'
      when 'relatorio' then 'Pedido de relatório'
      else 'Pedido do aluno'
    end;
    for sid in select public.student_staff(NEW.student_id) loop
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (NEW.gym_id, sid, 'in_app', v_title,
        v_name || case when v_msg <> '' then ': ' || left(v_msg, 140) else ' fez um pedido.' end);
    end loop;
  exception when others then
    raise warning 'notify_student_request falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;

drop trigger if exists trg_notify_student_request on public.premium_requests;
create trigger trg_notify_student_request
  after insert on public.premium_requests
  for each row execute function public.notify_student_request();

-- ---------------------------------------------------------------------------
-- Treinos base para as academias que já existem
do $$
declare g record;
begin
  for g in select id from public.gyms loop
    perform public.seed_base_programs(g.id);
  end loop;
end $$;
