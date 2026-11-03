-- 069_app_errors.sql
-- Monitoramento de erros: tudo que quebra no app (tela, JS, aviso de erro
-- mostrado ao aluno, erro de servidor) cai aqui e aparece no painel /admin.
-- Só o service role lê e grava (rota /api/errors e o próprio servidor):
-- RLS ligada e nenhuma policy, então anon/authenticated não enxergam nada.

create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null check (source in ('client', 'server')),
  level text not null check (level in ('error', 'toast')),
  event text not null,
  message text,
  stack text,
  path text,
  user_id uuid references auth.users (id) on delete set null,
  user_agent text,
  build text,
  fingerprint text not null,
  extra jsonb
);

create index if not exists app_errors_created_at_idx on public.app_errors (created_at desc);
create index if not exists app_errors_fingerprint_idx on public.app_errors (fingerprint, created_at desc);

alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;
