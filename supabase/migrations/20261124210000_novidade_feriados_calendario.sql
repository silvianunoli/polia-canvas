-- Feriados e datas do comércio no Calendário (ONE-252). Aplicar junto com o
-- deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('Feriados e datas do comércio no Calendário',
   'O Calendário agora mostra os feriados nacionais e as datas que mexem com as vendas, como Dia das Mães e Black Friday. O sino ao lado de cada data cria um lembrete com aviso 1 semana antes, e o + no canto de cada dia marca um lembrete novo.',
   '/calendario', 'Abrir o Calendário');
