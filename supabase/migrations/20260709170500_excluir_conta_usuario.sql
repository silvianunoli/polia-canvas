-- LGPD (direito à eliminação, art. 18) — apaga TODOS os dados da usuária.
--
-- Roda como a própria usuária: usa auth.uid() internamente e NÃO recebe id por
-- parâmetro, então é logicamente impossível apagar a conta de outra pessoa.
-- SECURITY DEFINER pra conseguir apagar mesmo de tabelas onde a usuária não tem
-- policy de DELETE (ex.: logs admin-only com o user_id dela). Tudo numa
-- transação: ou apaga tudo, ou nada.
--
-- Chamada pela server function excluirMinhaConta (src/lib/conta.functions.ts),
-- que antes cancela a assinatura no Stripe e depois remove o usuário do Auth.
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
  DELETE FROM public.habito_logs WHERE user_id = uid;
  DELETE FROM public.tarefas WHERE user_id = uid;
  DELETE FROM public.foco_sessoes WHERE user_id = uid;
  DELETE FROM public.clientes WHERE user_id = uid;
  DELETE FROM public.assinaturas WHERE user_id = uid;
  DELETE FROM public.checkins WHERE user_id = uid;
  DELETE FROM public.coach_insights WHERE user_id = uid;
  DELETE FROM public.coach_mensagens WHERE user_id = uid;
  DELETE FROM public.conquistas WHERE user_id = uid;
  DELETE FROM public.edge_function_logs WHERE user_id = uid;
  DELETE FROM public.entregaveis WHERE user_id = uid;
  DELETE FROM public.equipe_membros WHERE user_id = uid;
  DELETE FROM public.erros_app WHERE user_id = uid;
  DELETE FROM public.etapa1_entregavel WHERE user_id = uid;
  DELETE FROM public.etapa1_respostas WHERE user_id = uid;
  DELETE FROM public.eventos_analytics WHERE user_id = uid;
  DELETE FROM public.feedback_responses WHERE user_id = uid;
  DELETE FROM public.financeiro_mensal WHERE user_id = uid;
  DELETE FROM public.google_calendar_conexoes WHERE user_id = uid;
  DELETE FROM public.habitos WHERE user_id = uid;
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
  DELETE FROM public.user_profile WHERE user_id = uid;
  DELETE FROM public.user_progress WHERE user_id = uid;

  -- Perfil por último
  DELETE FROM public.profiles WHERE id = uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.excluir_dados_do_usuario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_dados_do_usuario() TO authenticated;
