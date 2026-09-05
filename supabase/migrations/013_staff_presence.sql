-- 013: gestores e personais gerenciam a presença da unidade.
-- Encerrar treino de aluno: inserir 'saida' e fechar sessões de aparelho.

create policy "checkins_insert_gym_staff"
  on checkins for insert to authenticated
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.gym_id = gym_id
        and p.role in ('manager', 'trainer')
    )
  );

create policy "sessions_update_gym_staff"
  on equipment_sessions for update to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.gym_id = gym_id
        and p.role in ('manager', 'trainer')
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.gym_id = gym_id
        and p.role in ('manager', 'trainer')
    )
  );
