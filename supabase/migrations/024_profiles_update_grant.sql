-- 024: Libera UPDATE em profiles para authenticated.
-- Sem isso, bio/avatar/perfil falham para TODOS os usuários (RLS já
-- restringe ao próprio perfil via profiles_update_own).

grant update on public.profiles to authenticated;
