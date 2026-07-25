-- Persiste o breakdown da calculadora de preço junto ao produto, pra permitir
-- "recalcular preço" sem perder a composição (custos, taxas, %s) que gerou o
-- preço sugerido. Hoje "salvar como produto" jogava essa composição fora.
alter table public.produtos
  add column if not exists calculadora_breakdown jsonb;
