-- Liga o aviso da véspera (ONE-174). Aplicar só depois do e-mail de teste
-- aprovado pela Sil e da função entregas-amanha publicada.
-- 21h UTC = 18h de Brasília (sem horário de verão desde 2019).
select cron.schedule('entregas-amanha', '0 21 * * *', $$select public.disparar_entregas_amanha()$$);
