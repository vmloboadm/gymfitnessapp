-- 079_campanhas_fim_de_ano.sql
-- Fim de ano: Desafio Verão (entrar com 1 toque, ranking por dias treinados),
-- cards de campanha na Home (Black Friday etc., com prazo) e preço
-- promocional com prazo nos planos dos personais.

-- ---------------------------------------------------------------- desafios
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  description text,
  starts_on date not null,
  ends_on date not null,
  goal_days integer not null check (goal_days between 1 and 366),
  prize_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, student_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges
  for select using (gym_id = public.current_gym_id());
drop policy if exists challenges_staff_write on public.challenges;
create policy challenges_staff_write on public.challenges
  for all using (gym_id = public.current_gym_id() and public.current_role() in ('trainer', 'manager', 'admin'))
  with check (gym_id = public.current_gym_id() and public.current_role() in ('trainer', 'manager', 'admin'));

-- participantes: visíveis para a academia; entrar só pela função
drop policy if exists challenge_participants_select on public.challenge_participants;
create policy challenge_participants_select on public.challenge_participants
  for select using (gym_id = public.current_gym_id());

create or replace function public.join_challenge(p_challenge uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  st record;
  c record;
  n record;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select id, gym_id, role into st from public.profiles where id = v_uid;
  if st.id is null or st.role <> 'student' then
    raise exception 'Sem permissão';
  end if;
  select * into c from public.challenges where id = p_challenge and gym_id = st.gym_id and active;
  if c.id is null then
    return jsonb_build_object('ok', false, 'reason', 'indisponivel');
  end if;
  if today > c.ends_on then
    return jsonb_build_object('ok', false, 'reason', 'encerrado');
  end if;

  insert into public.challenge_participants (challenge_id, student_id, gym_id)
  values (c.id, v_uid, st.gym_id)
  on conflict do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ja_participa');
  end if;

  n := public.athlete_display(v_uid);
  perform public.system_feed_post(st.gym_id, v_uid,
    n.disp || ' entrou no ' || c.title || ' 🔥 Meta: ' || c.goal_days || ' dias de treino até '
    || to_char(c.ends_on, 'DD/MM') || '. Bora junto? Entra também pelo app!');
  insert into public.notifications (gym_id, user_id, channel, title, body)
  values (st.gym_id, v_uid, 'in_app', 'Você está no ' || c.title,
    'Meta: ' || c.goal_days || ' dias de treino até ' || to_char(c.ends_on, 'DD/MM')
    || '. Cada dia treinado conta no ranking. Bora!');

  return jsonb_build_object('ok', true);
end;
$function$;

grant execute on function public.join_challenge(uuid) to authenticated;

-- Ranking: dias distintos com treino registrado OU check-in, dentro do período
create or replace function public.challenge_board(p_challenge uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  with me as (select id, gym_id from public.profiles where id = auth.uid()),
  c as (
    select ch.* from public.challenges ch, me where ch.id = p_challenge and ch.gym_id = me.gym_id
  ),
  part as (
    select cp.student_id from public.challenge_participants cp, c where cp.challenge_id = c.id
  ),
  days as (
    select x.sid, count(distinct x.d)::int as days
    from (
      select wl.student_id sid, public.local_day(wl.date) d
      from public.workout_logs wl join part on part.student_id = wl.student_id
      union
      select ck.student_id, public.local_day(ck.checked_at)
      from public.checkins ck join part on part.student_id = ck.student_id
      where ck.type = 'entrada'
    ) x, c
    where x.d between c.starts_on and least(c.ends_on, (now() at time zone 'America/Sao_Paulo')::date)
    group by x.sid
  ),
  ranked as (
    select part.student_id as id, coalesce(days.days, 0) as days,
      rank() over (order by coalesce(days.days, 0) desc) as rk,
      (part.student_id = (select id from me)) as is_me
    from part left join days on days.sid = part.student_id
  )
  select jsonb_build_object(
    'participants', (select count(*) from part),
    'joined', exists (select 1 from part where student_id = (select id from me)),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id, 'name', (public.athlete_display(r.id)).disp,
          'avatar_url', p.avatar_url, 'days', r.days, 'rank', r.rk, 'me', r.is_me
        ) order by r.rk, (public.athlete_display(r.id)).disp)
      from ranked r join public.profiles p on p.id = r.id
      where r.rk <= 50 or r.is_me
    ), '[]'::jsonb)
  )
  where exists (select 1 from c);
$function$;

grant execute on function public.challenge_board(uuid) to authenticated;

