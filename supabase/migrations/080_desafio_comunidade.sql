-- 080_desafio_comunidade.sql
-- Desafio como comunidade: convite pelo WhatsApp para quem ainda não entrou
-- (mesma fila segura da 077), "dar força" entre participantes e post
-- semanal no feed com o Top 3 (pg_cron, segunda 9h).

-- Mensagens do convite (variam para não parecer disparo)
create or replace function public.challenge_campaign_message(p_first text, p_title text, p_goal integer, p_ends date, p_variant integer)
returns text
language sql
immutable
as $function$
  select case p_variant % 3
    when 0 then
      'Oi, ' || p_first || '! Aqui é da GymFitness ☀️' || chr(10) || chr(10) ||
      'Começou o ' || p_title || ': meta de ' || p_goal || ' dias de treino até ' || to_char(p_ends, 'DD/MM') ||
      ', com ranking ao vivo no app e prêmio pros primeiros. Cada treino ou check-in conta!' || chr(10) || chr(10) ||
      'Entra com 1 toque aqui 👇' || chr(10) || 'https://gymfitnesscampos.com.br/app' || chr(10) || chr(10) ||
      'Bora fechar o ano no ritmo? 💪'
    when 1 then
      'E aí, ' || p_first || '! Tudo certo? 😄' || chr(10) || chr(10) ||
      'A galera da GymFitness já tá no ' || p_title || ' e o ranking tá pegando fogo 🔥 São ' || p_goal ||
      ' dias de treino até ' || to_char(p_ends, 'DD/MM') || ' e prêmio pro Top 3.' || chr(10) || chr(10) ||
      'Entra lá no app e mostra quem manda:' || chr(10) || 'https://gymfitnesscampos.com.br/app'
    else
      'Oi, ' || p_first || ', tudo bem? Passando pra te chamar pro ' || p_title || ' da GymFitness ☀️' || chr(10) || chr(10) ||
      'É simples: treinou ou fez check-in, conta 1 dia. Meta de ' || p_goal || ' dias até ' || to_char(p_ends, 'DD/MM') ||
      ', ranking no app e prêmio no final.' || chr(10) || chr(10) ||
      'Topa? É só entrar aqui:' || chr(10) || 'https://gymfitnesscampos.com.br/app'
  end;
$function$;

