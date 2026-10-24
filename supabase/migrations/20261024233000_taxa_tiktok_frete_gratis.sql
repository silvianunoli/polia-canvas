-- Taxa do TikTok Shop pela tabela oficial (VND-05). O TikTok cobra por item e por
-- faixa de preço; a conta mora em supabase/functions/_shared/taxaTiktokShop.ts e
-- vale para todo mundo. O que muda de uma vendedora para outra é só se ela
-- participa do Programa de Frete Grátis (mais 6% por item, teto de R$ 50).
-- Na linha 'tiktok_shop', percentual e fixo deixam de ser usados.
alter table public.taxas_recebimento
  add column if not exists frete_gratis boolean not null default false;

comment on column public.taxas_recebimento.frete_gratis is
  'Só na chave tiktok_shop: a vendedora participa do Programa de Frete Grátis do TikTok.';
