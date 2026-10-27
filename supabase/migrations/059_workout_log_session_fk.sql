-- 059_workout_log_session_fk.sql
-- workout_logs.session_id sempre foi a sessão de EQUIPAMENTO (equipment_sessions).
-- A sessão de TREINO é outra coisa (workout_sessions). O app gravava o id da
-- sessão de treino na coluna errada, o INSERT inteiro falhava na FK e o
-- histórico ficava vazio. A coluna nova é a ligação correta e aceita null.

alter table public.workout_logs
  add column if not exists workout_session_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_logs'::regclass
      and conname = 'workout_logs_workout_session_id_fkey'
  ) then
    alter table public.workout_logs
      add constraint workout_logs_workout_session_id_fkey
      foreign key (workout_session_id)
      references public.workout_sessions(id)
      on delete set null;
  end if;
end $$;

create index if not exists workout_logs_workout_session_id_idx
  on public.workout_logs (workout_session_id);

comment on column public.workout_logs.session_id is
  'Sessão de equipamento (equipment_sessions). Para sessão de treino use workout_session_id.';

-- Mesmo treino + mesmo exercício não pode virar duas linhas quando o aluno
-- finaliza de novo ou a fila offline repete um insert que já entrou.
create unique index if not exists workout_logs_session_exercise_uidx
  on public.workout_logs (workout_session_id, exercise_id)
  where workout_session_id is not null;
