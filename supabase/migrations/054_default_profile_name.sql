-- 054_default_profile_name.sql
-- Trava anti-cadastro-sem-nome: nunca deixa um perfil sem nome.
-- Se o nome vier vazio, usa a parte local do e-mail (a ficha pede o nome
-- real depois). Garante que todos os cards/saudacoes funcionem.

create or replace function public.default_profile_name()
returns trigger
language plpgsql
as $function$
declare localpart text;
begin
  if NEW.name is null or trim(NEW.name) = '' then
    localpart := split_part(coalesce(NEW.email, ''), '@', 1);
    localpart := regexp_replace(localpart, '[^A-Za-zÀ-ú ]', ' ', 'g');
    localpart := trim(regexp_replace(localpart, '\s+', ' ', 'g'));
    if localpart = '' then localpart := 'Aluno'; end if;
    NEW.name := localpart;
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_default_profile_name on public.profiles;
create trigger trg_default_profile_name
  before insert or update of name, email on public.profiles
  for each row execute function public.default_profile_name();
