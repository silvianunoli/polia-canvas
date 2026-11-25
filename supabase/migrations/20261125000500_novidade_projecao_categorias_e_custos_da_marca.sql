-- Projeção: só categorias de custo fixo contam e, sem nada lançado, entram os Custos da marca (ONE-251, itens 3 e 4).
-- Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('A Projeção agora lê os Custos da marca',
   'Sem custo fixo lançado no Financeiro, a Projeção usa os Custos da marca. E só as saídas em categorias de custo fixo, como Espaço (aluguel) e Internet e telefone, entram na conta: Outros e as categorias criadas na hora ficam fora, e o campo mostra quanto ficou.',
   '/projecao', 'Abrir a Projeção');
