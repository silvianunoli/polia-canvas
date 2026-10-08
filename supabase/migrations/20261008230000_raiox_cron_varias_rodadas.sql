-- Raio-x mensal: várias rodadas no dia 1º em vez de uma.
--
-- O BURACO
-- O cron 'raiox-mensal' (20260727191000) roda uma vez, dia 1º às 09h UTC. A
-- edge function raiox-mensal-cron gerava uma usuária por vez, com Gemini Pro
-- de até 20 s cada: com 20 a 40 contas Pro estourava o teto de tempo da edge
-- function e quem ficava pra trás não recebia o raio-x do mês fechado.
--
-- O QUE FAZ
-- A função agora processa até 4 usuárias em paralelo e para de começar
-- usuária nova depois de 90 s (resposta traz "pendentes"). Esta migração faz
-- o cron rodar a cada 20 min das 09h00 às 11h40 UTC do dia 1º (06h00 às 08h40
-- em Brasília), 9 rodadas. Cada rodada pula quem já tem raio-x do mês
-- (checagem por ia_raiox.user_id + mes), então ninguém recebe dois. 20 min de
-- intervalo é bem mais que o teto de uma execução, então duas rodadas nunca
-- se sobrepõem. Quem falhou no Gemini numa rodada é tentado de novo na
-- seguinte.
--
-- cron.schedule com um jobname que já existe atualiza o agendamento desse job
-- (pg_cron >= 1.3), sem criar outro. disparar_raiox_mensal() não muda.
--
-- APLICAR pelo MCP apply_migration (supabase db push falha pela dessincronia
-- antiga do histórico). NÃO APLICADA ainda. Publicar a edge function nova
-- antes ou junto: com a função antiga (sequencial) as rodadas extras também
-- funcionam, porque a checagem de "já existe" já estava lá.
-- Conferir depois: select jobname, schedule from cron.job where jobname = 'raiox-mensal';

select cron.schedule(
  'raiox-mensal',
  '*/20 9-11 1 * *',
  $$select public.disparar_raiox_mensal()$$
);
