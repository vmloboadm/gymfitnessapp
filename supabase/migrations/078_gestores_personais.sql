-- 078_gestores_personais.sql
-- Na GymFitness os gestores (Claudeir, Rebeca) também são personais:
-- todos da equipe aparecem na vitrine "Treine com…", personais primeiro.
create or replace function public.gym_personals()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  with me as (select gym_id from public.profiles where id = auth.uid()),
  staff as (
    select p.id, p.name, p.bio, p.avatar_url, p.phone, p.role, p.created_at
    from public.profiles p, me
    where p.gym_id = me.gym_id and p.role in ('trainer', 'manager', 'admin')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', staff.id, 'name', staff.name, 'bio', staff.bio, 'avatar_url', staff.avatar_url,
      'phone', staff.phone, 'role', staff.role,
      'offers', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', o.id, 'title', o.title, 'description', o.description,
            'price_cents', o.price_cents, 'sessions_per_week', o.sessions_per_week,
            'duration_label', o.duration_label
          ) order by o.sort, o.created_at), '[]'::jsonb)
        from public.personal_offers o
        where o.trainer_id = staff.id and o.active
      )
    ) order by (staff.role = 'trainer') desc, staff.created_at), '[]'::jsonb)
  from staff;
$function$;

grant execute on function public.gym_personals() to authenticated;
