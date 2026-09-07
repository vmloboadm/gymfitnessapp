-- 031: GRANTs faltantes da tv_content (Ticket 7 não incluiu).
-- Sem isso o PostgREST retorna 42501 mesmo com RLS permitindo.

grant select on public.tv_content to anon, authenticated;
grant insert, update, delete on public.tv_content to authenticated;
