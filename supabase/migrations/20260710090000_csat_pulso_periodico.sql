-- Adiciona o gatilho de pulso periódico (check-in de relacionamento a cada
-- ~30 dias, disparado no client) aos tipos aceitos em feedback_responses.
-- O gatilho existente já cobria entregável concluído e chamado resolvido.
ALTER TABLE public.feedback_responses
  DROP CONSTRAINT feedback_responses_trigger_type_check;
ALTER TABLE public.feedback_responses
  ADD CONSTRAINT feedback_responses_trigger_type_check
  CHECK (trigger_type IN ('entregavel_concluido', 'chamado_resolvido', 'pulso_periodico'));
