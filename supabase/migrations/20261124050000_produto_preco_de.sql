-- Preço de-por na Vitrine online (24/11/2026, ONE-239, desenho aprovado pela Sil).
-- preco_de é o preço "antes", mostrado riscado na loja ao lado do preço de
-- venda. Só aparece quando é maior que o preço de venda (a regra mora em
-- precoDeValido, src/lib/loja.ts). A cliente paga sempre o preco_venda: o
-- pedido da loja não lê esta coluna.
alter table public.produtos
  add column if not exists preco_de numeric(12, 2)
  check (preco_de is null or preco_de > 0);

comment on column public.produtos.preco_de is
  'Preço "antes", riscado na Vitrine online. Só aparece quando maior que preco_venda.';
