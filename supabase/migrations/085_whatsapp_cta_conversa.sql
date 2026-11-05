-- 085_whatsapp_cta_conversa.sql
-- A campanha "treino pronto" deixa de empurrar o aluno para o app e passa a
-- pedir RESPOSTA no WhatsApp — o objetivo é abrir conversa (e relacionamento
-- com follow-up), não só clique.
--
-- Regras que continuam valendo (proteção do número):
--   - 2 mensagens por lote, 9h–20h, sem domingo, teto diário de 25 no drip;
--   - nenhum link nas mensagens (o CTA é responder aqui);
--   - 6 variações, girando por aluno, para não repetir o mesmo texto seguido;
--   - horários menos previsíveis: intervalo de 2h a 5h entre lotes, minuto
--     aleatório, dupla com 2 a 9 minutos de diferença.

-- ------------------------------------------------------- mensagem (6 variações)
create or replace function public.starter_campaign_message(p_first text, p_variant integer)
returns text
language sql
immutable
as $function$
  select case p_variant % 6
    when 0 then
      'Oi, ' || p_first || '! Tudo bem? 😊 Aqui é a equipe da GymFitness.' || chr(10) || chr(10) ||
      'Seu treino já está montado e separado aqui com a gente. Você prefere que eu te mande ele por aqui mesmo ou quer escolher no app? Me responde 1 ou 2 que eu já resolvo pra você 💪'
    when 1 then
      'E aí, ' || p_first || '! Como você tá? 💪' || chr(10) || chr(10) ||
      'Tô passando pra saber uma coisa rápida: você prefere treinar 2, 3 ou 4 vezes por semana? Com essa resposta eu já ajusto o seu treino e te mando ainda hoje.'
    when 2 then
      'Oi, ' || p_first || '! Final de ano chegando e a meta é chegar bem no verão 🔥' || chr(10) || chr(10) ||
      'Seu treino já está pronto. Me conta: você quer focar em emagrecer, ganhar força ou só voltar ao ritmo? Eu te respondo aqui com o treino certo pra você.'
    when 3 then
      'E aí, ' || p_first || ', beleza? 😃' || chr(10) || chr(10) ||
      'Seu treino novo tá pronto aqui. Só me diz uma coisa: qual dia dessa semana você consegue começar? Eu deixo tudo separado pra você chegar e treinar sem perder tempo.'
    when 4 then
      'Oi, ' || p_first || '! Aqui é da GymFitness 💪' || chr(10) || chr(10) ||
      'Vi que seu treino já está pronto. Você prefere treinar de manhã, à tarde ou à noite? Me responde que eu já organizo o seu e te mando por aqui mesmo.'
    else
      'Oi, ' || p_first || '! Tudo certo? 😊' || chr(10) || chr(10) ||
      'Você topa entrar no Desafio Verão da academia? É treinar e marcar presença, com ranking e prêmio no final. Se quiser, eu te explico em 1 minuto por aqui — só responder "quero" 🔥'
  end;
$function$;

-- ---------------------------------------- reagenda + reescreve o que está na fila
do $$
declare
  r record;
  i integer := 0;
  slot timestamptz := public.next_business_slot(now() + interval '20 minutes');
  batch timestamptz := slot;
  first text;
begin
  for r in
    select o.id, o.student_id, p.name
    from public.whatsapp_outbox o
    join public.profiles p on p.id = o.student_id
    where o.campaign = 'treino-pronto' and o.status = 'pending'
    order by o.scheduled_at, o.id
  loop
    if i % 2 = 0 then
      if i > 0 then
        -- intervalo natural: 2h a 5h entre lotes
        slot := slot + interval '2 hours' + random() * interval '3 hours';
      end if;
      -- minuto aleatório (0–50) em vez de sempre na mesma hora cheia
      slot := slot + random() * interval '50 minutes';
      slot := public.next_business_slot(slot);
      -- lote que cairia perto das 20h vai para a manhã seguinte
      if extract(hour from (slot at time zone 'America/Sao_Paulo')) >= 19 then
        slot := public.next_business_slot(slot + interval '3 hours');
      end if;
      batch := slot;
    end if;

    first := initcap(lower(split_part(coalesce(nullif(trim(r.name), ''), 'tudo bem'), ' ', 1)));
    update public.whatsapp_outbox
    set body = public.starter_campaign_message(first, i),
        scheduled_at = batch + case
          when i % 2 = 1 then interval '2 minutes' + random() * interval '7 minutes'
          else interval '0'
        end
    where id = r.id;

    i := i + 1;
  end loop;
end $$;

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

revoke all on function public.enqueue_starter_campaign(uuid, timestamptz) from public, anon, authenticated;
