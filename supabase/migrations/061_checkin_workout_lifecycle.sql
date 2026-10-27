-- 061_checkin_workout_lifecycle.sql
-- Check-in abre a sessão de treino e o cronômetro. Finalizar o treino fecha
-- a sessão E a presença. Sessão esquecida fecha sozinha em 3 horas.
-- Nenhum check-in, log ou ponto é apagado.

alter table public.checkins
  add column if not exists workout_session_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.checkins'::regclass
      and conname = 'checkins_workout_session_id_fkey'
  ) then
    alter table public.checkins
      add constraint checkins_workout_session_id_fkey
      foreign key (workout_session_id)
      references public.workout_sessions(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists checkins_session_type_uidx
  on public.checkins (workout_session_id, type)
  where workout_session_id is not null;

create index if not exists checkins_student_day_idx
  on public.checkins (student_id, checked_at desc);

-- Nova entrada só é bloqueada se ainda existir uma entrada ABERTA hoje.
-- Depois de uma saída, o aluno pode entrar de novo no mesmo dia.
create or replace function public.prevent_duplicate_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.type = 'entrada' and exists (
    select 1
    from public.checkins c
    where c.student_id = new.student_id
      and c.gym_id = new.gym_id
      and c.type = 'entrada'
      and (c.checked_at at time zone 'America/Sao_Paulo')::date
        = (new.checked_at at time zone 'America/Sao_Paulo')::date
      and not exists (
        select 1
        from public.checkins s
        where s.student_id = c.student_id
          and s.gym_id = c.gym_id
          and s.type = 'saida'
          and s.checked_at > c.checked_at
      )
  ) then
    raise exception 'Check-in de entrada já realizado hoje';
  end if;
  return new;
end;
$function$;

-- Retorna jsonb para o cliente não depender de shape de RPC.
create or replace function public.start_checkin(p_source text default 'app')
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_source text := case when p_source in ('app','nfc','qrcode') then p_source else 'app' end;
  v_entry_id uuid;
  v_checked_at timestamptz;
  v_session_id uuid;
  v_started_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  select gym_id into v_gym from public.profiles where id = v_uid;
  if v_gym is null then
    raise exception 'Perfil sem academia';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  -- Entrada ainda aberta hoje?
  select c.id, c.checked_at, c.workout_session_id
    into v_entry_id, v_checked_at, v_session_id
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

  if v_entry_id is not null then
    select ws.id, ws.started_at into v_session_id, v_started_at
    from public.workout_sessions ws
    where ws.student_id = v_uid and ws.status = 'active'
    order by ws.started_at desc
    limit 1;

    if v_session_id is null then
      insert into public.workout_sessions (gym_id, student_id, status, started_at, meta)
      values (v_gym, v_uid, 'active', now(),
        jsonb_build_object('kind', 'checkin', 'started_by', 'checkin', 'source', v_source))
      returning id, started_at into v_session_id, v_started_at;

      update public.checkins
      set workout_session_id = v_session_id
      where id = v_entry_id;
    end if;

    return jsonb_build_object(
      'ok', true, 'existing', true,
      'checkin_id', v_entry_id, 'checked_at', v_checked_at,
      'session_id', v_session_id, 'started_at', v_started_at
    );
  end if;

  -- Sem entrada aberta. Sessão antiga com saída já registrada não pode ser
  -- reaproveitada; fecha e abre uma nova para a nova entrada.
  update public.workout_sessions ws
  set status = 'completed', ended_at = now()
  where ws.student_id = v_uid and ws.status = 'active'
    and exists (
      select 1 from public.checkins c
      where c.workout_session_id = ws.id and c.type = 'saida'
    );

  select ws.id, ws.started_at into v_session_id, v_started_at
  from public.workout_sessions ws
  where ws.student_id = v_uid and ws.status = 'active'
  order by ws.started_at desc
  limit 1;

  if v_session_id is null then
    insert into public.workout_sessions (gym_id, student_id, status, started_at, meta)
    values (v_gym, v_uid, 'active', now(),
      jsonb_build_object('kind', 'checkin', 'started_by', 'checkin', 'source', v_source))
    returning id, started_at into v_session_id, v_started_at;
  end if;

  insert into public.checkins (gym_id, student_id, type, source, checked_at, workout_session_id)
  values (v_gym, v_uid, 'entrada', v_source, now(), v_session_id)
  returning id, checked_at into v_entry_id, v_checked_at;

  return jsonb_build_object(
    'ok', true, 'existing', false,
    'checkin_id', v_entry_id, 'checked_at', v_checked_at,
    'session_id', v_session_id, 'started_at', v_started_at
  );
end;
$function$;

grant execute on function public.start_checkin(text) to authenticated;

-- Fecha a presença aberta. Idempotente: se já houver saída para a sessão,
-- devolve closed=true sem criar outra.
create or replace function public.close_checkin(
  p_session_id uuid default null,
  p_source text default 'app'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_source text := case when p_source in ('app','nfc','qrcode') then p_source else 'app' end;
  v_entry_id uuid;
  v_entry_session uuid;
  v_checked_at timestamptz;
  v_existing_saida uuid;
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
    select 1 into v_existing_saida
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
$function$;

grant execute on function public.close_checkin(uuid, text) to authenticated;

-- Fecha sessões ativas com mais de 3h. Chamado pelo pg_cron e pelo cliente.
create or replace function public.auto_close_stale_workouts(p_student uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
  r record;
begin
  if v_uid is not null and (p_student is null or p_student <> v_uid) then
    raise exception 'Sem permissão';
  end if;

  for r in
    select ws.id, ws.student_id, ws.gym_id, ws.started_at
    from public.workout_sessions ws
    where ws.status = 'active'
      and ws.started_at < (now() - interval '3 hours')
      and (p_student is null or ws.student_id = p_student)
  loop
    update public.workout_sessions
    set status = 'completed',
        ended_at = greatest(
          r.started_at + interval '3 hours',
          coalesce((
            select max(c.checked_at) from public.checkins c
            where c.workout_session_id = r.id and c.type = 'entrada'
          ), r.started_at)
        ),
        meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
          'auto_finished', true,
          'finished_by', 'auto',
          'auto_closed_at', now()
        )
    where id = r.id and status = 'active';

    insert into public.checkins (gym_id, student_id, type, source, checked_at, workout_session_id)
    select r.gym_id, r.student_id, 'saida', 'app',
           greatest(
             r.started_at + interval '3 hours',
             coalesce((
               select max(c.checked_at) from public.checkins c
               where c.workout_session_id = r.id and c.type = 'entrada'
             ), r.started_at)
           ), r.id
    where exists (
      select 1 from public.checkins c
      where c.student_id = r.student_id
        and c.gym_id = r.gym_id
        and c.type = 'entrada'
        and (c.workout_session_id = r.id or c.workout_session_id is null)
        and not exists (
          select 1 from public.checkins s
          where s.student_id = c.student_id
            and s.gym_id = c.gym_id
            and s.type = 'saida'
            and s.checked_at > c.checked_at
        )
    )
    and not exists (
      select 1 from public.checkins x
      where x.workout_session_id = r.id and x.type = 'saida'
    )
    limit 1;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

grant execute on function public.auto_close_stale_workouts(uuid) to authenticated;
grant execute on function public.auto_close_stale_workouts(uuid) to service_role;

-- Cron do banco: não depende de o aluno abrir o app.
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'auto-close-workouts-3h') then
    perform cron.unschedule('auto-close-workouts-3h');
  end if;
  perform cron.schedule(
    'auto-close-workouts-3h',
    '*/5 * * * *',
    'select public.auto_close_stale_workouts();'
  );
exception when others then
  raise warning 'pg_cron indisponivel: %', sqlerrm;
end $$;
