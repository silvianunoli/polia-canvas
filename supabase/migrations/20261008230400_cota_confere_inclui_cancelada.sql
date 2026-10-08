-- Cota do plano Grátis também pra quem cancelou (decisão já tomada: 'cancelada'
-- é Grátis no app, igual a tierDoPlano em src/lib/planos.ts).
--
-- O BURACO
-- assert_cota_confere (20260727130000, texto ajustado em 20261008140500) só
-- limita plano = 'confere':
--     if v_plano is distinct from 'confere' then
--       return new;
-- Quem cancelou a assinatura fica com plano 'cancelada' e passa por esse
-- return: no banco, sem limite nenhum de produtos, quadros e notas. A tela
-- trata como Grátis, mas a API do Supabase (com o JWT dela) aceita tudo.
-- A cota de cartões (assert_cota_cartoes, 20261008210000) já conta
-- 'cancelada' como Grátis; esta migração deixa as duas iguais.
--
-- O QUE MUDA
-- Só aquela linha, trocada por:
--     if coalesce(v_plano, 'confere') not in ('confere', 'cancelada') then
-- (perfil sem plano também conta como Grátis, mesma leitura do app.)
--
-- EFEITO PRA QUEM CANCELOU (comportamento desejado)
--  - INSERT além da cota: barrado (5 produtos, 1 quadro, 1 nota ativa).
--  - UPDATE de item que está além da cota (os mais novos por created_at):
--    barrado, o item vira só leitura. Os itens dentro da cota continuam
--    editáveis.
--  - Arquivar produto / arquivar ou mandar nota pra lixeira: liberado (a
--    função devolve cedo quando a linha deixa de ser "ativa").
--  - EXCLUIR: liberado. Os gatilhos são BEFORE INSERT OR UPDATE nas três
--    tabelas; DELETE nem chama a função.
--  - materializar_planejamento já trata P0001 da cota (20261008160000): o
--    Planejamento salva e o produto além da cota só não é criado.
--
-- COMO (mesmo padrão da 20261008140500)
-- Pega a definição que está NO AR (pg_get_functiondef) e troca só esse
-- trecho, preservando qualquer ajuste feito direto no banco. Se o trecho
-- esperado não existir, a migração para com erro pra alguém olhar a definição
-- real antes. Se a troca já foi feita, só avisa e sai (idempotente).
-- CREATE OR REPLACE preserva owner e grants (revoke de PUBLIC/anon/
-- authenticated da 20260727170000 continua valendo).
--
-- APLICAR pelo MCP apply_migration (supabase db push falha pela dessincronia
-- antiga do histórico). NÃO APLICADA ainda.

do $mig$
declare
  v_def text;
  v_antigo constant text := 'if v_plano is distinct from ''confere'' then';
  v_novo   constant text := 'if coalesce(v_plano, ''confere'') not in (''confere'', ''cancelada'') then';
begin
  v_def := pg_get_functiondef('public.assert_cota_confere()'::regprocedure);

  if position(v_novo in v_def) > 0 then
    raise notice 'assert_cota_confere já conta cancelada como Grátis: nada a fazer.';
    return;
  end if;

  if position(v_antigo in v_def) = 0 then
    raise exception 'assert_cota_confere no ar não tem o trecho esperado (%); conferir a definição real antes de aplicar', v_antigo;
  end if;

  execute replace(v_def, v_antigo, v_novo);
end;
$mig$;

comment on function public.assert_cota_confere() is
  'Trigger de cota do plano Grátis (chave interna confere; cancelada e perfil sem plano contam como Grátis desde 20261008230400). Argumento: limite (integer) da tabela.';
