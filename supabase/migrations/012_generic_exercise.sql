-- 012: Exercício genérico para registros livres de aparelho (WorkoutLogModal)
insert into public.exercises (name, category)
select 'Registro livre', 'core'
where not exists (select 1 from public.exercises where name = 'Registro livre');
