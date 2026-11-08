-- Frete pelo Melhor Envio, etapa 4 (ONE-189): o rastreio.
--
-- O aviso assinado do Melhor Envio atualiza a compra e o pedido e manda à compradora o
-- e-mail de envio. Quem escreve é a função melhor-envio, com a service role.

alter table public.loja_checkouts
  add column rastreio_codigo text check (rastreio_codigo is null or char_length(rastreio_codigo) <= 60),
  add column rastreio_url text check (rastreio_url is null or (rastreio_url ~ '^https://' and char_length(rastreio_url) <= 300)),
  add column rastreio_status text check (rastreio_status in ('postada', 'entregue', 'problema')),
  -- Preenchida antes de mandar: o aviso repetido não manda o e-mail duas vezes.
  add column email_envio_em timestamptz;

create unique index loja_checkouts_etiqueta on public.loja_checkouts (etiqueta_id) where etiqueta_id is not null;

-- ── o que a página da compra mostra ───────────────────────────────────────
-- Igual à de 20261108230000, mais o rastreio.
create or replace function public.loja_checkout_situacao(p_dominio text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'status', c.status,
    'nome', c.nome,
    'itens', c.itens,
    'subtotal', c.subtotal,
    'frete', c.frete,
    'total', c.total,
    'entrega_em', (select v.entrega_em from vendas v where v.id = c.venda_id),
    'expira_em', c.expira_em,
    'mp_order_id', c.mp_order_id,
    'mp_meio', c.mp_meio,
    'entrega', jsonb_build_object(
      'tipo', c.entrega_tipo,
      'servico', c.frete_servico ->> 'nome',
      'prazo', (c.frete_servico ->> 'prazo')::integer,
      'instrucoes', case when c.status = 'pago' and c.entrega_tipo = 'retirada' then
        (select l.envio -> 'retirada' ->> 'instrucoes' from lojas_marca l where l.user_id = c.user_id and l.dominio = c.dominio)
      end,
      'rastreio_codigo', c.rastreio_codigo,
      'rastreio_url', c.rastreio_url,
      'rastreio_status', c.rastreio_status
    )
  )
  from loja_checkouts c
  where c.id = p_id and c.dominio = lower(btrim(p_dominio));
$$;

revoke all on function public.loja_checkout_situacao(text, uuid) from public, anon, authenticated;
grant execute on function public.loja_checkout_situacao(text, uuid) to service_role;
