-- 095: contas demo descartáveis. Cada acesso demo cria uma conta nova, que:
--   * não aparece para ninguém (gym_roster ignora is_demo);
--   * é apagada ao encerrar a demo (rota /api/dev-demo/encerrar);
--   * é apagada sozinha depois de 3 horas (cron abaixo), se ninguém encerrar.

alter table public.profiles add column if not exists is_demo boolean not null default false;

-- gym_roster: mesma regra da 094, agora sem contas demo.
create or replace function public.gym_roster(p_gym_id uuid)
returns table (id uuid, name text, avatar_url text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.name,
         public.foto_para_quem_ve(p.id, p.avatar_url, p.foto_publica, p.avatar_icone),
         p.role
  from public.profiles p
  where p.gym_id = p_gym_id
    and p.is_demo = false
    and p.role in ('student', 'trainer', 'manager', 'admin')
    and (p.role <> 'student' or p.approved_at is not null)
  order by p.name;
$$;

-- Apaga contas demo com mais de 3 horas. Roda pelo cron.
create or replace function public.limpar_contas_demo()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n integer;
begin
  delete from auth.users
   where id in (
     select id from public.profiles
      where is_demo = true and created_at < now() - interval '3 hours'
   );
  get diagnostics n = row_count;
  return n;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'limpar-contas-demo') then
      perform cron.unschedule('limpar-contas-demo');
    end if;
    perform cron.schedule('limpar-contas-demo', '*/30 * * * *', 'select public.limpar_contas_demo();');
  end if;
exception when others then
  raise warning 'pg_cron indisponível: %', sqlerrm;
end $$;
