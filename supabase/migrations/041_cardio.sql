-- 041_cardio.sql
-- Registro de cardio (corrida, esteira, bike, natação, outros) com tempo e
-- intensidade + destaque semanal na comunidade + conquistas de cardio.
-- Cardio tem trilha própria: não substitui o check de treino.

create table if not exists public.cardio_logs (
  id uuid not null default uuid_generate_v4() primary key,
  gym_id uuid not null references public.gyms(id),
  student_id uuid not null references public.profiles(id),
  modality text not null check (modality in ('corrida', 'esteira', 'bike', 'natacao', 'outros')),
  minutes integer not null check (minutes > 0 and minutes <= 600),
  intensity integer check (intensity is null or (intensity >= 1 and intensity <= 10)),
  date timestamptz not null default now()
);

create index if not exists idx_cardio_student_date
  on public.cardio_logs (student_id, date desc);

alter table public.cardio_logs enable row level security;

grant select, insert on public.cardio_logs to authenticated;

drop policy if exists cardio_insert_own on public.cardio_logs;
create policy cardio_insert_own on public.cardio_logs for insert to authenticated
  with check (student_id = auth.uid() and gym_id = public.current_gym_id());

drop policy if exists cardio_select_own on public.cardio_logs;
create policy cardio_select_own on public.cardio_logs for select to authenticated
  using (student_id = auth.uid());

drop policy if exists cardio_select_staff on public.cardio_logs;
create policy cardio_select_staff on public.cardio_logs for select to authenticated
  using (
    public.current_role() in ('trainer', 'manager', 'admin')
    and gym_id = public.current_gym_id()
  );

-- minutos de cardio na semana por aluno (só totais, sem expor detalhe)
create or replace function public.cardio_weekly(p_gym_id uuid)
returns table (student_id uuid, minutes integer)
language sql
stable
security definer
set search_path = public
as $function$
  select student_id, sum(minutes)::int as minutes
  from public.cardio_logs
  where gym_id = p_gym_id and date >= date_trunc('week', now())
  group by student_id
  order by minutes desc
  limit 10;
$function$;

grant execute on function public.cardio_weekly(uuid) to authenticated;

-- premiação de cardio (primeiro + 180 min no mês)
create or replace function public.award_cardio()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  total_all integer;
  total_month integer;
  aname text;
  disp text;
  firstn text;
begin
  begin
    select count(*) into total_all
    from public.cardio_logs where student_id = NEW.student_id;
    select coalesce(sum(minutes), 0) into total_month
    from public.cardio_logs
    where student_id = NEW.student_id and date >= date_trunc('month', NEW.date);
    select coalesce(nullif(name, ''), 'Atleta') into aname
    from public.profiles where id = NEW.student_id;
    firstn := split_part(aname, ' ', 1);
    disp := firstn || case when split_part(aname, ' ', 2) <> '' then ' ' || left(split_part(aname, ' ', 2), 1) || '.' else '' end;

    if total_all = 1 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'cardio_first', disp, firstn, 'registrou o primeiro cardio!');
    end if;
    if total_month >= 180 then
      perform public.grant_achievement(NEW.gym_id, NEW.student_id, 'cardio_180', disp, firstn, 'somou 180 minutos de cardio no mês!');
    end if;
  exception when others then
    raise warning 'award_cardio falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;

drop trigger if exists trg_award_cardio on public.cardio_logs;
create trigger trg_award_cardio
after insert on public.cardio_logs
for each row execute function public.award_cardio();
