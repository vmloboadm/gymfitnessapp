-- =====================================================================
-- 009_ai_audit_and_validation.sql
-- P1.7: Tabela de auditoria de IA
-- =====================================================================

create table if not exists public.ai_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid references public.gyms(id),
  user_id     uuid references auth.users(id),
  purpose     text not null,
  model_used  text not null,
  tokens_in   int,
  tokens_out  int,
  latency_ms  int,
  success     boolean not null default true,
  error       text,
  created_at  timestamptz not null default now()
);

alter table public.ai_audit_logs enable row level security;

-- Staff lê logs da própria academia
create policy "ai_audit_select_staff"
  on public.ai_audit_logs
  for select using (
    public.current_role() in ('trainer','manager','admin')
    and gym_id = public.current_gym_id()
  );

-- Qualquer um autenticado pode inserir (log do próprio uso)
create policy "ai_audit_insert_own"
  on public.ai_audit_logs
  for insert with check (
    user_id = auth.uid()
    or public.current_role() in ('trainer','manager','admin')
  );

create index if not exists idx_ai_audit_gym_time on public.ai_audit_logs(gym_id, created_at);
create index if not exists idx_ai_audit_user on public.ai_audit_logs(user_id, created_at);
