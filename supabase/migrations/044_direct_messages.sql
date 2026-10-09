-- 044_direct_messages.sql
-- Conversa direta personal/aluno (caixa de entrada no app, só texto na v1).
-- Aluno fala com personal vinculado (ou gestão); staff fala com aluno da
-- academia (personal só com vinculado). Mensagem nova avisa no sino.

create table if not exists public.conversations (
  id uuid not null default uuid_generate_v4() primary key,
  gym_id uuid not null references public.gyms(id),
  student_id uuid not null references public.profiles(id),
  staff_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, staff_id)
);

create table if not exists public.direct_messages (
  id uuid not null default uuid_generate_v4() primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_dm_conversation
  on public.direct_messages (conversation_id, created_at);
create index if not exists idx_conv_student on public.conversations (student_id, updated_at desc);
create index if not exists idx_conv_staff on public.conversations (staff_id, updated_at desc);

alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;

grant select, insert, update on public.conversations to authenticated;
grant select, insert, update on public.direct_messages to authenticated;

drop policy if exists conv_participant on public.conversations;
create policy conv_participant on public.conversations for all to authenticated
  using (student_id = auth.uid() or staff_id = auth.uid())
  with check (student_id = auth.uid() or staff_id = auth.uid());

drop policy if exists dm_participant on public.direct_messages;
create policy dm_participant on public.direct_messages for all to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = direct_messages.conversation_id
        and (c.student_id = auth.uid() or c.staff_id = auth.uid())
    )
  )
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = direct_messages.conversation_id
        and (c.student_id = auth.uid() or c.staff_id = auth.uid())
    )
  );

-- abre (ou reaproveita) a conversa com o outro lado, validando o vínculo
create or replace function public.get_or_create_conversation(p_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  me uuid := auth.uid();
  my_role text;
  my_gym uuid;
  o_role text;
  o_gym uuid;
  o_student uuid;
  o_staff uuid;
  cid uuid;
begin
  select role, gym_id into my_role, my_gym from public.profiles where id = me;
  select role, gym_id into o_role, o_gym from public.profiles where id = p_other_id;
  if my_role is null or o_role is null or my_gym is null or o_gym is null or my_gym <> o_gym then
    raise exception 'Conversa indisponível.';
  end if;

  if my_role = 'student' and o_role in ('trainer', 'manager', 'admin') then
    o_student := me;
    o_staff := p_other_id;
    if o_role = 'trainer' and not exists (
      select 1 from public.student_trainers
      where student_id = me and trainer_id = p_other_id
    ) then
      raise exception 'Fale com seu personal vinculado.';
    end if;
  elsif my_role in ('trainer', 'manager', 'admin') and o_role = 'student' then
    o_student := p_other_id;
    o_staff := me;
    if my_role = 'trainer' and not exists (
      select 1 from public.student_trainers
      where student_id = p_other_id and trainer_id = me
    ) then
      raise exception 'Aluno sem vínculo com você.';
    end if;
  else
    raise exception 'Conversa indisponível.';
  end if;

  insert into public.conversations (gym_id, student_id, staff_id)
  values (my_gym, o_student, o_staff)
  on conflict (student_id, staff_id) do update set updated_at = now()
  returning id into cid;
  return cid;
end;
$function$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- mensagem nova: atualiza a conversa + avisa o destinatário no sino
create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_conv record;
  v_name text;
begin
  begin
    update public.conversations set updated_at = now() where id = NEW.conversation_id
    returning gym_id, student_id, staff_id into v_conv;
    if v_conv is null then
      return NEW;
    end if;
    select coalesce(nullif(name, ''), 'Alguém') into v_name
    from public.profiles where id = NEW.sender_id;
    insert into public.notifications (gym_id, user_id, channel, title, body)
    values (
      v_conv.gym_id,
      case when NEW.sender_id = v_conv.student_id then v_conv.staff_id else v_conv.student_id end,
      'in_app',
      'Mensagem de ' || split_part(v_name, ' ', 1),
      left(NEW.body, 90)
    );
  exception when others then
    raise warning 'notify_direct_message falhou: %', sqlerrm;
  end;
  return NEW;
end;
$function$;

drop trigger if exists trg_notify_direct_message on public.direct_messages;
create trigger trg_notify_direct_message
after insert on public.direct_messages
for each row execute function public.notify_direct_message();
