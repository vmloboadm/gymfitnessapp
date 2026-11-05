-- 084_whatsapp_variedade_e_teto.sql
-- Recomendações práticas para proteger o número (usado por humano e pela IA):
--   1. mais variedade de texto: 4 variantes por campanha;
--   2. a 4ª variante NÃO repete o link da sequência longa (usa a Home /app ou
--      o Ranking do desafio), quebrando o padrão "mesmo link, mesma frase";
--   3. reescreve as mensagens AINDA NA FILA com a rotação nova (as já enviadas
--      não são tocadas).
-- O teto diário e o freio de falhas moram no enviador (scripts/whatsapp-drip.mjs),
-- porque é ele quem decide enviar — e é lá que o número é protegido.

-- ------------------------------------------------------- campanha treino pronto
create or replace function public.starter_campaign_message(p_first text, p_variant integer)
returns text
language sql
immutable
as $function$
  select case p_variant % 4
    when 0 then
      'Oi, ' || p_first || '! Aqui é da GymFitness 💪' || chr(10) || chr(10) ||
      'Seu treino já está pronto pra você escolher no app: tem opções AB, ABC, ABCD e ABCDE montadas pela nossa personal, do iniciante ao avançado. Leva 1 minutinho:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Escolheu, já pode treinar hoje! Qualquer dúvida é só responder aqui 😉'
    when 1 then
      'E aí, ' || p_first || '! Tudo certo? Aqui é da GymFitness.' || chr(10) || chr(10) ||
      'Liberamos treinos prontos no app pra ninguém ficar esperando: você escolhe o que combina com você (iniciante, intermediário ou avançado) e começa na hora 👇' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Depois me conta qual você escolheu! 💪'
    when 2 then
      'Oi, ' || p_first || ', tudo bem? 😊 Passando pra avisar que o seu treino na GymFitness já pode ser escolhido no app.' || chr(10) || chr(10) ||
      'São treinos prontos, com divisão certinha (tipo ABC), e se quiser algo sob medida dá pra pedir à personal ali mesmo:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/treino' || chr(10) || chr(10) ||
      'Bora começar essa semana? 🔥'
    else
      'Oi, ' || p_first || '! Tudo bem? Aqui é da equipe GymFitness 😊' || chr(10) || chr(10) ||
      'Aquele treino que a gente comentou já está no app, esperando você. Abre o app e toca em Treino: dá pra escolher a divisão que mais combina com o seu dia a dia.' || chr(10) || chr(10) ||
      'Qualquer dúvida, me responde por aqui que eu te ajudo a escolher.' || chr(10) ||
      'https://gymfitnesscampos.com.br/app'
  end;
$function$;

-- ------------------------------------------------------- campanha do desafio
create or replace function public.challenge_campaign_message(p_first text, p_title text, p_goal integer, p_ends date, p_variant integer)
returns text
language sql
immutable
as $function$
  select case p_variant % 4
    when 0 then
      'Oi, ' || p_first || '! Aqui é da GymFitness ☀️' || chr(10) || chr(10) ||
      'Começou o ' || p_title || ': meta de ' || p_goal || ' dias de treino até ' || to_char(p_ends, 'DD/MM') ||
      ', com ranking ao vivo no app e prêmio pros primeiros. Cada treino ou check-in conta!' || chr(10) || chr(10) ||
      'Entra com 1 toque aqui 👇' || chr(10) || 'https://gymfitnesscampos.com.br/app' || chr(10) || chr(10) ||
      'Bora fechar o ano no ritmo? 💪'
    when 1 then
      'E aí, ' || p_first || '! Tudo certo? 😄' || chr(10) || chr(10) ||
      'A galera da GymFitness já tá no ' || p_title || ' e o ranking tá pegando fogo 🔥 São ' || p_goal ||
      ' dias de treino até ' || to_char(p_ends, 'DD/MM') || ' e prêmio pro Top 3.' || chr(10) || chr(10) ||
      'Entra lá no app e mostra quem manda:' || chr(10) || 'https://gymfitnesscampos.com.br/app'
    when 2 then
      'Oi, ' || p_first || ', tudo bem? Passando pra te chamar pro ' || p_title || ' da GymFitness ☀️' || chr(10) || chr(10) ||
      'É simples: treinou ou fez check-in, conta 1 dia. Meta de ' || p_goal || ' dias até ' || to_char(p_ends, 'DD/MM') ||
      ', ranking no app e prêmio no final.' || chr(10) || chr(10) ||
      'Topa? É só entrar aqui:' || chr(10) || 'https://gymfitnesscampos.com.br/app'
    else
      'Oi, ' || p_first || '! Já ouviu falar do ' || p_title || '? 😃' || chr(10) || chr(10) ||
      'É a galera treinando junto até ' || to_char(p_ends, 'DD/MM') || ': cada dia de treino ou check-in entra no ranking do app, e o Top 3 leva prêmio.' || chr(10) || chr(10) ||
      'O desafio está logo no topo da aba Ranking:' || chr(10) ||
      'https://gymfitnesscampos.com.br/app/ranking' || chr(10) || chr(10) ||
      'Qualquer coisa, me chama aqui 💪'
  end;
$function$;

-- --------------------------------------------- reescreve o que ainda está na fila
do $$
declare
  r record;
  c record;
  i integer := 0;
  first text;
begin
  for r in
    select o.id, o.campaign, p.name
    from public.whatsapp_outbox o
    join public.profiles p on p.id = o.student_id
    where o.status = 'pending'
    order by o.scheduled_at, o.id
  loop
    first := initcap(lower(split_part(coalesce(nullif(trim(r.name), ''), 'tudo bem'), ' ', 1)));
    if r.campaign = 'treino-pronto' then
      update public.whatsapp_outbox
      set body = public.starter_campaign_message(first, i)
      where id = r.id;
    elsif r.campaign like 'desafio:%' then
      select * into c from public.challenges where id = replace(r.campaign, 'desafio:', '')::uuid;
      if c.id is not null then
        update public.whatsapp_outbox
        set body = public.challenge_campaign_message(first, c.title, c.goal_days, c.ends_on, i)
        where id = r.id;
      end if;
    end if;
    i := i + 1;
  end loop;
end $$;
