-- 026: Patrocinadores com desconto para alunos.
-- gym_id NULL = global (todas as academias); com gym_id = só daquele gym.

create table if not exists public.sponsors (
  id            uuid primary key default uuid_generate_v4(),
  gym_id        uuid references public.gyms(id),
  name          text not null,
  logo_url      text,
  discount_text text not null,
  min_value     text,
  cta_type      text not null default 'coupon' check (cta_type in ('coupon','whatsapp')),
  cta_value     text,
  active        boolean not null default true,
  ord           int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.sponsors enable row level security;

-- leitura: todos do gym (alunos veem os cards)
create policy "sponsors_select_gym" on public.sponsors
  for select using (
    gym_id is null
    or gym_id = public.current_gym_id()
  );

-- escrita: só manager/admin
create policy "sponsors_manage_manager" on public.sponsors
  for all using (
    public.current_role() in ('manager','admin')
    and (gym_id is null or gym_id = public.current_gym_id())
  ) with check (
    public.current_role() in ('manager','admin')
    and (gym_id is null or gym_id = public.current_gym_id())
  );

grant select on public.sponsors to anon, authenticated;
grant insert, update, delete on public.sponsors to authenticated;
