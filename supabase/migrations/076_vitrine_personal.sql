-- 076_vitrine_personal.sql
-- Vitrine do personal (fase 1 do docs/VISAO-E-ROADMAP.md): planos de
-- acompanhamento no perfil do personal. O aluno escolhe um plano e chama no
-- WhatsApp com plano e preço; o pedido fica registrado e avisa só ele.
-- Sem pagamento ainda: é o mesmo modelo que o checkout (PagBank) vai usar.

create table if not exists public.personal_offers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 80),
  description text check (description is null or length(description) <= 400),
  -- null = "valor a combinar"
  price_cents integer check (price_cents is null or price_cents between 0 and 10000000),
  sessions_per_week integer check (sessions_per_week is null or sessions_per_week between 1 and 7),
  duration_label text check (duration_label is null or length(duration_label) <= 40),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_offers_trainer_idx on public.personal_offers (trainer_id, active, sort);

alter table public.personal_offers enable row level security;

-- leitura: qualquer pessoa da mesma academia vê os ativos; o dono vê todos os seus
drop policy if exists personal_offers_select on public.personal_offers;
create policy personal_offers_select on public.personal_offers
  for select using (
    gym_id = public.current_gym_id() and (active or trainer_id = auth.uid())
  );

-- escrita: só o próprio personal (ou gestor), nos planos dele/da academia
drop policy if exists personal_offers_insert on public.personal_offers;
create policy personal_offers_insert on public.personal_offers
  for insert with check (
    gym_id = public.current_gym_id()
    and (
      (trainer_id = auth.uid() and public.current_role() in ('trainer', 'manager', 'admin'))
      or public.current_role() in ('manager', 'admin')
    )
  );

drop policy if exists personal_offers_update on public.personal_offers;
create policy personal_offers_update on public.personal_offers
  for update using (
    gym_id = public.current_gym_id()
    and (trainer_id = auth.uid() or public.current_role() in ('manager', 'admin'))
  ) with check (
    gym_id = public.current_gym_id()
    and (trainer_id = auth.uid() or public.current_role() in ('manager', 'admin'))
  );

drop policy if exists personal_offers_delete on public.personal_offers;
create policy personal_offers_delete on public.personal_offers
  for delete using (
    gym_id = public.current_gym_id()
    and (trainer_id = auth.uid() or public.current_role() in ('manager', 'admin'))
  );

drop trigger if exists trg_personal_offers_updated on public.personal_offers;
create trigger trg_personal_offers_updated
  before update on public.personal_offers
  for each row execute function public.touch_updated_at();

-- "R$ 250,00" ou "valor a combinar"
create or replace function public.fmt_brl(p_cents integer)
returns text
language sql
immutable
as $function$
  select case when p_cents is null then 'valor a combinar'
    else 'R$ ' || replace(to_char(p_cents / 100.0, 'FM9999990.00'), '.', ',') end;
$function$;

-- ---------------------------------------------------------------------------
-- Personais da academia, agora com os planos ativos de cada um
create or replace function public.gym_personals()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  with me as (select gym_id from public.profiles where id = auth.uid()),
  staff as (
    select p.id, p.name, p.bio, p.avatar_url, p.phone, p.role, p.created_at
    from public.profiles p, me
    where p.gym_id = me.gym_id and p.role in ('trainer', 'manager', 'admin')
  ),
  pick as (
    select * from staff where role = 'trainer'
    union all
    select * from staff where role <> 'trainer' and not exists (select 1 from staff where role = 'trainer')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', pick.id, 'name', pick.name, 'bio', pick.bio, 'avatar_url', pick.avatar_url,
      'phone', pick.phone, 'role', pick.role,
      'offers', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', o.id, 'title', o.title, 'description', o.description,
            'price_cents', o.price_cents, 'sessions_per_week', o.sessions_per_week,
            'duration_label', o.duration_label
          ) order by o.sort, o.created_at), '[]'::jsonb)
        from public.personal_offers o
        where o.trainer_id = pick.id and o.active
      )
    ) order by pick.created_at), '[]'::jsonb)
  from pick;
$function$;

grant execute on function public.gym_personals() to authenticated;

-- ---------------------------------------------------------------------------
-- Pedido de acompanhamento, agora com plano opcional
drop function if exists public.request_coaching(uuid, text);

create or replace function public.request_coaching(
  p_trainer uuid,
  p_message text default null,
  p_offer uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  st record;
  tr record;
  v_offer_title text;
  v_offer_price integer;
  v_has_offer boolean := false;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
  v_plan text := '';
begin
  select id, gym_id, name, role into st from public.profiles where id = v_uid;
  if st.id is null or st.role <> 'student' then
    raise exception 'Sem permissão';
  end if;

  select id, name, phone into tr from public.profiles
  where id = p_trainer and gym_id = st.gym_id and role in ('trainer', 'manager', 'admin');
  if tr.id is null then
    raise exception 'Personal não encontrado';
  end if;

  if p_offer is not null then
    select title, price_cents, true into v_offer_title, v_offer_price, v_has_offer
    from public.personal_offers
    where id = p_offer and trainer_id = tr.id and gym_id = st.gym_id and active;
    if not coalesce(v_has_offer, false) then
      raise exception 'Plano indisponível';
    end if;
    v_plan := ' · ' || v_offer_title || ' · ' || public.fmt_brl(v_offer_price);
  end if;

  perform set_config('gf.request_notified', '1', true);
  insert into public.premium_requests (gym_id, student_id, request_type, details, status)
  values (st.gym_id, v_uid, 'other',
    '[acompanhamento] (com ' || coalesce(tr.name, 'personal') || v_plan || ')' || coalesce(' ' || left(v_msg, 300), ''),
    'pending');
  perform set_config('gf.request_notified', '', true);

  insert into public.notifications (gym_id, user_id, channel, title, body)
  values (st.gym_id, tr.id, 'in_app', 'Pedido de acompanhamento',
    coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' quer acompanhamento com você'
    || case when v_has_offer then ' no plano "' || v_offer_title || '" (' || public.fmt_brl(v_offer_price) || ')' else '' end
    || coalesce(': ' || left(v_msg, 120), '.') || ' Ele deve te chamar no WhatsApp agora.');

  return jsonb_build_object('ok', true, 'phone', tr.phone, 'name', tr.name,
    'offer', case when v_has_offer then v_offer_title end);
end;
$function$;

grant execute on function public.request_coaching(uuid, text, uuid) to authenticated;
