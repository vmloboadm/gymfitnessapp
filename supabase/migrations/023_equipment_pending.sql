-- 023: Máquinas de exemplo pendentes de verificação.
-- A lista real da academia ainda não foi enviada; estas 37 são exemplos
-- comuns marcados como 'pending' para não confundir com o verificado.

do $$
declare
  g uuid := '00000000-0000-0000-0000-000000000001';
begin
  -- libera o status 'pending' no check da tabela
  begin
    alter table public.equipment drop constraint if exists equipment_status_check;
  exception when others then null;
  end;
  alter table public.equipment
    add constraint equipment_status_check
    check (status in ('available','in_use','maintenance','pending'));

  -- exemplos pendentes (só insere se ainda não existir com esse nome no gym)
  insert into public.equipment (gym_id, name, category, capacity, status)
  select g, x.name, x.category, 1, 'pending'
  from (values
    ('Supino inclinado com barra', 'peito'),
    ('Supino declinado', 'peito'),
    ('Crossover', 'peito'),
    ('Peck deck 2', 'peito'),
    ('Halteres 2-30kg', 'peito'),
    ('Remada baixa', 'costas'),
    ('Remada cavalinho', 'costas'),
    ('Puxada alta articulada', 'costas'),
    ('Barra fixa assistida', 'costas'),
    ('Desenvolvimento articulado', 'ombro'),
    ('Elevação lateral máquina', 'ombro'),
    ('Crucifixo invertido máquina', 'ombro'),
    ('Rosca direta máquina', 'biceps'),
    ('Rosca concentrada banco', 'biceps'),
    ('Tríceps pulley', 'triceps'),
    ('Tríceps testa banco', 'triceps'),
    ('Mergulho paralelas', 'triceps'),
    ('Agachamento hack', 'perna'),
    ('Agachamento smith', 'perna'),
    ('Cadeira flexora', 'perna'),
    ('Cadeira abdutora', 'perna'),
    ('Cadeira adutora', 'perna'),
    ('Panturrilha em pé máquina', 'panturrilha'),
    ('Panturrilha sentado', 'panturrilha'),
    ('Glúteo kickback máquina', 'gluteo'),
    ('Elevação pélvica máquina', 'gluteo'),
    ('Abdominal máquina', 'core'),
    ('Prancha solo área', 'core'),
    ('Esteira 3', 'cardio'),
    ('Esteira 4', 'cardio'),
    ('Elíptico 1', 'cardio'),
    ('Elíptico 2', 'cardio'),
    ('Remo ergômetro', 'cardio'),
    ('Bike spinning 1', 'cardio'),
    ('Bike spinning 2', 'cardio'),
    ('Escada ergométrica', 'cardio'),
    ('Kettlebell rack', 'perna')
  ) as x(name, category)
  where not exists (
    select 1 from public.equipment e
    where e.gym_id = g and lower(e.name) = lower(x.name)
  );
end $$;

select status, count(*) from public.equipment
where gym_id = '00000000-0000-0000-0000-000000000001'
group by status order by status;
