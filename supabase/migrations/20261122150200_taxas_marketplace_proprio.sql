-- Marketplace cadastrado à mão nas taxas (22/11/2026, pedido da Sil). Além de
-- Shopee, TikTok Shop e Mercado Livre, a dona pode criar o marketplace dela
-- (Elo7, Amazon, Magalu...) com percentual + fixo. A chave nasce na tela como
-- mkt_<nome-sem-acento> e o nome que ela digitou vai em `nome`.
-- No TikTok Shop, percentual e fixo deixam de ser ignorados: preenchidos, valem
-- no lugar da tabela oficial (vazio segue a tabela, como antes).

alter table public.taxas_recebimento
  add column if not exists nome text check (nome is null or char_length(nome) between 1 and 40);

alter table public.taxas_recebimento drop constraint if exists taxas_recebimento_chave_check;
alter table public.taxas_recebimento
  add constraint taxas_recebimento_chave_check check (
    chave in (
      'pix', 'dinheiro', 'debito', 'credito', 'credito_parcelado', 'link', 'shopee', 'tiktok_shop',
      'mercado_livre'
    )
    or (chave ~ '^mkt_[a-z0-9_]{1,40}$' and nome is not null)
  );
