-- =====================================================================
-- 004_seed_gym.sql — Seed da GymFitness (piloto)
-- Cria a academia, o gestor, 2 personais e equipamentos reais.
-- NOTA: rodar após login do gestor existir no Supabase Auth (auth.users).
-- Como o seed SQL em ambiente clou não conhece valores de auth.users,
-- usamos UUIDs fixes documentados e você atualiza os ids após criar usuários
-- (ou usa o trigger handle_new_user + RPC de bootstrap descrito em docs/README.md).
-- =====================================================================

insert into public.gyms (id, name, slug, address) values
('00000000-0000-0000-0000-000000000001', 'GymFitness Academia', 'gymfitness', 'Rua das Bicicletas, 100 - Centro');

-- Perfis dos personais/gestor (ids artificiais; só inserem quando o
-- usuário correspondente já existir no auth — FK profiles.id -> auth.users)
do $$
begin
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000011') then
    insert into public.profiles (id, gym_id, role, status, name, email, lgpd_consent_at) values
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'trainer', 'active', 'Carlos Almeida', 'carlos@gymfitness.fit', now());
  end if;
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000012') then
    insert into public.profiles (id, gym_id, role, status, name, email, lgpd_consent_at) values
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'trainer', 'active', 'Fernanda Souza', 'fernanda@gymfitness.fit', now());
  end if;
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000021') then
    insert into public.profiles (id, gym_id, role, status, name, email, lgpd_consent_at) values
    ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'manager', 'active', 'GymFitness Admin', 'admin@gymfitness.fit', now());
  end if;
end $$;

-- =====================================================================
-- Equipamentos da GymFitness
-- =====================================================================

insert into public.equipment (gym_id, name, category, capacity, nfc_tag_url, qr_url, map_position) values
('00000000-0000-0000-0000-000000000001', 'Esteira 1',            'cardio',       1, 'https://app.stackgym.fit/checkin?eq=eq-esteira-1&src=nfc',     'eq-esteira-1',     '{"x":10,"y":20}'),
('00000000-0000-0000-0000-000000000001', 'Esteira 2',            'cardio',       1, 'https://app.stackgym.fit/checkin?eq=eq-esteira-2&src=nfc',     'eq-esteira-2',     '{"x":25,"y":20}'),
('00000000-0000-0000-0000-000000000001', 'Bicicleta ergométrica','cardio',       1, 'https://app.stackgym.fit/checkin?eq=eq-bike-1&src=nfc',        'eq-bike-1',        '{"x":40,"y":20}'),
('00000000-0000-0000-0000-000000000001', 'Leg press 45°',        'perna',        1, 'https://app.stackgym.fit/checkin?eq=eq-legpress-1&src=nfc',    'eq-legpress-1',    '{"x":60,"y":60}'),
('00000000-0000-0000-0000-000000000001', 'Cadeira extensora',    'perna',        1, 'https://app.stackgym.fit/checkin?eq=eq-extensora-1&src=nfc',   'eq-extensora-1',   '{"x":75,"y":60}'),
('00000000-0000-0000-0000-000000000001', 'Supino reto com barra','peito',        1, 'https://app.stackgym.fit/checkin?eq=eq-supino-1&src=nfc',      'eq-supino-1',      '{"x":90,"y":30}'),
('00000000-0000-0000-0000-000000000001', 'Halteres (duplex)',    'peito',        4, 'https://app.stackgym.fit/checkin?eq=eq-halteres-1&src=nfc',    'eq-halteres-1',    '{"x":15,"y":70}'),
('00000000-0000-0000-0000-000000000001', 'Puxada frontal',       'costas',       1, 'https://app.stackgym.fit/checkin?eq=eq-pulldown-1&src=nfc',    'eq-pulldown-1',    '{"x":30,"y":80}');