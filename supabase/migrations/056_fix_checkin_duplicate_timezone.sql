-- Corrige o fuso do check-in: o "dia" é o de São Paulo, não o UTC.
-- Sem isso, um check-in depois das 21h BRT caía no dia seguinte UTC e
-- bloqueava o check-in da manhã seguinte como "já realizado hoje".
-- O trigger de pontos (award_checkin) já usa America/Sao_Paulo; este
-- alinha a regra de duplicidade com a mesma fonte.
create or replace function public.prevent_duplicate_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'entrada' and exists (
    select 1
    from public.checkins c
    where c.student_id = new.student_id
      and c.gym_id = new.gym_id
      and c.type = 'entrada'
      and (c.checked_at at time zone 'America/Sao_Paulo')::date
        = (new.checked_at at time zone 'America/Sao_Paulo')::date
  ) then
    raise exception 'Check-in de entrada já realizado hoje';
  end if;
  return new;
end;
$$;
