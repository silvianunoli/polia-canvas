-- Faxina única: cemitério "Seu Dia" (nenhuma tela lê ou escreve nessas
-- tabelas hoje; checkins ainda rodava uma query vazia no header a cada
-- sessão, já removida do código) e resíduo de equipe (feature removida por
-- decisão de posicionamento — "a Pólia é pra quem toca sozinha" — mas o
-- Planner ainda consultava a tabela e renderizava um seletor inalcançável).
drop table if exists public.habito_logs;
drop table if exists public.habitos;
drop table if exists public.foco_sessoes;
drop table if exists public.coach_mensagens;
drop table if exists public.coach_insights;
drop table if exists public.checkins;

alter table public.tarefas drop column if exists assigned_to;
drop table if exists public.equipe_membros;

-- Flag sem leitor no código (admin.flags.tsx a lista como "sem efeito ainda").
delete from public.feature_flags where key = 'broadcast_ativo';

-- excluir_dados_do_usuario() apagava explicitamente das tabelas acima; sem
-- elas, essas linhas quebrariam a exclusão de conta (LGPD) na próxima
-- chamada. Redefine a função sem as tabelas removidas.
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
  DELETE FROM public.conquistas WHERE user_id = uid;
  DELETE FROM public.edge_function_logs WHERE user_id = uid;
  DELETE FROM public.entregaveis WHERE user_id = uid;
  DELETE FROM public.erros_app WHERE user_id = uid;
  DELETE FROM public.etapa1_entregavel WHERE user_id = uid;
  DELETE FROM public.etapa1_respostas WHERE user_id = uid;
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
  DELETE FROM public.user_profile WHERE user_id = uid;
  DELETE FROM public.user_progress WHERE user_id = uid;

  -- Perfil por último
  DELETE FROM public.profiles WHERE id = uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.excluir_dados_do_usuario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_dados_do_usuario() TO authenticated;
