-- 055: assinaturas de push notification (Web Push / VAPID)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_gym_id_idx on public.push_subscriptions (gym_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "ps_select_own" on public.push_subscriptions;
create policy "ps_select_own" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ps_insert_own" on public.push_subscriptions;
create policy "ps_insert_own" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "ps_delete_own" on public.push_subscriptions;
create policy "ps_delete_own" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);
