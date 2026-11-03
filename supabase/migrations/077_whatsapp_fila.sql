-- 077_whatsapp_fila.sql
-- Fila de WhatsApp da academia (enviada pela VPS, sessão oficial do número
-- da academia no WAHA do CRM). Primeira campanha: "treino pronto" para quem
-- está sem ficha. Cuidado anti-bloqueio: 2 por lote, lotes com ~3h de
-- intervalo e minutos aleatórios, só 9h–20h de São Paulo, nunca repete.
-- Só o service role mexe (o enviador da VPS); o app não enxerga.

create table if not exists public.whatsapp_outbox (
  id bigint generated always as identity primary key,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  campaign text not null,
  phone text not null,
  body text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (campaign, student_id)
);

create index if not exists whatsapp_outbox_due_idx on public.whatsapp_outbox (status, scheduled_at);

alter table public.whatsapp_outbox enable row level security;
revoke all on public.whatsapp_outbox from anon, authenticated;

-- Próximo horário permitido (9h–20h SP) a partir de um instante
create or replace function public.next_business_slot(p_at timestamptz)
returns timestamptz
language plpgsql
stable
as $function$
declare
  l timestamp := p_at at time zone 'America/Sao_Paulo';
begin
  if extract(hour from l) < 9 then
    l := date_trunc('day', l) + interval '9 hours';
  elsif extract(hour from l) >= 20 then
    l := date_trunc('day', l) + interval '1 day 9 hours';
  end if;
  -- domingo não envia: segunda 9h
  if extract(isodow from l) = 7 then
    l := date_trunc('day', l) + interval '1 day 9 hours';
  end if;
  return l at time zone 'America/Sao_Paulo';
end;
$function$;

-- Mensagem personalizada (varia o texto para não parecer disparo em massa)
create or replace function public.starter_campaign_message(p_first text, p_variant integer)
returns text
language sql
immutable
as $function$
  select case p_variant % 3
    when 0 then
      'Oi, ' || p_first || '! Aqui é da GymFitness 💪' || chr(10) || chr(10) ||
      'Seu treino já está pronto pra você escolher no app: tem opções AB, ABC, ABCD e ABCDE montadas pela nossa personal, do iniciante ao avançado. Leva 1 minutinho:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Escolheu, já pode treinar hoje! Qualquer dúvida é só responder aqui 😉'
    when 1 then
      'E aí, ' || p_first || '! Tudo certo? Aqui é da GymFitness.' || chr(10) || chr(10) ||
      'Liberamos treinos prontos no app pra ninguém ficar esperando: você escolhe o que combina com você (iniciante, intermediário ou avançado) e começa na hora 👇' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Depois me conta qual você escolheu! 💪'
    else
      'Oi, ' || p_first || ', tudo bem? 😊 Passando pra avisar que o seu treino na GymFitness já pode ser escolhido no app.' || chr(10) || chr(10) ||
      'São treinos prontos, com divisão certinha (tipo ABC), e se quiser algo sob medida dá pra pedir à personal ali mesmo:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Bora começar essa semana? 🔥'
  end;
$function$;

-- Enfileira a campanha "treino pronto" para a academia. Devolve quantos entraram.
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
    phone := regexp_replace(r.phone, '\D', '', 'g');
    phone := regexp_replace(phone, '^0+', '');
    if length(phone) in (10, 11) then
      phone := '55' || phone;
    end if;
    if not (phone like '55%' and length(phone) in (12, 13)) then
      continue;
    end if;

    -- novo lote a cada 2 pessoas: ~3h depois (+ até 40 min aleatórios)
    if i % 2 = 0 then
      if i > 0 then
        slot := slot + interval '3 hours' + (random() * interval '40 minutes');
      end if;
      slot := public.next_business_slot(slot);
      -- lote que começaria muito perto das 20h vai para a manhã seguinte
      if extract(hour from (slot at time zone 'America/Sao_Paulo')) >= 19 then
        slot := public.next_business_slot(slot + interval '2 hours');
      end if;
      batch_start := slot;
    end if;

    first := initcap(lower(split_part(coalesce(nullif(trim(r.name), ''), 'tudo bem'), ' ', 1)));
    insert into public.whatsapp_outbox (gym_id, student_id, campaign, phone, body, scheduled_at)
    values (p_gym, r.id, 'treino-pronto', phone,
      public.starter_campaign_message(first, i),
      -- 2º da dupla sai alguns minutos depois do 1º
      batch_start + case when i % 2 = 1 then interval '3 minutes' + random() * interval '5 minutes' else interval '0' end)
    on conflict (campaign, student_id) do nothing;
    i := i + 1;
    n := n + 1;
  end loop;
  return n;
end;
$function$;

revoke all on function public.enqueue_starter_campaign(uuid, timestamptz) from public, anon, authenticated;
