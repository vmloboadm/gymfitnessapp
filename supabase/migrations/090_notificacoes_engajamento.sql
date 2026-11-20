-- 090: notificações com o nome de quem recebe, tom de cobrança e menos ruído.
--
-- Por quê (dados de 20/11, últimos 30 dias):
--   * "Aluno novo na academia" (gestor 186, personal 93) e "Treino concluído"
--     (gestor 134, personal 34): 0% lidos. Ruído puro para quem não usa o painel.
--   * Aluno: 767 avisos no total, 2,9% lidos. Texto genérico não chama atenção.
--
-- Como: uma trigger BEFORE INSERT em notifications pega TODAS as origens
-- (funções SQL das migrations, rotas da API), sem mudar código em cada ponto.
-- Os títulos ficam iguais, porque o roteamento de push (src/lib/push-routing.ts)
-- casa pelo início do título. O nome entra no começo do texto.

create or replace function public.notif_texto_engajamento(
  p_title text, p_body text, p_primeiro text, p_role text
)
returns table (keep_it boolean, texto text)
language plpgsql
immutable
as $$
declare
  nome text := coalesce(nullif(trim(p_primeiro), ''), 'Atleta');
  v_txt text;
begin
  -- Gestor e personal: só o que pede ação. O resto some.
  if p_role in ('manager', 'trainer', 'admin') then
    if p_title ~ '^(Aluno novo na academia|Treino concluído|Ajustes no editor)' then
      return query select false, p_body;
      return;
    end if;
    return query select true, p_body;
    return;
  end if;

  -- Aluno: nome primeiro, cobrança e elogio no mesmo tom.
  if p_title like 'Novo treino liberado%' then
    v_txt := nome || ', seu treino novo já está liberado. Entra hoje e começa.';
  elsif p_title like 'Novo treino disponível%' then
    v_txt := nome || ', treino novo na área. Não deixa pra depois.';
  elsif p_title = 'Cadastro aprovado' then
    v_txt := nome || ', você está aprovado. Bem-vindo. Agora o difícil é a frequência: começa hoje.';
  elsif p_title like 'Conquista liberada%' or p_title like '2 conquistas liberadas%' then
    v_txt := nome || ', conquista desbloqueada. Essa é sua. Agora continua no ritmo.';
  elsif p_title like 'Você ganhou pontos!%' then
    v_txt := nome || ', ' || coalesce(p_body, '') || ' Quem para perde posição.';
  elsif p_title like 'Novo recorde%' then
    v_txt := nome || ', novo recorde. Isso é progresso de verdade. Não para aqui.';
  elsif p_title like 'Meta da semana%' then
    v_txt := nome || ', meta da semana batida. Não relaxa: a próxima sobe a régua.';
  elsif p_title like 'Sequência%' then
    v_txt := nome || ', sequência firme. Não quebra agora.';
  elsif p_title like 'Curtiram sua publicação%' then
    v_txt := nome || ', alguém curtiu seu post. Posta mais: a galera está olhando.';
  elsif p_title like 'Força no desafio%' then
    v_txt := nome || ', seu grupo está contando com você. Aparece hoje.';
  elsif p_title like 'Você está no Desafio%' then
    v_txt := nome || ', você entrou no desafio. Agora é cumprir.';
  elsif p_title like 'Seu treino foi registrado%' then
    v_txt := nome || ', treino registrado. Bom. Amanhã tem mais.';
  else
    v_txt := nome || ', ' || coalesce(p_body, '');
  end if;

  return query select true, v_txt;
end;
$$;

create or replace function public.trg_notif_engajamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v record;
begin
  select p.role, split_part(coalesce(p.name, ''), ' ', 1) as primeiro
    into r
    from profiles p
   where p.id = new.user_id;

  select * into v
    from public.notif_texto_engajamento(new.title, new.body, r.primeiro, r.role);

  if not v.keep_it then
    return null; -- descarta o aviso antes de gravar (não vai para sininho nem push)
  end if;

  new.body := v.texto;
  return new;
end;
$$;

drop trigger if exists trg_notif_engajamento on public.notifications;
create trigger trg_notif_engajamento
  before insert on public.notifications
  for each row execute function public.trg_notif_engajamento();
