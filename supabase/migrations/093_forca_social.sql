-- 093: "Força" entre alunos da mesma academia (fora do desafio).
-- Uma força por pessoa para cada colega, por dia. Gera um aviso para quem recebe
-- (passa pela trigger de nome da migration 090/091 e pelo push).

create table if not exists public.student_cheers (
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  day date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, day),
  check (from_id <> to_id)
);

alter table public.student_cheers enable row level security;
revoke all on public.student_cheers from anon, authenticated;

create or replace function public.send_cheer(p_to uuid, p_emoji text default '💪')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me record;
  alvo record;
  v_emoji text := coalesce(nullif(p_emoji, ''), '💪');
  v_inserted int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;
  if p_to = auth.uid() then
    return jsonb_build_object('ok', false, 'motivo', 'proprio_aluno');
  end if;
  if v_emoji not in ('💪', '🔥', '👊', '🙌', '👏') then
    return jsonb_build_object('ok', false, 'motivo', 'emoji_invalido');
  end if;

  select id, gym_id, split_part(coalesce(name, ''), ' ', 1) as primeiro
    into me from profiles where id = auth.uid() and role = 'student' and status = 'active';
  select id, gym_id into alvo from profiles where id = p_to and role = 'student' and status = 'active';
  if me.id is null or alvo.id is null or me.gym_id is distinct from alvo.gym_id then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_academia');
  end if;

  insert into student_cheers (from_id, to_id, emoji)
  values (me.id, alvo.id, v_emoji)
  on conflict (from_id, to_id, day) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'ja_enviou_hoje');
  end if;

  insert into notifications (gym_id, user_id, channel, title, body)
  values (alvo.gym_id, alvo.id, 'in_app', 'Recebeu força',
          coalesce(nullif(me.primeiro, ''), 'Um colega') || ' mandou ' || v_emoji || ' pra você. Retribui hoje.');

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.send_cheer(uuid, text) to authenticated;
