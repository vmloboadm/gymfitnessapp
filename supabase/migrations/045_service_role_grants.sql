-- 045_service_role_grants.sql
-- Tabelas criadas nas migrations 035-044: garante DML total para service_role
-- (rotas de API e scripts usam a service key e não podem cair em
-- "permission denied for table").

grant all on public.workout_templates to service_role;
grant all on public.slot_checks to service_role;
grant all on public.leaderboard to service_role;
grant all on public.notifications to service_role;
grant all on public.feed_posts to service_role;
grant all on public.feed_likes to service_role;
grant all on public.feed_comments to service_role;
grant all on public.progress_photos to service_role;
grant all on public.conversations to service_role;
grant all on public.direct_messages to service_role;
grant all on public.cardio_logs to service_role;
grant all on public.student_achievements to service_role;
grant all on public.workout_logs to service_role;
