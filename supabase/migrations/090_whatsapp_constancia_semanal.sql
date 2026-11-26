-- 090_whatsapp_constancia_semanal.sql
-- Campanha semanal de constância: 1 mensagem por semana para quem TREINOU.
-- Substitui o convite do desafio na fila (o desafio já tem 9 participantes e
-- convidar quem não tem ficha não converte).
--
-- Regra: aprovado, ativo, sem laudo, com ficha ativa, consentimento e pelo menos
-- 1 dia de check-in nos últimos 7 dias. Nada de cobrança para quem não veio
-- (esse público é da volta-treino, mensal).
--
-- Campanha semanal ('constancia:AAAA-Www') para poder repetir toda semana sem
-- duplicar. Mesmas proteções do drip: 2 por lote, 9h–20h, sem domingo, teto diário.

create or replace function public.constancia_message(
  p_first text,
  p_n integer,
  p_pos integer,
  p_variant integer
)
returns text
language sql
immutable
as $function$
  select case
    when p_pos between 1 and 5 then
      'Oi, ' || p_first || '! Você treinou ' || p_n || 'x essa semana e tá no top ' || p_pos ||
      ' do ranking 💪' || chr(10) || chr(10) ||
      'Bora manter a sequência?' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/ranking'
    when p_variant % 2 = 0 then
      'Oi, ' || p_first || '! ' || p_n || ' treino' || case when p_n = 1 then '' else 's' end ||
      ' essa semana. Tá indo bem!' || chr(10) || chr(10) ||
      'Quer ver como tá o ranking da academia?' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/ranking'
    else
      p_first || ', ' || p_n || ' treino' || case when p_n = 1 then '' else 's' end ||
      ' essa semana 💪' || chr(10) || chr(10) ||
      'Seu nome tá no ranking:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/ranking'
  end;
$function$;

create or replace function public.enqueue_constancia_semanal(p_gym uuid, p_start timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  r record;
  i integer := 0;
  slot timestamptz := public.next_business_slot(p_start);
  batch_start timestamptz;
  phone text;
  first text;
  n integer := 0;
  v_campaign text := 'constancia:' || to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-"W"IW');
begin
  for r in
    with dias as (
      select c.student_id,
             count(distinct (c.checked_at at time zone 'America/Sao_Paulo')::date) filtro_n
      from public.checkins c
      where c.gym_id = p_gym
        and c.checked_at > now() - interval '7 days'
      group by c.student_id
    ),
    pontos as (
      select pe.student_id, sum(pe.points) pts
      from public.point_events pe
      where pe.gym_id = p_gym
        and pe.created_at >= (date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
      group by pe.student_id
    ),
    posicao as (
      select student_id, row_number() over (order by pts desc) pos
      from pontos where pts > 0
    )
    select p.id, p.name, p.phone, d.filtro_n, coalesce(pos.pos, 999) pos
    from public.profiles p
    join dias d on d.student_id = p.id
    left join posicao pos on pos.student_id = p.id
    where p.gym_id = p_gym
      and p.role = 'student'
      and p.approved_at is not null
      and coalesce(p.medical_risk, false) = false
      and coalesce(p.status, 'active') = 'active'
      and coalesce(p.whatsapp_consent, false)
      and p.phone is not null
      and d.filtro_n >= 1
      and exists (
        select 1 from public.student_workouts sw
        where sw.student_id = p.id and sw.status = 'active'
      )
      and not exists (
        select 1 from public.whatsapp_outbox x
        where x.campaign = v_campaign and x.student_id = p.id
      )
    order by d.filtro_n desc, p.name
  loop
    phone := regexp_replace(regexp_replace(r.phone, '\D', '', 'g'), '^0+', '');
    if length(phone) in (10, 11) then phone := '55' || phone; end if;
    if not (phone like '55%' and length(phone) in (12, 13)) then continue; end if;

    if i % 2 = 0 then
      if i > 0 then
        slot := slot + interval '2 hours' + random() * interval '3 hours';
      end if;
      slot := slot + random() * interval '50 minutes';
      slot := public.next_business_slot(slot);
      if extract(hour from (slot at time zone 'America/Sao_Paulo')) >= 19 then
        slot := public.next_business_slot(slot + interval '3 hours');
      end if;
      batch_start := slot;
    end if;

    first := initcap(lower(split_part(coalesce(nullif(trim(r.name), ''), 'tudo bem'), ' ', 1)));
    insert into public.whatsapp_outbox (gym_id, student_id, campaign, phone, body, scheduled_at)
    values (p_gym, r.id, v_campaign, phone,
      public.constancia_message(first, r.filtro_n::int, r.pos::int, i),
      batch_start + case
        when i % 2 = 1 then interval '2 minutes' + random() * interval '7 minutes'
        else interval '0'
      end)
    on conflict (campaign, student_id) do nothing;
    i := i + 1;
    n := n + 1;
  end loop;
  return n;
end;
$function$;

revoke all on function public.enqueue_constancia_semanal(uuid, timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'constancia-semanal') then
      perform cron.unschedule('constancia-semanal');
    end if;
    -- segunda-feira, 9h de São Paulo = 12h UTC
    perform cron.schedule(
      'constancia-semanal',
      '0 12 * * 1',
      $cron$select public.enqueue_constancia_semanal('00000000-0000-0000-0000-000000000001', now())$cron$
    );
  end if;
exception when others then
  raise warning 'pg_cron indisponível: %', sqlerrm;
end $$;
