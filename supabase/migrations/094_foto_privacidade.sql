-- 094: privacidade da foto. O aluno escolhe:
--   * foto para todos os alunos (padrão: quem já está na academia concordou);
--   * ou um ícone (1, 2 ou 3) para os alunos, com a foto real visível só para
--     gestor, admin e personal da academia, e para o próprio aluno.
-- A regra fica no servidor: gym_roster devolve "icone:N" no lugar da foto, então
-- o navegador do aluno nunca recebe a foto escondida.

alter table public.profiles add column if not exists foto_publica boolean not null default true;
alter table public.profiles add column if not exists avatar_icone smallint check (avatar_icone between 1 and 3);

create or replace function public.foto_para_quem_ve(
  p_perfil uuid, p_url text, p_publica boolean, p_icone smallint
)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when auth.uid() = p_perfil then p_url
    when public.current_role() in ('trainer', 'manager', 'admin') then p_url
    when coalesce(p_publica, true) then p_url
    else 'icone:' || coalesce(p_icone, 1)::text
  end;
$$;

-- gym_roster: mesma assinatura, agora com a regra de foto aplicada.
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
    and p.role in ('student', 'trainer', 'manager', 'admin')
    and (p.role <> 'student' or p.approved_at is not null)
  order by p.name;
$$;

-- O aluno altera a própria configuração (ele não tem UPDATE direto na tabela).
create or replace function public.set_foto_privacidade(p_publica boolean, p_icone smallint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;
  update public.profiles
     set foto_publica = coalesce(p_publica, true),
         avatar_icone = case when coalesce(p_publica, true) then null else coalesce(p_icone, 1) end,
         updated_at = now()
   where id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.set_foto_privacidade(boolean, smallint) to authenticated;
