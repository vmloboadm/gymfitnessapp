-- 030: Conteúdo da TV da academia (Fase 4).
-- A rota /tv lê daqui (ativos, ordenados por ord) + patrocinadores.
-- RLS: leitura no gym (alunos/TV sem login usam anon via gym_id público? não —
-- a TV usa a página pública /tv com supabase anon; por isso leitura é aberta
-- para linhas do gym piloto via política permissiva de SELECT).
-- Escrita: só manager/admin do gym.

create table if not exists public.tv_content (
  id           uuid primary key default uuid_generate_v4(),
  gym_id       uuid not null references public.gyms(id),
  type         text not null check (type in ('sponsor','tip','ranking','promo','motivation')),
  title        text not null,
  body         text,
  image_url    text,
  link_url     text,
  duration_sec int not null default 30 check (duration_sec between 10 and 120),
  ord          int not null default 1,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.tv_content enable row level security;

-- Leitura: qualquer um pode ver o conteúdo ativo do gym (a TV é pública).
create policy "tv_content_select_active" on public.tv_content
  for select using (active = true);

-- Escrita: só manager/admin do gym.
create policy "tv_content_manage_manager" on public.tv_content
  for all using (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  ) with check (
    public.current_role() in ('manager','admin')
    and gym_id = public.current_gym_id()
  );

-- ── Seed inicial: 4 slides padrão ───────────────────────────────────────
insert into public.tv_content (gym_id, type, title, body, duration_sec, ord)
select '00000000-0000-0000-0000-000000000001', x.type, x.title, x.body, x.duration_sec, x.ord
from (values
  ('motivation', 'Bom treino!', 'Constância vence intensidade. 1% melhor a cada dia.', 20, 1),
  ('tip', 'Dica do dia', 'Beba água entre as séries — hidratação mantém a performance.', 20, 2),
  ('motivation', 'GymFitness Campos', 'Escaneie o QR das máquinas e veja todos os exercícios possíveis.', 20, 3),
  ('tip', 'Não esqueça', 'Registre seu treino no app e acompanhe sua evolução.', 20, 4)
) as x(type, title, body, duration_sec, ord)
where not exists (
  select 1 from public.tv_content t
  where t.gym_id = '00000000-0000-0000-0000-000000000001' and t.title = x.title
);

select type, title, active from public.tv_content
where gym_id = '00000000-0000-0000-0000-000000000001' order by ord;
