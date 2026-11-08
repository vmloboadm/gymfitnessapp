-- 087_whatsapp_treino_aplicado.sql
-- Aviso de "seu treino já está no app" para quem ACABOU de receber ficha
-- (aprovação automática ou mutirão do personal). Fecha o ciclo: o aluno foi
-- liberado, tem treino, e recebe o link direto para começar.
--
-- Não usa o texto de "escolha seu treino": quem já tem ficha não escolhe.
-- Mesmas proteções: 2 por lote, 9h–20h, sem domingo, teto diário no drip.

create or replace function public.treino_aplicado_message(p_first text, p_variant integer)
returns text
language sql
immutable
as $function$
  select case p_variant % 3
    when 0 then
      'Oi, ' || p_first || '! Seu treino já está liberado no app 💪' || chr(10) || chr(10) ||
      'Abre aqui que ele já aparece pronto pra você começar:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Qualquer dúvida me chama.'
    when 1 then
      'E aí, ' || p_first || '! Já deixei seu treino pronto no app.' || chr(10) || chr(10) ||
      'É só abrir e começar:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Depois me conta o que achou do primeiro treino.'
    else
      'Oi, ' || p_first || '! Tudo certo?' || chr(10) || chr(10) ||
      'Seu treino já está no app, com os exercícios e as séries certinhas:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Bora começar essa semana? 💪'
  end;
$function$;

create or replace function public.enqueue_treino_aplicado(p_gym uuid, p_start timestamptz default now())
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
          and sw.assigned_at > now() - interval '3 days'
      )
      and not exists (
        select 1 from public.whatsapp_outbox x
        where x.campaign = 'treino-aplicado' and x.student_id = p.id
      )
    order by p.approved_at desc nulls last
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
    values (p_gym, r.id, 'treino-aplicado', phone,
      public.treino_aplicado_message(first, i),
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

revoke all on function public.enqueue_treino_aplicado(uuid, timestamptz) from public, anon, authenticated;

-- enfileira agora quem acabou de receber ficha
select public.enqueue_treino_aplicado('00000000-0000-0000-0000-000000000001', now());
