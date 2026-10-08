-- QA-27: a trigger de cota do plano grátis (20260727130000) ainda escreve os
-- nomes de plano mortos na mensagem de erro: "Cota do plano Confere atingida"
-- e "assine o Controle pra editar". Desde 14/09/2026 os nomes visíveis são
-- Grátis / Premium / Pro (a chave interna 'confere' continua igual).
--
-- Hoje nenhuma tela mostra esse texto cru (ModalProduto, Planner e Caderno
-- trocam o erro do banco por frase da Pólia One), mas ele vai pra log, pro
-- Sentry/erro capturado e pra qualquer tela futura que repasse error.message.
--
-- Por que reescrever só as strings em vez de um CREATE OR REPLACE completo:
-- este projeto já teve função deployada que nunca entrou no histórico de
-- migração. Trocar a string dentro da definição que está NO AR preserva
-- qualquer ajuste de lógica feito direto no banco. Se a string antiga não for
-- encontrada (função já mudou), a migration para com erro em vez de seguir
-- calada, pra alguém olhar a definição real antes.
--
-- Mexe só no texto. Lógica, triggers, owner e grants ficam como estão
-- (CREATE OR REPLACE preserva os privilégios: o revoke de PUBLIC/anon/
-- authenticated da 20260727170000 continua valendo).

do $mig$
declare
  v_def text;
  v_antiga_insert constant text := 'Cota do plano Confere atingida (limite de % em %)';
  v_nova_insert   constant text := 'Limite do plano Grátis atingido (% em %). Assine o Premium pra liberar.';
  v_antiga_update constant text := 'Este item está além da cota do plano Confere — assine o Controle pra editar';
  v_nova_update   constant text := 'Este item passou do limite do plano Grátis. Assine o Premium pra editar.';
begin
  v_def := pg_get_functiondef('public.assert_cota_confere()'::regprocedure);

  if position(v_antiga_insert in v_def) = 0 or position(v_antiga_update in v_def) = 0 then
    raise exception 'assert_cota_confere no ar não tem o texto esperado; conferir a definição real antes de aplicar';
  end if;

  v_def := replace(v_def, v_antiga_insert, v_nova_insert);
  v_def := replace(v_def, v_antiga_update, v_nova_update);

  execute v_def;
end;
$mig$;

comment on function public.assert_cota_confere() is
  'Trigger de cota do plano Grátis (chave interna confere, Fase 1 de entitlement). Argumento: limite (integer) da tabela.';
