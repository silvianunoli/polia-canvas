-- Liga os avisos dos lembretes do Calendário (ONE-244). Aplicar só depois do
-- teste na conta de teste da Sil (+teste2, Pro) e da função lembretes-calendario publicada.
-- 11h UTC = 8h de Brasília (sem horário de verão desde 2019).
select cron.schedule('lembretes-calendario', '0 11 * * *', $$select public.disparar_lembretes_calendario()$$);
