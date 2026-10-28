-- 067_streak_makeup_days.sql
-- Sequência mais justa: quem treina fora do dia marcado não perde a sequência.
--
-- Regra (andando do dia mais recente para trás):
--   * dia com treino soma 1, seja ele marcado ou não;
--   * dia não marcado e sem treino é descanso: não soma e não quebra;
--   * dia marcado e sem treino só quebra se não houver reposição na mesma
--     semana (seg-dom). Cada treino em dia não marcado da semana repõe uma falta.
-- Ex.: ficha seg/qua/sex, aluno treina ter/qui/sex -> sequência continua.

create or replace function public.day_streak(p_student uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  d date := today;
  s integer := 0;
  scheduled integer[] := public.student_scheduled_days(p_student);
  trained date[];
  used jsonb := '{}'::jsonb;  -- reposições já usadas por semana
  wk text;
  makeups integer;
  guard integer := 0;
begin
  select coalesce(array_agg(distinct public.local_day(date)), array[]::date[])
    into trained
  from public.workout_logs
  where student_id = p_student
    and date >= (today - 400)::timestamp at time zone 'America/Sao_Paulo';

  -- Hoje ainda sem treino não quebra: a sequência conta até ontem.
  if not (today = any(trained)) then
    d := d - 1;
  end if;

  while guard < 400 loop
    guard := guard + 1;

    if d = any(trained) then
      s := s + 1;
      d := d - 1;
      continue;
    end if;

    -- Descanso.
    if not (extract(isodow from d)::int = any(scheduled)) then
      d := d - 1;
      continue;
    end if;

    -- Dia marcado perdido: tenta usar reposição da semana.
    wk := date_trunc('week', d)::date::text;
    select count(*) into makeups
    from unnest(trained) t
    where date_trunc('week', t)::date = date_trunc('week', d)::date
      and t <= today
      and not (extract(isodow from t)::int = any(scheduled));

    exit when makeups - coalesce((used ->> wk)::int, 0) <= 0;

    used := jsonb_set(used, array[wk], to_jsonb(coalesce((used ->> wk)::int, 0) + 1));
    d := d - 1;
  end loop;

  return s;
end;
$function$;

grant execute on function public.day_streak(uuid) to authenticated;
