-- 086_whatsapp_link_e_aprovacao.sql
-- Correções de rota na campanha de treino:
--
--   1. O CTA de conversa passa a levar TAMBÉM o link do app (/app/treino),
--      onde o aluno sem ficha escolhe o treino e começa na hora. Conversa
--      e link juntos: quem responde continua a conversa, quem só quer
--      treinar resolve sozinho.
--   2. Ninguém entra na campanha (nem recebe) sem cadastro aprovado e sem
--      laudo pendente. Era isso que fazia o aluno receber "seu treino está
--      pronto" e o app responder "aguardando aprovação".
--   3. Fila de retomada: quem recebeu e, 2 dias depois, segue sem ficha e
--      sem check-in recebe UM lembrete com o link. Mesmo teto e horários.
--
-- Regras de proteção do número continuam: 2 por lote, 9h–20h, sem domingo,
-- teto diário no drip, freio de falhas, 6 variações girando.

-- --------------------------------------------------- mensagem (6 variações)
create or replace function public.starter_campaign_message(p_first text, p_variant integer)
returns text
language sql
immutable
as $function$
  select case p_variant % 6
    when 0 then
      'Oi, ' || p_first || '! Seu treino já está pronto no app 😊' || chr(10) || chr(10) ||
      'São treinos montados pela nossa personal (AB, ABC, ABCD e ABCDE). Escolhe o seu aqui:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Depois me diz qual você escolheu que eu acompanho.'
    when 1 then
      'E aí, ' || p_first || '! Você prefere treinar 2, 3 ou 4 vezes por semana? 💪' || chr(10) || chr(10) ||
      'Já deixei os treinos prontos no app pra você escolher:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Me responde aqui a frequência que eu te ajudo a escolher o melhor.'
    when 2 then
      'Oi, ' || p_first || '! Final de ano chegando e a meta é chegar bem no verão 🔥' || chr(10) || chr(10) ||
      'Seu treino já está no app:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Me conta: o foco é emagrecer, ganhar força ou voltar ao ritmo?'
    when 3 then
      'E aí, ' || p_first || ', beleza? 😃' || chr(10) || chr(10) ||
      'Seu treino novo está pronto. Escolhe por aqui:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Depois me diz qual dia dessa semana você começa.'
    when 4 then
      'Oi, ' || p_first || '! Manhã, tarde ou noite? 💪' || chr(10) || chr(10) ||
      'Escolhe seu treino no app:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Me responde o turno que eu já organizo o seu.'
    else
      'Oi, ' || p_first || '! Você topa entrar no Desafio Verão da academia? 😊' || chr(10) || chr(10) ||
      'É treinar e marcar presença, com ranking e prêmio no final. Escolhe seu treino aqui:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Se quiser, me responde "quero" que eu te explico em 1 minuto.'
  end;
$function$;

-- ------------------------------------- retomada (4 variações, tom de lembrete)
create or replace function public.retomada_campaign_message(p_first text, p_variant integer)
returns text
language sql
immutable
as $function$
  select case p_variant % 4
    when 0 then
      'Oi, ' || p_first || '! Passando pra saber se você conseguiu ver seu treino no app 😊' || chr(10) || chr(10) ||
      'Se ainda não escolheu, é rapidinho:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Me diz se travou em algo que eu te ajudo.'
    when 1 then
      'E aí, ' || p_first || ', tudo bem? Vi que seu treino ainda não foi escolhido.' || chr(10) || chr(10) ||
      'Quer que eu te ajude a escolher? É só abrir aqui:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino'
    when 2 then
      'Oi, ' || p_first || '! Não quero te encher, só não queria que você ficasse sem treino 😊' || chr(10) || chr(10) ||
      'Se ainda quiser, escolhe aqui:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Se preferir, me responde que eu escolho com você.'
    else
      'Fala, ' || p_first || '! Seu treino tá te esperando no app:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Qualquer dúvida me chama aqui que a gente resolve junto 💪'
  end;
$function$;

-- ------------------------------------- quem pode ser convidado (aprovado etc.)
create or replace function public.pode_receber_campanha_treino(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = p_student
      and p.role = 'student'
      and p.approved_at is not null
      and coalesce(p.medical_risk, false) = false
      and coalesce(p.status, 'active') = 'active'
      and coalesce(p.whatsapp_consent, false)
      and p.phone is not null
  );
$function$;

-- ------------------------------------- novos alunos: mesmo espaçamento natural
create or replace function public.enqueue_starter_campaign(p_gym uuid, p_start timestamptz default now())
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
    where p.gym_id = p_gym and p.role = 'student'
      and p.approved_at is not null
      and coalesce(p.medical_risk, false) = false
      and coalesce(p.status, 'active') = 'active'
      and coalesce(p.whatsapp_consent, false)
      and p.phone is not null
      and not exists (select 1 from public.student_workouts sw where sw.student_id = p.id and sw.status = 'active')
      and not exists (select 1 from public.whatsapp_outbox o where o.campaign = 'treino-pronto' and o.student_id = p.id)
    order by p.approved_at desc nulls last, p.created_at desc
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
    values (p_gym, r.id, 'treino-pronto', phone,
      public.starter_campaign_message(first, i),
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

-- ------------------------------------- retomada: recebeu, não escolheu, não veio
create or replace function public.enqueue_retomada_treino(p_gym uuid, p_start timestamptz default now())
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
    join public.whatsapp_outbox o
      on o.student_id = p.id and o.campaign = 'treino-pronto' and o.status = 'sent'
    where p.gym_id = p_gym
      and p.role = 'student'
      and p.approved_at is not null
      and coalesce(p.medical_risk, false) = false
      and coalesce(p.status, 'active') = 'active'
      and coalesce(p.whatsapp_consent, false)
      and p.phone is not null
      and o.sent_at <= now() - interval '2 days'
      and not exists (select 1 from public.student_workouts sw where sw.student_id = p.id and sw.status = 'active')
      and not exists (select 1 from public.checkins c where c.student_id = p.id and c.checked_at > now() - interval '2 days')
      and not exists (select 1 from public.whatsapp_outbox x where x.campaign = 'retomada-treino' and x.student_id = p.id)
    order by o.sent_at
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
    values (p_gym, r.id, 'retomada-treino', phone,
      public.retomada_campaign_message(first, i),
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

revoke all on function public.enqueue_starter_campaign(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.enqueue_retomada_treino(uuid, timestamptz) from public, anon, authenticated;

-- ------------------------------------- reescreve o que está na fila com o link
do $$
declare
  r record;
  i integer := 0;
  first text;
begin
  for r in
    select o.id, o.student_id, p.name
    from public.whatsapp_outbox o
    join public.profiles p on p.id = o.student_id
    where o.campaign = 'treino-pronto' and o.status = 'pending'
    order by o.scheduled_at, o.id
  loop
    first := initcap(lower(split_part(coalesce(nullif(trim(r.name), ''), 'tudo bem'), ' ', 1)));
    update public.whatsapp_outbox
    set body = public.starter_campaign_message(first, i)
    where id = r.id;
    i := i + 1;
  end loop;
end $$;

-- ------------------------------------- retomada diária (8h55 de São Paulo)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'retomada-treino') then
      perform cron.unschedule('retomada-treino');
    end if;
    -- 8h55 de São Paulo = 11h55 UTC
    perform cron.schedule(
      'retomada-treino',
      '55 11 * * *',
      $cron$select public.enqueue_retomada_treino('00000000-0000-0000-0000-000000000001', now())$cron$
    );
  end if;
exception when others then
  raise warning 'pg_cron indisponível: %', sqlerrm;
end $$;
