-- =====================================================================
-- 034_page_analytics.sql
-- Painel do dono: rastreio dos QR dos banners da parede.
--
-- Cada banner tem um QR cainnuma LP pública diferente (/bem-vindo,
-- /parceiros, /evolucao, /vantagens, /day-pass). Guardamos:
--   view  = abriu a página vindole do QR
--   click = clicou num CTA (criar conta / entrar / day-pass)
--   signup = conta criada (funil completo do banner)
--   daypass = comprou day-pass
-- visitor_id (uuid no localStorage) permite únicos e funil sem login.
-- =====================================================================

create table if not exists public.page_views (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null default '00000000-0000-0000-0000-000000000001'
             references public.gyms(id),
  path       text not null,
  kind       text not null default 'view'
             check (kind in ('view', 'click', 'signup', 'daypass')),
  cta        text,          -- destino do clique: /register, /login, ...
  referrer   text,          -- de onde veio (QR direto = vazio/externo)
  device     text check (device in ('mobile', 'desktop', 'tablet')),
  visitor_id text not null, -- uuid anônimo no localStorage do device
  user_id    uuid,          -- preenchido quando logado (signup)
  created_at timestamptz not null default now()
);

alter table public.page_views enable row level security;

create index if not exists page_views_created_idx
  on public.page_views (created_at desc);
create index if not exists page_views_path_created_idx
  on public.page_views (path, created_at desc);
create index if not exists page_views_kind_created_idx
  on public.page_views (kind, created_at desc);
create index if not exists page_views_visitor_idx
  on public.page_views (visitor_id);

-- Visitante anônimo registra a própria visita (mesmo padrão do
-- day_passes_insert_anon, com saneamento de path/cta).
drop policy if exists "page_views_insert_anon" on public.page_views;
create policy "page_views_insert_anon"
  on public.page_views
  for insert to anon, authenticated
  with check (
    path like '/%'
    and char_length(path) < 160
    and (cta is null or cta like '/%')
    and char_length(coalesce(visitor_id, '')) between 8 and 64
  );

-- Staff lê os dados da própria academia (painel).
drop policy if exists "page_views_select_staff" on public.page_views;
create policy "page_views_select_staff"
  on public.page_views
  for select to authenticated
  using (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );

-- Grants explícitos: Supabase default privileges não dão INSERT p/ anon
-- (padrão também usado em day_passes). Anônimo só insere; staff só lê.
grant insert on public.page_views to anon;
grant select, insert on public.page_views to authenticated;

-- Ninguém altera ou apaga histórico de métricas.
revoke update, delete, truncate on public.page_views from anon, authenticated;
