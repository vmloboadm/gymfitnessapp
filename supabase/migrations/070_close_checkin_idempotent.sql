-- 070_close_checkin_idempotent.sql
-- close_checkin deveria ser idempotente, mas chamar de novo para uma sessão
-- que já tinha saída dava erro: "select 1 into" numa variável uuid
-- (invalid input syntax for type uuid: "1"). O app tratava como falha e
-- enfileirava uma saída extra, que depois batia na trava de saída única (409).
-- Única mudança: a variável vira boolean. Achado pelos testes de tests/db.

CREATE OR REPLACE FUNCTION public.close_checkin(p_session_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'app'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_source text := case when p_source in ('app','nfc','qrcode') then p_source else 'app' end;
  v_entry_id uuid;
  v_entry_session uuid;
  v_checked_at timestamptz;
  v_existing_saida boolean;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  select gym_id into v_gym from public.profiles where id = v_uid;
  if v_gym is null then
    raise exception 'Perfil sem academia';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  if p_session_id is not null then
    select true into v_existing_saida
    from public.checkins
    where workout_session_id = p_session_id and type = 'saida'
    limit 1;

    if v_existing_saida is not null then
      return jsonb_build_object('ok', true, 'closed', true, 'already_closed', true);
    end if;
  end if;

  select c.id, c.workout_session_id, c.checked_at
    into v_entry_id, v_entry_session, v_checked_at
  from public.checkins c
  where c.student_id = v_uid
    and c.gym_id = v_gym
    and c.type = 'entrada'
    and (c.checked_at at time zone 'America/Sao_Paulo')::date
      = (now() at time zone 'America/Sao_Paulo')::date
    and not exists (
      select 1 from public.checkins s
      where s.student_id = c.student_id
        and s.gym_id = c.gym_id
        and s.type = 'saida'
        and s.checked_at > c.checked_at
    )
  order by c.checked_at desc
  limit 1;

  if v_entry_id is null then
    return jsonb_build_object('ok', true, 'closed', false, 'already_closed', true);
  end if;

  insert into public.checkins (gym_id, student_id, type, source, checked_at, workout_session_id)
  values (v_gym, v_uid, 'saida', v_source, now(), coalesce(p_session_id, v_entry_session));

  update public.workout_sessions
  set status = 'completed',
      ended_at = now(),
      meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('finished_by', 'student')
  where id = coalesce(p_session_id, v_entry_session)
    and status = 'active';

  return jsonb_build_object('ok', true, 'closed', true, 'checkin_id', v_entry_id, 'checked_at', v_checked_at);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'closed', true, 'already_closed', true);
end;
$function$

;

grant execute on function public.close_checkin(uuid, text) to authenticated;
