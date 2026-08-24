-- =====================================================================
-- 002_seed_exercises.sql — Biblioteca base 40+ exercícios
-- gym_id = NULL (global do produto). Academias podem adicionar próprios.
-- =====================================================================

insert into public.exercises (gym_id, name, category, muscles, technique_default, high_impact, tips) values
-- Peito
(null, 'Supino reto com barra',        'peito',        array['peito','triceps','ombro'], 'normal', true,  array['Mantenha escápulas retraídas','Barra na linha da mamilo']),
(null, 'Supino reto com halteres',     'peito',        array['peito','triceps'],        'normal', false, array['Feche as escápulas','Amplitude controlada']),
(null, 'Supino inclinado com halteres','peito',        array['peito','ombro'],          'normal', false, array['Banco em 30 graus','Desça até alongar o peito']),
(null, 'Crucifixo com halteres',       'peito',        array['peito'],                 'normal', false, array['Movimento em arco','Contração no topo']),
(null, 'Voador (peck deck)',           'peito',        array['peito'],                 'normal', false, array['Ajuste o banco','Não trave os cotovelos']),
(null, 'Flexão de braço',              'peito',        array['peito','core','triceps'],'normal', true,  array['Corpo alinhado','Core contraído o tempo todo']),
-- Costas
(null, 'Puxada frontal (pulldown)',    'costas',       array['costas','biceps'],       'normal', false, array['Foco em puxar com o cotovelo','Peito para fora']),
(null, 'Remada curvada com barra',     'costas',       array['costas','biceps'],       'normal', false, array['Tronco inclinado 45°','Ombros para trás']),
(null, 'Remada serrote (1 halter)',    'costas',       array['costas','biceps'],       'normal', false, array['Costas retas','Trave o ombro']),
(null, 'Levantamento terra',           'costas',       array['costas','gluteo','perna'],'normal', true, array['Perna e core ativos','Barra rente ao corpo']),
(null, 'Remada na máquina',            'costas',       array['costas','biceps'],       'normal', false, array['Sem balanço','Tração no peito']),
(null, 'Barra fixa (puxada)',          'costas',       array['costas','biceps'],       'normal', true,  array['Se não conseguir, use assistida','Controle na descida']),
-- Ombro
(null, 'Desenvolvimento militar',      'ombro',        array['ombro','triceps'],       'normal', true,  array['Cintura pélvica estável','Barra até a linha do queixo']),
(null, 'Desenvolvimento com halteres', 'ombro',        array['ombro','triceps'],       'normal', false, array['Cotovelos a 45°','Amplitude completa']),
(null, 'Elevação lateral',             'ombro',        array['ombro'],                'normal', false, array['Cotovelo sempre acima do pulso','Peso moderado']),
(null, 'Elevação frontal',             'ombro',        array['ombro'],                'normal', false, array['Sem impulso','Subida até a altura dos olhos']),
(null, 'Crucifixo invertido',          'ombro',        array['ombro','costas'],        'normal', false, array['Inclinação do tronco','Contração nas escápulas']),
-- Bíceps
(null, 'Rosca direta com barra',       'biceps',       array['biceps'],               'normal', false, array['Cotovelos fixos','Sem balanço']),
(null, 'Rosca alternada com halteres', 'biceps',       array['biceps'],               'normal', false, array['Rotação no topo (supinação)','Controle na descida']),
(null, 'Rosca martelo',                'biceps',       array['biceps','antebraco'],   'normal', false, array['Punhos neutros','Bíceps braquial']),
(null, 'Rosca scott',                  'biceps',       array['biceps'],               'normal', false, array['Banco fixa o posicionamento','Sem roubar com o corpo']),
(null, 'Rosca concentrada',            'biceps',       array['biceps'],               'normal', false, array['Braço apoiado','Foco na contração']),
-- Tríceps
(null, 'Tríceps na polia (corda)',     'triceps',      array['triceps'],              'normal', false, array['Cotovelos junto ao corpo','Estenda completo']),
(null, 'Tríceps testa',                'triceps',      array['triceps'],              'normal', false, array['Cotovelos apontando para cima','Cuidado com o cotovelo']),
(null, 'Mergulho no banco',            'triceps',      array['triceps','peito'],      'normal', true,  array['Cotovelos para trás','Core firme']),
(null, 'Tríceps francês halter',       'triceps',      array['triceps'],              'normal', false, array['Cotovelo fixo','Desça atrás da cabeça']),
-- Perna / Quadríceps
(null, 'Agachamento livre',            'perna',        array['perna','gluteo','core'],'normal', true,  array['Profundidade controlada','Joelhos acompanham os pés']),
(null, 'Agachamento na máquina smith', 'perna',        array['perna','gluteo'],       'normal', false, array['Pés levemente à frente','Joelhos alinhados']),
(null, 'Leg press 45°',                'perna',        array['perna','gluteo'],       'normal', false, array['Desça até 90°','Nunca trave o joelho']),
(null, 'Cadeira extensora',            'perna',        array['perna'],                'normal', false, array['Pausa no topo','Movimento controlado']),
(null, 'Afundo com halteres',          'perna',        array['perna','gluteo'],       'normal', true,  array['Passo firme','Joelho não ultrapassa o pé']),
-- Posterior / Glúteo
(null, 'Cadeira flexora',              'perna',        array['perna','gluteo'],       'normal', false, array['Pausa na contração','Não levante o quadril']),
(null, 'Stiff com barra',              'perna',        array['perna','gluteo','costas'],'normal', false, array['Tronco reto','Estiramento do posterior']),
(null, 'Elevação pélvica (glute bridge)','gluteo',     array['gluteo'],               'normal', false, array['Empurre pelo calcanhar','Pico de contração']),
(null, 'Hip thrust com barra',         'gluteo',       array['gluteo'],               'normal', false, array['Queixo encostado','Costelas neutras']),
(null, 'Abdução de quadril',           'gluteo',       array['gluteo'],               'normal', false, array['Controle na volta','Não use impulso']),
-- Panturrilha
(null, 'Panturrilha em pé',            'panturrilha',  array['panturrilha'],          'normal', false, array['Pausa no topo','Amplitude completa']),
(null, 'Panturrilha sentado',          'panturrilha',  array['panturrilha'],          'normal', false, array['Foco na parte inferior','Sem quicar']),
-- Core
(null, 'Prancha',                      'core',         array['core'],                 'normal', false, array['Quadril alinhado','Respire']),
(null, 'Abdominal crunch',             'core',         array['core'],                 'normal', false, array['Contração no topo','Não puxe o pescoço']),
(null, 'Prancha lateral',              'core',         array['core','ombro'],         'normal', false, array['Quadril alto','Segure firme']),
(null, 'Elevação de pernas',           'core',         array['core'],                 'normal', false, array['Controle na descida','Evite balanço']),
-- Cardio
(null, 'Esteira',                      'cardio',       array['cardio'],               'normal', false, array['Aqueça 5 min','Progressão gradual']),
(null, 'Bicicleta ergométrica',        'cardio',       array['cardio'],               'normal', false, array['Cadência constante','Posição confortável de selim']),
(null, 'Elíptico',                     'cardio',       array['cardio'],               'normal', false, array['Movimento fluido','Resistência progressiva']),
(null, 'Remo ergômetro',               'cardio',       array['cardio','costas'],      'normal', false, array['Empurre com a perna primeiro','Sequência puxar-acabar']),
(null, 'Pular corda',                  'cardio',       array['cardio'],               'normal', true,  array['Aterrisagem suave','Alternar pés lado a lado']);