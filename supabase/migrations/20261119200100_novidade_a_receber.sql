-- "A receber" no Financeiro (ONE-207 Fase 2, 19/11/2026). Aplicar junto com o
-- deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('O Financeiro mostra o que falta receber',
   'A seção "A receber" junta as vendas a receber de Vendas e as contas que você cadastra: fiado, resto de encomenda, parcela da cliente. No "Recebi", a forma de recebimento puxa a taxa cadastrada e mostra quanto deve cair na conta.',
   '/financeiro#a-receber', 'Ver o que falta receber');
