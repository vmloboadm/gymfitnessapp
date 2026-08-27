-- =====================================================================
-- 006_security_hardening.sql
-- FASE 1 (segurança): corrige vazamentos de day_passes identificados
-- na auditoria pré-entrega.
--
-- Problemas:
--   1) day_passes_select_own_code using (true) deixava QUALQUER visitante
--      anônimo listar todos os day-passes de TODAS as academias
--      (código = credencial de entrada).
--   2) Código gerado no cliente com Date.now() → sequencial/adivinhável.
--
-- Solução:
--   - SELECT na tabela fica restrito a staff da própria academia.
--   - RPC purchase_day_pass(): gera código aleatório SERVER-SIDE e retorna
--     apenas o pass recém-criado.
--   - RPC my_day_passes(codes): devolve somente passes cujos códigos foram
--     apresentados pelo próprio comprador (guardados no device dele).
-- =====================================================================

drop policy if exists "day_passes_select_own_code" on public.day_passes;

-- staff lê os day-passes da própria academia (recepção valida)
create policy "day_passes_select_staff"
  on public.day_passes
  for select using (
    public.current_role() in ('manager', 'admin')
    and gym_id = public.current_gym_id()
  );

-- código de 10 chars imprevisível (crypto random server-side)
create or replace function public.generate_day_pass_code()
returns text
language sql
volatile
as $$
  select 'DP-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
$$;

create extension if not exists pgcrypto;

-- compra pública: cria o pass e devolve SOMENTE ele para o comprador
create or replace function public.purchase_day_pass(
  p_gym_slug text,
  p_name     text,
  p_email    text default null,
  p_phone    text default null
)
returns table (
  id         uuid,
  code       text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym   uuid;
  v_id    uuid;
  v_code  text;
  v_exp   timestamptz;
begin
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Nome inválido.';
  end if;

  select id into v_gym from public.gyms where slug = p_gym_slug limit 1;
  if v_gym is null then
    raise exception 'Academia não encontrada.';
  end if;

  v_code := public.generate_day_pass_code();
  v_exp  := now() + interval '24 hours';

  insert into public.day_passes (gym_id, code, name, email, phone, status, expires_at)
  values (v_gym, v_code, trim(p_name), p_email, p_phone, 'active', v_exp)
  returning day_passes.id into v_id;

  return query select v_id, v_code, v_exp;
end;
$$;

-- leitura por posse do código: só retorna linhas cujo código foi informado
create or replace function public.my_day_passes(p_codes text[])
returns setof public.day_passes
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.day_passes
  where code = any(p_codes)
  order by created_at desc
  limit 20;
$$;

grant execute on function public.purchase_day_pass(text, text, text, text) to anon, authenticated;
grant execute on function public.my_day_passes(text[]) to anon, authenticated;
