-- Novidade do sino: Painel mais limpo (23/11/2026, pedido da Sil).
-- Os Primeiros passos saíram do topo e viraram janela; a intenção do dia e o
-- atalho do Calendário saíram do Painel. Aplicar só depois do deploy.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'O Painel ficou mais limpo',
  'Os números do mês agora aparecem logo no topo do Painel. Os Primeiros passos abrem numa janela uma vez por dia, e o botão "Primeiros passos" ao lado do botão principal abre de novo. A intenção do dia e o atalho do Calendário saíram do Painel. O Calendário continua no menu.',
  '/painel',
  'Abrir o Painel'
);
