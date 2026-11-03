-- 081_desafio_objetivo_saida.sql
-- Desafio com objetivo visível ("Perca 5kg para o verão") e data de
-- inscrição opcional, ainda não estipulada; e o aluno pode SAIR do desafio
-- pelo app (o contrário de join_challenge, que só existia).

alter table public.challenges
  add column if not exists objective_text text check (objective_text is null or length(objective_text) <= 80),
  add column if not exists registration_opens_on date;

-- ------------------------------------------------------------------ sair
create or replace function public.leave_challenge(p_challenge uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  st record;
begin
  select id, gym_id, role into st from public.profiles where id = v_uid;
  if st.id is null or st.role <> 'student' then
    raise exception 'Sem permissão';
  end if;
  if not exists (
    select 1 from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
    where cp.challenge_id = p_challenge and cp.student_id = v_uid
      and c.gym_id = st.gym_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'nao_participa');
  end if;

  delete from public.challenge_participants
  where challenge_id = p_challenge and student_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$function$;

grant execute on function public.leave_challenge(uuid) to authenticated;

-- ------------------------------------------------- entrada com inscrição
-- registration_opens_on null = inscrições abertas (o desafio atual ainda não
-- tem data). Antes da data, não entra.
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
  if c.registration_opens_on is not null and today < c.registration_opens_on then
    return jsonb_build_object('ok', false, 'reason', 'ainda_nao_abriu',
      'opens_on', to_char(c.registration_opens_on, 'DD/MM'));
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

-- ------------------------------------------- dar força: só quem está dentro
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
  -- quem dá força também precisa estar no desafio (saíu = não participa)
  if not exists (select 1 from public.challenge_participants where challenge_id = c.id and student_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'nao_participa');
  end if;
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
