-- HIG-01: dropar as tabelas mortas da era das 11 etapas.
--
-- ATENÇÃO, LER ANTES DE APLICAR: das 6 tabelas candidatas do board, esta
-- migration droppa 5. A sexta, public.entregaveis, NÃO entra aqui porque
-- AINDA TEM LEITOR VIVO EM PRODUÇÃO: o repo polia-admin consulta
-- .from("entregaveis") em src/routes/usuarios.$id.tsx (card "Entregáveis"
-- da rota /usuarios/$id, registrada no routeTree). Dropar a tabela hoje
-- faz o card exibir 0 pra sempre, calado. Só depois de remover esse card
-- do admin é que entra o drop dela (bloco comentado no fim).
--
-- As 5 daqui não têm nenhum leitor: zero referência em polia-app/src (fora
-- do types.ts gerado), zero em supabase/functions (as 11 edge functions
-- gerar-* já saíram do disco em 29/06) e zero no polia-admin.
--
-- Ordem importa: primeiro os dependentes no banco (triggers e função de
-- exclusão de conta), senão eles quebram na próxima chamada. É o mesmo
-- cuidado que a faxina de 25/07 tomou com o cemitério do Seu Dia.

-- 1) Triggers e funções que escrevem em public.conquistas.
--    trg_conquista_tarefa_florescer já era zumbi: testa status = 'feito',
--    e 'feito' saiu do check de tarefas.status em 30/06 (hoje o check
--    aceita a_fazer/brotando/floresceu/ideias/planejado/hoje/
--    em_progresso/pausado/concluido). Nunca dispara o INSERT.
--    trg_conquista_etapa_fechada roda em TODO update de profiles e só não
--    insere porque nada mais escreve star_N_completed_at.
drop trigger if exists trg_conquista_tarefa_florescer on public.tarefas;
drop trigger if exists trg_conquista_etapa_fechada on public.profiles;
drop function if exists public.fn_conquista_tarefa_florescer();
drop function if exists public.fn_conquista_etapa_fechada();

-- 2) excluir_dados_do_usuario() apaga explicitamente das tabelas abaixo.
--    Sem elas, a exclusão de conta (LGPD, chamada em
--    src/lib/conta.functions.ts) quebraria na próxima chamada. Redefine sem
--    as 5 tabelas removidas. public.entregaveis segue na lista de propósito,
--    porque a tabela continua existindo.
CREATE OR REPLACE FUNCTION public.excluir_dados_do_usuario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sem usuário autenticado';
  END IF;

  -- Filhas sem user_id (cascateiam de quadros/tickets, mas explícito por garantia)
  DELETE FROM public.quadro_colunas WHERE quadro_id IN (SELECT id FROM public.quadros WHERE user_id = uid);
  DELETE FROM public.ticket_messages WHERE ticket_id IN (SELECT id FROM public.tickets WHERE user_id = uid);

  -- Todas as tabelas com dado da usuária (user_id = uid)
  DELETE FROM public.tarefas WHERE user_id = uid;
  DELETE FROM public.clientes WHERE user_id = uid;
  DELETE FROM public.assinaturas WHERE user_id = uid;
  DELETE FROM public.edge_function_logs WHERE user_id = uid;
  DELETE FROM public.entregaveis WHERE user_id = uid;
  DELETE FROM public.erros_app WHERE user_id = uid;
  DELETE FROM public.eventos_analytics WHERE user_id = uid;
  DELETE FROM public.feedback_responses WHERE user_id = uid;
  DELETE FROM public.financeiro_mensal WHERE user_id = uid;
  DELETE FROM public.google_calendar_conexoes WHERE user_id = uid;
  DELETE FROM public.intencoes_dia WHERE user_id = uid;
  DELETE FROM public.lancamentos WHERE user_id = uid;
  DELETE FROM public.metas WHERE user_id = uid;
  DELETE FROM public.notas WHERE user_id = uid;
  DELETE FROM public.planejamento_campos WHERE user_id = uid;
  DELETE FROM public.planejamento_respostas WHERE user_id = uid;
  DELETE FROM public.planejamento_secoes WHERE user_id = uid;
  DELETE FROM public.presencas WHERE user_id = uid;
  DELETE FROM public.produtos WHERE user_id = uid;
  DELETE FROM public.quadros WHERE user_id = uid;
  DELETE FROM public.tickets WHERE user_id = uid;

  -- Perfil por último
  DELETE FROM public.profiles WHERE id = uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.excluir_dados_do_usuario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_dados_do_usuario() TO authenticated;

-- 3) As tabelas. Policies de RLS, índices e triggers de updated_at caem
--    junto com a tabela, não precisam de drop próprio.
drop table if exists public.conquistas;
drop table if exists public.etapa1_entregavel;
drop table if exists public.etapa1_respostas;
drop table if exists public.user_profile;
drop table if exists public.user_progress;

-- 4) PENDENTE, NÃO DESCOMENTAR AINDA. Só depois que o card "Entregáveis"
--    sair de polia-admin/src/routes/usuarios.$id.tsx e o admin for
--    deployado. Ao descomentar, tirar também a linha
--    "DELETE FROM public.entregaveis" da função acima.
-- drop table if exists public.entregaveis;
