-- 088_mutirao_avisa_aluno.sql
-- Fecha o ciclo do mutirão: depois de aplicar as fichas, a academia avisa o
-- aluno no WhatsApp com o link direto do treino. Sem isso, a ficha entra
-- calada e o aluno continua sem saber que já pode treinar.
--
-- Também deixa explícito quem NÃO entra: quem tem restrição médica/laudo
-- pendente.

create or replace function public.assign_starter_plans_bulk()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_role text;
  r record;
  res jsonb;
  applied integer := 0;
  skipped integer := 0;
  avisados integer := 0;
begin
  select gym_id, role into v_gym, v_role from public.profiles where id = v_uid;
  if v_gym is null or v_role not in ('trainer', 'manager', 'admin') then
    raise exception 'Sem permissão';
  end if;

  for r in
    select p.id from public.profiles p
    where p.gym_id = v_gym and p.role = 'student' and p.approved_at is not null
      and coalesce(p.medical_risk, false) = false
      and coalesce(p.status, 'active') = 'active'
      and not exists (select 1 from public.student_workouts sw
                      where sw.student_id = p.id and sw.status = 'active')
    order by p.approved_at
  loop
    res := public.assign_starter_plan(r.id);
    if (res ->> 'ok')::boolean then applied := applied + 1; else skipped := skipped + 1; end if;
  end loop;

  -- avisa no WhatsApp quem ganhou ficha agora (mesmo teto e horários do drip)
  avisados := public.enqueue_treino_aplicado(v_gym, now());

  return jsonb_build_object('applied', applied, 'skipped', skipped, 'avisados', avisados);
end;
$function$;
