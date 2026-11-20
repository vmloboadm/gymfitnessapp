-- 091: um emoji por tipo de aviso do aluno, no início do texto. Sem repetir e sem poluir.
-- Só troca o texto gerado pela 090. O título e o roteamento de push não mudam.

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
  -- Gestor e personal: só o que pede ação. O resto some (migration 090).
  if p_role in ('manager', 'trainer', 'admin') then
    if p_title ~ '^(Aluno novo na academia|Treino concluído|Ajustes no editor)' then
      return query select false, p_body;
      return;
    end if;
    return query select true, p_body;
    return;
  end if;

  -- Aluno: emoji no início, nome logo depois, cobrança ou elogio.
  if p_title like 'Novo treino liberado%' then
    v_txt := '🏋️ ' || nome || ', seu treino novo já está liberado. Entra hoje e começa.';
  elsif p_title like 'Novo treino disponível%' then
    v_txt := '🏋️ ' || nome || ', treino novo na área. Não deixa pra depois.';
  elsif p_title = 'Cadastro aprovado' then
    v_txt := '🟠 ' || nome || ', você está aprovado. Bem-vindo. Agora o difícil é a frequência: começa hoje.';
  elsif p_title like 'Conquista liberada%' or p_title like '2 conquistas liberadas%' then
    v_txt := '🏆 ' || nome || ', conquista desbloqueada. Essa é sua. Agora continua no ritmo.';
  elsif p_title like 'Você ganhou pontos!%' then
    v_txt := '⚡ ' || nome || ', ' || coalesce(p_body, '') || ' Quem para perde posição.';
  elsif p_title like 'Novo recorde%' then
    v_txt := '🚀 ' || nome || ', novo recorde. Isso é progresso de verdade. Não para aqui.';
  elsif p_title like 'Meta da semana%' then
    v_txt := '🎯 ' || nome || ', meta da semana batida. Não relaxa: a próxima sobe a régua.';
  elsif p_title like 'Sequência%' then
    v_txt := '🔥 ' || nome || ', sequência firme. Não quebra agora.';
  elsif p_title like 'Curtiram sua publicação%' then
    v_txt := '❤️ ' || nome || ', alguém curtiu seu post. Posta mais: a galera está olhando.';
  elsif p_title like 'Força no desafio%' then
    v_txt := '💪 ' || nome || ', seu grupo está contando com você. Aparece hoje.';
  elsif p_title like 'Você está no Desafio%' then
    v_txt := '💪 ' || nome || ', você entrou no desafio. Agora é cumprir.';
  elsif p_title like 'Seu treino foi registrado%' then
    v_txt := '✅ ' || nome || ', treino registrado. Bom. Amanhã tem mais.';
  else
    v_txt := '🟠 ' || nome || ', ' || coalesce(p_body, '');
  end if;

  return query select true, v_txt;
end;
$$;
