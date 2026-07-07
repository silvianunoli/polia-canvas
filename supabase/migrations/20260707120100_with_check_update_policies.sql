-- Fecha o "roubo de posse": policies de UPDATE só tinham USING (quais linhas posso mexer),
-- sem WITH CHECK (o que a linha pode virar). Sem isso, a usuária A podia UPDATE ... SET
-- user_id = <B> e migrar a linha pra conta de B. WITH CHECK idêntico ao USING impede.

ALTER POLICY "Checkins: dono atualiza" ON public.checkins WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Clientes: dono atualiza" ON public.clientes WITH CHECK (auth.uid() = user_id);
ALTER POLICY "CoachInsights: dono atualiza" ON public.coach_insights WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Conquistas: dono atualiza" ON public.conquistas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Entregaveis: dono atualiza" ON public.entregaveis WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Equipe: dono atualiza" ON public.equipe_membros WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own entregavel" ON public.etapa1_entregavel WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own etapa1 respostas" ON public.etapa1_respostas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Financeiro: dono atualiza" ON public.financeiro_mensal WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Habitos: dono atualiza" ON public.habitos WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Metas: dono atualiza" ON public.metas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Notas: dono atualiza" ON public.notas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Profiles: admin atualiza" ON public.profiles WITH CHECK (is_admin(auth.uid()));
ALTER POLICY "quadro_colunas_update_own" ON public.quadro_colunas WITH CHECK (EXISTS ( SELECT 1 FROM quadros q WHERE ((q.id = quadro_colunas.quadro_id) AND (q.user_id = auth.uid()))));
ALTER POLICY "Quadros: dono atualiza" ON public.quadros WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Tarefas: dono atualiza" ON public.tarefas WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own user_profile" ON public.user_profile WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own progress" ON public.user_progress WITH CHECK (auth.uid() = user_id);