-- ------------------------------------------------------- cards de campanha
create table if not exists public.promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  kind text not null default 'oferta' check (kind in ('oferta', 'desafio')),
  badge text,
  title text not null,
  subtitle text,
  cta_label text,
  -- whatsapp_gym: abre o WhatsApp da academia com cta_value; personal: abre a
  -- vitrine dos personais; challenge: entra no desafio challenge_id; link: cta_value
  cta_type text not null default 'whatsapp_gym' check (cta_type in ('whatsapp_gym', 'personal', 'challenge', 'link')),
  cta_value text,
  challenge_id uuid references public.challenges(id) on delete set null,
  theme text not null default 'black' check (theme in ('black', 'verao', 'brand')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.promo_campaigns enable row level security;

drop policy if exists promo_campaigns_select on public.promo_campaigns;
create policy promo_campaigns_select on public.promo_campaigns
  for select using (
    gym_id = public.current_gym_id()
    and (
      (active and now() between starts_at and ends_at)
      or public.current_role() in ('trainer', 'manager', 'admin')
    )
  );
drop policy if exists promo_campaigns_staff_write on public.promo_campaigns;
create policy promo_campaigns_staff_write on public.promo_campaigns
  for all using (gym_id = public.current_gym_id() and public.current_role() in ('trainer', 'manager', 'admin'))
  with check (gym_id = public.current_gym_id() and public.current_role() in ('trainer', 'manager', 'admin'));

-- ----------------------------------------- preço promocional nos planos
alter table public.personal_offers
  add column if not exists promo_price_cents integer check (promo_price_cents is null or promo_price_cents between 0 and 10000000),
  add column if not exists promo_label text check (promo_label is null or length(promo_label) <= 30),
  add column if not exists promo_until date;

create or replace function public.offer_promo_valid(p_promo integer, p_until date)
returns boolean
language sql
stable
as $function$
  select p_promo is not null and p_until is not null
    and p_until >= (now() at time zone 'America/Sao_Paulo')::date;
$function$;

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
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', staff.id, 'name', staff.name, 'bio', staff.bio, 'avatar_url', staff.avatar_url,
      'phone', staff.phone, 'role', staff.role,
      'offers', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', o.id, 'title', o.title, 'description', o.description,
            'price_cents', o.price_cents, 'sessions_per_week', o.sessions_per_week,
            'duration_label', o.duration_label,
            'promo_price_cents', case when public.offer_promo_valid(o.promo_price_cents, o.promo_until) then o.promo_price_cents end,
            'promo_label', case when public.offer_promo_valid(o.promo_price_cents, o.promo_until) then coalesce(o.promo_label, 'Promoção') end,
            'promo_until', case when public.offer_promo_valid(o.promo_price_cents, o.promo_until) then o.promo_until end
          ) order by o.sort, o.created_at), '[]'::jsonb)
        from public.personal_offers o
        where o.trainer_id = staff.id and o.active
      )
    ) order by (staff.role = 'trainer') desc, staff.created_at), '[]'::jsonb)
  from staff;
$function$;

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
  v_promo integer;
  v_promo_label text;
  v_promo_until date;
  v_has_offer boolean := false;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
  v_plan text := '';
  v_price_txt text;
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
    select title, price_cents, promo_price_cents, promo_label, promo_until, true
      into v_offer_title, v_offer_price, v_promo, v_promo_label, v_promo_until, v_has_offer
    from public.personal_offers
    where id = p_offer and trainer_id = tr.id and gym_id = st.gym_id and active;
    if not coalesce(v_has_offer, false) then
      raise exception 'Plano indisponível';
    end if;
    v_price_txt := case when public.offer_promo_valid(v_promo, v_promo_until)
      then coalesce(v_promo_label, 'Promoção') || ' ' || public.fmt_brl(v_promo) || ' (de ' || public.fmt_brl(v_offer_price) || ')'
      else public.fmt_brl(v_offer_price) end;
    v_plan := ' · ' || v_offer_title || ' · ' || v_price_txt;
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
    || case when v_has_offer then ' no plano "' || v_offer_title || '" (' || v_price_txt || ')' else '' end
    || coalesce(': ' || left(v_msg, 120), '.') || ' Ele deve te chamar no WhatsApp agora.');

  return jsonb_build_object('ok', true, 'phone', tr.phone, 'name', tr.name,
    'offer', case when v_has_offer then v_offer_title end);
end;
$function$;

grant execute on function public.request_coaching(uuid, text, uuid) to authenticated;

-- ---------------------------------------------- campanhas desta academia
do $$
declare g record; ch uuid;
begin
  for g in select id from public.gyms loop
    if not exists (select 1 from public.challenges where gym_id = g.id) then
      insert into public.challenges (gym_id, title, description, starts_on, ends_on, goal_days, prize_text)
      values (g.id, 'Desafio Verão GymFitness',
        'Treine até o verão: cada dia de treino ou check-in conta. Ranking ao vivo no app.',
        '2026-11-03', '2026-12-20', 24,
        'Top 3 ganham prêmio e quem bater a meta ganha brinde da academia')
      returning id into ch;

      insert into public.promo_campaigns
        (gym_id, kind, badge, title, subtitle, cta_label, cta_type, challenge_id, theme, starts_at, ends_at, sort)
      values
        (g.id, 'desafio', 'DESAFIO VERÃO', 'Bora chegar no verão no ritmo?',
         '24 dias de treino até 20/12. Ranking ao vivo e prêmios para o Top 3.',
         'Entrar no desafio', 'challenge', ch, 'verao',
         '2026-11-03 00:00:00-03', '2026-12-20 23:59:59-03', 1),
        (g.id, 'oferta', 'BLACK FRIDAY', 'Black Friday GymFitness',
         'Condições especiais em planos e acompanhamento com personal. Só até 30/11.',
         'Quero a oferta', 'whatsapp_gym', null, 'black',
         '2026-11-17 00:00:00-03', '2026-11-30 23:59:59-03', 2);
      update public.promo_campaigns set cta_value = 'Oi! Vi no app a Black Friday da GymFitness e quero saber as condições 🖤'
      where gym_id = g.id and badge = 'BLACK FRIDAY';
    end if;
  end loop;
end $$;
