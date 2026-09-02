-- Executar no SQL Editor do Supabase (service_role sem GRANT de INSERT)
INSERT INTO public.profiles (id, gym_id, role, status, name, email, phone, bio, onboarding_completed, onboarding_step, lgpd_consent_at, created_at, updated_at)
VALUES ('b555e14c-afbf-4ea2-a9dd-a04a9281e50f', '00000000-0000-0000-0000-000000000001', 'trainer', 'active', 'Claudeir Machado', 'gffitness2024@gmail.com', '5522997787186', true, 5, now(), now(), now());

INSERT INTO public.profiles (id, gym_id, role, status, name, email, phone, bio, onboarding_completed, onboarding_step, lgpd_consent_at, created_at, updated_at)
VALUES ('7b59e632-2df5-44b8-b95b-598f41ca76d1', '00000000-0000-0000-0000-000000000001', 'trainer', 'active', 'Rebeca Silveira', 'rebecaasilveira18@gmail.com', '5522997475362', true, 5, now(), now(), now());

INSERT INTO public.profiles (id, gym_id, role, status, name, email, phone, bio, onboarding_completed, onboarding_step, lgpd_consent_at, created_at, updated_at)
VALUES ('a87fa99d-7f34-4833-a8f5-0c2e112244ff', '00000000-0000-0000-0000-000000000001', 'trainer', 'active', 'Daiana Teodoro', 'daianabw.dt@gmail.com', '5522998732483', true, 5, now(), now(), now());