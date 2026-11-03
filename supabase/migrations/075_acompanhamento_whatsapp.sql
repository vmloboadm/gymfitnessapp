-- 075_acompanhamento_whatsapp.sql
-- "Quero acompanhamento": o aluno escolhe o personal (foto, nome, bio) e o
-- app abre o WhatsApp dele com a mensagem pronta. O pedido fica registrado
-- em Aprovações e SÓ o personal escolhido é avisado (sininho + push).

-- Personais da academia do aluno (sem personal: a gestão)
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
      'id', id, 'name', name, 'bio', bio, 'avatar_url', avatar_url, 'phone', phone, 'role', role
    ) order by created_at), '[]'::jsonb)
  from pick;
$function$;

grant execute on function public.gym_personals() to authenticated;

-- Registra o pedido e avisa o personal escolhido. Devolve o telefone dele.
create or replace function public.request_coaching(p_trainer uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  st record;
  tr record;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
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

  -- o aviso genérico (notify_student_request) não dispara: avisamos só ele
  perform set_config('gf.request_notified', '1', true);
  insert into public.premium_requests (gym_id, student_id, request_type, details, status)
  values (st.gym_id, v_uid, 'other',
    '[acompanhamento] (com ' || coalesce(tr.name, 'personal') || ')' || coalesce(' ' || left(v_msg, 300), ''),
    'pending');
  perform set_config('gf.request_notified', '', true);

  insert into public.notifications (gym_id, user_id, channel, title, body)
  values (st.gym_id, tr.id, 'in_app', 'Pedido de acompanhamento',
    coalesce(nullif(trim(st.name), ''), 'Um aluno') || ' quer acompanhamento com você'
    || coalesce(': ' || left(v_msg, 120), '.') || ' Ele deve te chamar no WhatsApp agora.');

  return jsonb_build_object('ok', true, 'phone', tr.phone, 'name', tr.name);
end;
$function$;

grant execute on function public.request_coaching(uuid, text) to authenticated;

-- aviso genérico respeita quem já avisou
create or replace function public.notify_student_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tag text := substring(coalesce(NEW.details, '') from '^\[([a-z]+)\]');
  v_msg text := btrim(regexp_replace(coalesce(NEW.details, ''), '^\[[a-z]+\]\s*', ''));
  v_name text;
  v_title text;
  sid uuid;
begin
  if coalesce(current_setting('gf.request_notified', true), '') = '1' then
    return NEW;
  end if;
  begin
    select coalesce(nullif(trim(name), ''), 'Um aluno') into v_name from public.profiles where id = NEW.student_id;
    v_title := case v_tag
      when 'acompanhamento' then 'Pedido de acompanhamento'
      when 'treino' then 'Pedido de treino personalizado'
      when 'ajuste' then 'Pedido de ajuste no treino'
      when 'carga' then 'Pedido de ajuste no treino'
      when 'relatorio' then 'Pedido de relatório'
      else 'Pedido do aluno'
    end;
    for sid in select public.student_staff(NEW.student_id) loop
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (NEW.gym_id, sid, 'in_app', v_title,
        v_name || case when v_msg <> '' then ': ' || left(v_msg, 140) else ' fez um pedido.' end);
    end loop;
  exception when others then
    raise warning 'notify_student_request falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;
