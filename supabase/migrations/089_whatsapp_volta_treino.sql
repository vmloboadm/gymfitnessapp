-- 089_whatsapp_volta_treino.sql
-- Toque de retomada para quem JÁ TEM ficha e parou: 5 dias sem check-in.
-- É o público que mais importa agora: aluno com treino na mão que não voltou.
--
-- Campanha mensal ('volta-treino:AAAA-MM') para poder repetir no mês seguinte
-- sem duplicar. Mesmas proteções: 2 por lote, 9h–20h, sem domingo, teto no drip.

create or replace function public.volta_treino_message(p_first text, p_variant integer)
returns text
language sql
immutable
as $function$
  select case p_variant % 3
    when 0 then
      'Oi, ' || p_first || '! Senti sua falta por aqui 😊' || chr(10) || chr(10) ||
      'Seu treino está no app, pronto pra quando você voltar:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Me diz o que está pegando que eu te ajudo.'
    when 1 then
      'E aí, ' || p_first || ', tudo bem? Faz uns dias que você não treina.' || chr(10) || chr(10) ||
      'Sem cobrança, só queria saber se está tudo certo e se posso ajudar:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino'
    else
      'Oi, ' || p_first || '! Bora retomar essa semana? 💪' || chr(10) || chr(10) ||
      'Seu treino já está montado, é só abrir:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Se preferir outro horário ou outro treino, me fala aqui.'
  end;
$function$;

create or replace function public.enqueue_volta_treino(p_gym uuid, p_start timestamptz default now())
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
  v_campaign text := 'volta-treino:' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
begin
  for r in
    select p.id, p.name, p.phone
    from public.profiles p
    where p.gym_id = p_gym
      and p.role = 'student'
      and p.approved_at is not null
      and coalesce(p.medical_risk, false) = false
      and coalesce(p.status, 'active') = 'active'
      and coalesce(p.whatsapp_consent, false)
      and p.phone is not null
      and exists (
        select 1 from public.student_workouts sw
        where sw.student_id = p.id and sw.status = 'active'
          and sw.assigned_at < now() - interval '5 days'
      )
      and not exists (
        select 1 from public.checkins c
        where c.student_id = p.id and c.checked_at > now() - interval '5 days'
      )
      and not exists (
        select 1 from public.whatsapp_outbox x
        where x.campaign = v_campaign and x.student_id = p.id
      )
    order by p.name
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
      public.volta_treino_message(first, i),
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

revoke all on function public.enqueue_volta_treino(uuid, timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'volta-treino') then
      perform cron.unschedule('volta-treino');
    end if;
    -- 8h40 de São Paulo = 11h40 UTC
    perform cron.schedule(
      'volta-treino',
      '40 11 * * *',
      $cron$select public.enqueue_volta_treino('00000000-0000-0000-0000-000000000001', now())$cron$
    );
  end if;
exception when others then
  raise warning 'pg_cron indisponível: %', sqlerrm;
end $$;

-- enfileira agora os 9 parados
select public.enqueue_volta_treino('00000000-0000-0000-0000-000000000001', now());