create or replace function public.enqueue_challenge_campaign(p_gym uuid, p_challenge uuid, p_start timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  c record;
  r record;
  i integer := 0;
  slot timestamptz := public.next_business_slot(p_start);
  batch_start timestamptz;
  phone text;
  first text;
  camp text := 'desafio:' || p_challenge;
begin
  select * into c from public.challenges where id = p_challenge and gym_id = p_gym;
  if c.id is null then
    raise exception 'Desafio não encontrado';
  end if;
  for r in
    select p.id, p.name, p.phone from public.profiles p
    where p.gym_id = p_gym and p.role = 'student'
      and coalesce(p.whatsapp_consent, false) and p.phone is not null
      and not exists (select 1 from public.challenge_participants cp where cp.challenge_id = c.id and cp.student_id = p.id)
      and not exists (select 1 from public.whatsapp_outbox o where o.campaign = camp and o.student_id = p.id)
    order by p.approved_at desc nulls last, p.created_at desc
  loop
    phone := regexp_replace(regexp_replace(r.phone, '\D', '', 'g'), '^0+', '');
    if length(phone) in (10, 11) then phone := '55' || phone; end if;
    if not (phone like '55%' and length(phone) in (12, 13)) then continue; end if;

    if i % 2 = 0 then
      if i > 0 then slot := slot + interval '3 hours' + (random() * interval '40 minutes'); end if;
      slot := public.next_business_slot(slot);
      if extract(hour from (slot at time zone 'America/Sao_Paulo')) >= 19 then
        slot := public.next_business_slot(slot + interval '2 hours');
      end if;
      batch_start := slot;
    end if;

    first := initcap(lower(split_part(coalesce(nullif(trim(r.name), ''), 'tudo bem'), ' ', 1)));
    insert into public.whatsapp_outbox (gym_id, student_id, campaign, phone, body, scheduled_at)
    values (p_gym, r.id, camp, phone,
      public.challenge_campaign_message(first, c.title, c.goal_days, c.ends_on, i),
      batch_start + case when i % 2 = 1 then interval '3 minutes' + random() * interval '5 minutes' else interval '0' end)
    on conflict (campaign, student_id) do nothing;
    i := i + 1;
  end loop;
  return i;
end;
$function$;

revoke all on function public.enqueue_challenge_campaign(uuid, uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------- dar força
create table if not exists public.challenge_cheers (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  created_at timestamptz not null default now(),
  primary key (challenge_id, from_id, to_id, day)
);
alter table public.challenge_cheers enable row level security;
revoke all on public.challenge_cheers from anon, authenticated;

create or replace function public.challenge_cheer(p_challenge uuid, p_to uuid)
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
begin
  select id, gym_id, role into st from public.profiles where id = v_uid;
  if st.id is null or st.role <> 'student' then raise exception 'Sem permissão'; end if;
  if p_to = v_uid then return jsonb_build_object('ok', false, 'reason', 'voce_mesmo'); end if;
  select * into c from public.challenges where id = p_challenge and gym_id = st.gym_id;
  if c.id is null then return jsonb_build_object('ok', false, 'reason', 'indisponivel'); end if;
  if not exists (select 1 from public.challenge_participants where challenge_id = c.id and student_id = p_to) then
    return jsonb_build_object('ok', false, 'reason', 'nao_participa');
  end if;

  insert into public.challenge_cheers (challenge_id, from_id, to_id) values (c.id, v_uid, p_to)
  on conflict do nothing;
  if not found then return jsonb_build_object('ok', false, 'reason', 'ja_deu_hoje'); end if;

  n := public.athlete_display(v_uid);
  insert into public.notifications (gym_id, user_id, channel, title, body)
  values (st.gym_id, p_to, 'in_app', 'Força no desafio 💪',
    n.disp || ' te deu força no ' || c.title || '! Bora treinar hoje?');
  return jsonb_build_object('ok', true);
end;
$function$;

grant execute on function public.challenge_cheer(uuid, uuid) to authenticated;

-- --------------------------------------------- post semanal com Top 3
create or replace function public.post_challenge_weekly_updates()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  c record;
  v_author uuid;
  v_total integer;
  v_top text;
  v_left integer;
  n integer := 0;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  for c in select * from public.challenges where active and today between starts_on and ends_on loop
    select count(*) into v_total from public.challenge_participants where challenge_id = c.id;
    if v_total = 0 then continue; end if;

    select string_agg(x.pos || 'º ' || x.disp || ' (' || x.days || case when x.days = 1 then ' dia)' else ' dias)' end, chr(10) order by x.pos)
      into v_top
    from (
      select row_number() over (order by d.days desc, d.disp) as pos, d.disp, d.days
      from (
        select (public.athlete_display(cp.student_id)).disp as disp,
          (select count(distinct dd) from (
             select public.local_day(wl.date) dd from public.workout_logs wl where wl.student_id = cp.student_id
             union select public.local_day(ck.checked_at) from public.checkins ck where ck.student_id = cp.student_id and ck.type = 'entrada'
           ) z where z.dd between c.starts_on and today)::int as days
        from public.challenge_participants cp where cp.challenge_id = c.id
      ) d
    ) x where x.pos <= 3;

    select id into v_author from public.profiles
    where gym_id = c.gym_id and role in ('manager', 'admin', 'trainer')
    order by (role = 'manager') desc, created_at limit 1;
    if v_author is null then continue; end if;

    v_left := c.ends_on - today;
    perform set_config('gf.system_post', '1', true);
    insert into public.feed_posts (gym_id, author_id, type, body, expires_at)
    values (c.gym_id, v_author, 'desafio',
      '☀️ ' || c.title || ' · parcial da semana' || chr(10) || chr(10) || v_top || chr(10) || chr(10) ||
      v_total || case when v_total = 1 then ' pessoa' else ' pessoas' end || ' no desafio · faltam ' || v_left || ' dias. '
      || 'Ainda dá tempo de entrar e subir no ranking! 💪',
      now() + interval '14 days');
    perform set_config('gf.system_post', '', true);
    n := n + 1;
  end loop;
  return n;
end;
$function$;

revoke all on function public.post_challenge_weekly_updates() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'challenge-weekly-post') then
      perform cron.unschedule('challenge-weekly-post');
    end if;
    -- segunda 9h de São Paulo = 12h UTC
    perform cron.schedule('challenge-weekly-post', '0 12 * * 1', 'select public.post_challenge_weekly_updates();');
  end if;
exception when others then
  raise warning 'pg_cron indisponível: %', sqlerrm;
end $$;
