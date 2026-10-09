-- 038_notify_my_trainer.sql
-- Aluno do treino provisório avisa o personal vinculado ("monte meu treino").
-- Via RPC com SECURITY DEFINER: o aluno só consegue notificar quem já é
-- seu trainer vinculado (sem spam para terceiros).

create or replace function public.notify_my_trainer(p_text text default null)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  sname text;
begin
  select coalesce(nullif(name, ''), email, 'Um aluno') into sname
  from public.profiles where id = auth.uid();

  insert into public.notifications (gym_id, user_id, channel, title, body)
  select st.gym_id, st.trainer_id, 'in_app',
    'Aluno pede treino',
    sname || ' está no treino provisório e aguarda o plano.'
      || case when p_text is not null and btrim(p_text) <> '' then ' Recado: ' || left(btrim(p_text), 140) else '' end
  from public.student_trainers st
  where st.student_id = auth.uid();
end;
$function$;

grant execute on function public.notify_my_trainer(text) to authenticated;
