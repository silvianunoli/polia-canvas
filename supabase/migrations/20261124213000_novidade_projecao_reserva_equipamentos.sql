-- Projeção soma a reserva dos equipamentos aos custos fixos (ONE-251). Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('A Projeção agora conta a reserva dos equipamentos',
   'Os custos fixos da Projeção passam a somar a Reserva do mês da aba Equipamentos, em Produtos. O que já foi lançado no Financeiro como Reserva de equipamento naquele mês é descontado, pra não contar duas vezes.',
   '/projecao', 'Abrir a Projeção');
