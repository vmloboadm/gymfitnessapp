-- 082_laudo_nao_trava.sql
-- Aluno com risco médico ficava preso no último passo do cadastro
-- ("Erro ao finalizar onboarding", CLINICAL_LOCK) — 7 alunos presos, alguns
-- desde setembro, nenhum tinha enviado laudo. Agora o cadastro conclui e a
-- pessoa entra no app; o TREINO continua bloqueado até o laudo ser aprovado
-- (assign/pick_starter_plan já recusam 'avaliacao_medica'). A equipe é avisada.

create or replace function public.finish_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_status text;
  v_risk boolean;
  v_gym uuid;
  v_name text;
  sid uuid;
begin
  select status, medical_risk, gym_id, coalesce(nullif(trim(name), ''), 'Um aluno')
    into v_status, v_risk, v_gym, v_name
  from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  update public.profiles
  set onboarding_completed = true, onboarding_step = 7, updated_at = now()
  where id = auth.uid();

  -- risco médico sem laudo aprovado: avisa a equipe (1 vez)
  if coalesce(v_risk, false) and v_status = 'pending_clearance'
     and not exists (
       select 1 from public.notifications
       where title = 'Aluno aguardando laudo' and body like v_name || ' %'
     ) then
    for sid in select public.student_staff(auth.uid()) loop
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (v_gym, sid, 'in_app', 'Aluno aguardando laudo',
        v_name || ' marcou restrição de saúde no cadastro e precisa enviar o laudo médico. '
        || 'Enquanto isso não recebe treino. Vale chamar no WhatsApp.');
    end loop;
  end if;
end;
$function$;

grant execute on function public.finish_onboarding() to authenticated;

-- laudo enviado → equipe analisa
create or replace function public.notify_clearance_uploaded()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_name text;
  sid uuid;
begin
  begin
    if coalesce(NEW.approved, false) then
      return NEW;
    end if;
    select coalesce(nullif(trim(name), ''), 'Um aluno') into v_name from public.profiles where id = NEW.student_id;
    for sid in select public.student_staff(NEW.student_id) loop
      insert into public.notifications (gym_id, user_id, channel, title, body)
      values (NEW.gym_id, sid, 'in_app', 'Laudo para analisar',
        v_name || ' enviou o laudo médico. Aprove para liberar o treino.');
    end loop;
  exception when others then
    raise warning 'notify_clearance_uploaded falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;

drop trigger if exists trg_notify_clearance_uploaded on public.medical_clearances;
create trigger trg_notify_clearance_uploaded
  after insert on public.medical_clearances
  for each row execute function public.notify_clearance_uploaded();

-- destrava quem já chegou ao fim do cadastro e ficou preso
update public.profiles
set onboarding_completed = true, updated_at = now()
where role = 'student' and status = 'pending_clearance'
  and not onboarding_completed and coalesce(onboarding_step, 0) >= 7;
