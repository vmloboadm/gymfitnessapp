-- 083_indicacao.sql
-- Indique um amigo: cada aluno tem um código. Quando o amigo se cadastra
-- pelo link (?ref=CODIGO) e é aprovado, quem indicou ganha um desconto
-- na mensalidade (R$ 20 por amigo, sem limite). A academia aplica o
-- desconto na cobrança; o app só mostra o que cada aluno tem a receber.

-- ── 1. código de indicação por aluno ─────────────────────────────────────────
alter table public.profiles add column if not exists referral_code text unique;

create or replace function public.new_referral_code()
returns text
language sql
volatile
as $function$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$function$;

update public.profiles
set referral_code = public.new_referral_code()
where role = 'student' and referral_code is null;

-- ── 2. indicações ────────────────────────────────────────────────────────────
create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  referrer_id  uuid not null references public.profiles(id) on delete cascade,
  referred_id  uuid not null unique references public.profiles(id) on delete cascade,
  amount_cents integer not null default 2000 check (amount_cents >= 0),
  created_at   timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;

drop policy if exists referrals_select on public.referrals;
create policy referrals_select on public.referrals
  for select to authenticated
  using (
    referrer_id = auth.uid()
    or referred_id = auth.uid()
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.gym_id = referrals.gym_id
        and me.role in ('trainer', 'manager', 'admin')
    )
  );

-- ── 3. cadastro: perfil nasce com código e registra a indicação ──────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_gym uuid;
  v_ref_code text;
  v_referrer record;
begin
  select id into v_gym from public.gyms order by created_at limit 1;
  v_gym := coalesce(v_gym, '00000000-0000-0000-0000-000000000001');

  insert into public.profiles (id, gym_id, role, status, name, email, onboarding_step, lgpd_consent_at, referral_code)
  values (
    new.id,
    v_gym,
    'student',
    'active',
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    1,
    now(),
    public.new_referral_code()
  )
  on conflict (id) do nothing;

  v_ref_code := upper(trim(coalesce(new.raw_user_meta_data->>'ref', '')));
  if v_ref_code <> '' then
    select id, gym_id into v_referrer
    from public.profiles
    where referral_code = v_ref_code and role = 'student' and gym_id = v_gym;
    if v_referrer.id is not null and v_referrer.id <> new.id then
      insert into public.referrals (gym_id, referrer_id, referred_id)
      values (v_gym, v_referrer.id, new.id)
      on conflict (referred_id) do nothing;
    end if;
  end if;

  return new;
end;
$function$;

-- ── 4. resumo do aluno: código, link e descontos ─────────────────────────────
create or replace function public.my_referral()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_total integer;
  v_ok integer;
  v_credit integer;
begin
  select referral_code into v_code from public.profiles where id = v_uid;
  select count(*)::int,
         count(*) filter (where p.approved_at is not null)::int,
         coalesce(sum(r.amount_cents) filter (where p.approved_at is not null), 0)::int
    into v_total, v_ok, v_credit
  from public.referrals r
  join public.profiles p on p.id = r.referred_id
  where r.referrer_id = v_uid;

  return jsonb_build_object(
    'code', v_code,
    'total', coalesce(v_total, 0),
    'approved', coalesce(v_ok, 0),
    'credit_cents', coalesce(v_credit, 0),
    'per_friend_cents', 2000
  );
end;
$function$;

grant execute on function public.my_referral() to authenticated;
