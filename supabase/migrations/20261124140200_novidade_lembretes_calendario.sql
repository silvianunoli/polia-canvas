-- Lembretes do Calendário (ONE-244). Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('O Calendário agora guarda os lembretes da marca',
   'Clique num dia do Calendário e marque o que precisa lembrar, como mandar o relatório pra contabilidade. O lembrete pode repetir toda semana, todo mês ou todo ano, e a Pólia One avisa por e-mail às 8h, no dia ou antes. As contas a pagar do Financeiro também aparecem no dia do vencimento.',
   '/calendario', 'Abrir o Calendário');
