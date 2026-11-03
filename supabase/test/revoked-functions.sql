revoke all on function public.copy_template_for_student(p_template uuid, p_student uuid) from public, anon, authenticated;
revoke all on function public.delete_user_data(p_user uuid) from public, anon, authenticated;
revoke all on function public.enqueue_starter_campaign(p_gym uuid, p_start timestamp with time zone) from public, anon, authenticated;
revoke all on function public.seed_base_programs(p_gym uuid) from public, anon, authenticated;
