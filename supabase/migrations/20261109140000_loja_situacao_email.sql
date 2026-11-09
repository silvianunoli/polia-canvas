-- A página de pagamento já preenche o e-mail da compra no formulário de cartão (ONE-200).
create or replace function public.loja_checkout_situacao(p_dominio text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'status', c.status,
    'nome', c.nome,
    'email', c.email,
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
      'prazo_producao', c.prazo_dias_uteis,
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
$function$;

-- Mensagem de quem comprou: entra nos Chamados da conta dona da loja, com o contato
-- da compradora no texto, porque ela não tem login na Pólia One.
create function public.loja_atendimento_abrir(p_dominio text, p_id uuid, p_mensagem text, p_ip_hash text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v public.loja_checkouts;
  v_msg text := btrim(p_mensagem);
  v_num text;
begin
  if char_length(v_msg) not between 5 and 1000 then
    return 'invalido';
  end if;
  select * into v from loja_checkouts where id = p_id and dominio = lower(btrim(p_dominio));
  if not found then
    return 'nao_achou';
  end if;
  if not loja_limite_ok('atendimento:' || p_id::text, 5)
     or (p_ip_hash is not null and not loja_limite_ok('atendimento:ip:' || p_ip_hash, 20)) then
    return 'limite';
  end if;
  v_num := upper(left(v.id::text, 8));
  insert into tickets (user_id, title, body, status, priority, module_ref)
  values (
    v.user_id,
    left('Loja, pedido ' || v_num || ': ' || v.nome, 150),
    v_msg || E'\n\nQuem escreveu: ' || v.nome || E'\nE-mail: ' || v.email || E'\nWhatsApp: ' || v.whatsapp || E'\nPedido: ' || v_num,
    'aberto', 'normal', 'loja'
  );
  return 'ok';
end;
$$;

revoke all on function public.loja_atendimento_abrir(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.loja_atendimento_abrir(text, uuid, text, text) to service_role;
