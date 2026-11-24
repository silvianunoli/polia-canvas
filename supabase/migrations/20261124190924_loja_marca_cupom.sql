-- Cupom de desconto na Loja da marca (24/11/2026, ONE-239, pedido da Sil: "De-por e
-- cupom juntos"). Os cupons são os mesmos da Vitrine online (catalogo_cupons, por
-- conta): a dona cria uma vez e o código vale nas duas lojas, com um só contador.
--
-- Como na Vitrine, o desconto é sempre calculado aqui, nunca pelo que o navegador
-- manda. Diferenças da loja da marca:
--   - o checkout reserva e só depois cobra: o cupom é conferido ao abrir e o uso só
--     conta quando o pagamento entra (loja_checkout_confirmar). Compra desistida
--     não gasta o cupom;
--   - o desconto vale sobre os produtos, nunca sobre o frete, e deixa ao menos
--     R$ 1,00 de produtos: o Mercado Pago não cobra compra de valor zero.
--     A conta é a mesma de descontoDoCupom (polia-lojas/src/lib/cupom.ts);
--   - não depende de plano (Sil, 07/11/2026: a loja da marca não depende de plano).
--
-- Pode entrar antes do deploy do polia-lojas: sem p_cupom, o checkout segue igual.

-- ── 1. a compra guarda o cupom ──────────────────────────────────────────────
alter table public.loja_checkouts
  add column if not exists desconto numeric(12, 2) not null default 0 check (desconto >= 0),
  add column if not exists cupom_codigo text check (cupom_codigo is null or char_length(cupom_codigo) <= 30);

-- ── 2. a loja confere o cupom antes de abrir a compra (só leitura) ──────────
create or replace function public.loja_cupom_conferir(p_dominio text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid;
  v_cupom public.catalogo_cupons;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select l.user_id into v_uid
    from lojas_marca l
   where l.dominio = lower(btrim(p_dominio)) and l.ativa;
  if v_uid is null then
    return null;
  end if;
  select * into v_cupom from catalogo_cupons
   where user_id = v_uid and codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if not found or not v_cupom.ativo
     or (v_cupom.valido_ate is not null and v_cupom.valido_ate < v_hoje)
     or (v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos) then
    return null;
  end if;
  return jsonb_build_object('codigo', v_cupom.codigo, 'tipo', v_cupom.tipo, 'valor', v_cupom.valor);
end;
$function$;
revoke all on function public.loja_cupom_conferir(text, text) from public, anon, authenticated;
grant execute on function public.loja_cupom_conferir(text, text) to service_role;

-- ── 3. as funções do checkout passam a levar o cupom ────────────────────────
-- Troca trechos exatos, sem reescrever o resto (mesmo jeito de 20261124080000).
-- Se o trecho não estiver lá do jeito esperado, a migration para em vez de seguir.
do $troca$
declare
  r record;
  v_def text;
  v_achou integer;
  v_abrir_velha constant regprocedure := 'public.loja_checkout_abrir(text,jsonb,text,text,text,text,uuid)'::regprocedure;
  v_abrir text;
begin
  -- 3a. loja_checkout_abrir ganha p_cupom (assinatura nova: a velha sai).
  v_abrir := replace(pg_get_functiondef(v_abrir_velha), E'\r\n', E'\n');
  for r in
    select * from (values
      ($a$p_anterior uuid DEFAULT NULL::uuid)$a$,
       $a$p_anterior uuid DEFAULT NULL::uuid, p_cupom text DEFAULT NULL::text)$a$),
      ($a$
  v_id uuid;
begin$a$,
       $a$
  v_id uuid;
  v_codigo text := upper(regexp_replace(coalesce(p_cupom, ''), '\s', '', 'g'));
  v_cupom public.catalogo_cupons;
  v_desconto numeric := 0;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin$a$),
      ($a$
  if p_anterior is not null and exists ($a$,
       $a$
  -- Cupom (ONE-239): os mesmos da Vitrine online. Conferido antes de reservar; o uso
  -- só conta quando o pagamento entra, em loja_checkout_confirmar.
  if v_codigo <> '' then
    select * into v_cupom from catalogo_cupons where user_id = v_uid and codigo = v_codigo;
    if not found or not v_cupom.ativo
       or (v_cupom.valido_ate is not null and v_cupom.valido_ate < v_hoje)
       or (v_cupom.limite_usos is not null and v_cupom.usos >= v_cupom.limite_usos) then
      return jsonb_build_object('resultado', 'cupom');
    end if;
  end if;

  if p_anterior is not null and exists ($a$),
      ($a$

  -- Trava em ordem de id$a$,
       $a$

  -- Desconto só nos produtos, deixando ao menos R$ 1,00 (o Mercado Pago não cobra zero).
  if v_cupom.id is not null then
    v_desconto := least(
      case when v_cupom.tipo = 'percentual' then round(v_subtotal * v_cupom.valor / 100, 2)
           else round(v_cupom.valor, 2) end,
      greatest(v_subtotal - 1, 0));
  end if;

  -- Trava em ordem de id$a$),
      ($a$user_id, dominio, itens, baixas, subtotal, total, prazo_dias_uteis,$a$,
       $a$user_id, dominio, itens, baixas, subtotal, desconto, cupom_codigo, total, prazo_dias_uteis,$a$),
      ($a$v_uid, v_dominio, v_itens, v_baixas, v_subtotal, v_subtotal, least($a$,
       $a$v_uid, v_dominio, v_itens, v_baixas, v_subtotal, v_desconto, v_cupom.codigo, v_subtotal - v_desconto, least($a$),
      ($a$'total', v_subtotal, 'itens'$a$,
       $a$'total', v_subtotal - v_desconto, 'desconto', v_desconto, 'cupom', v_cupom.codigo, 'itens'$a$)
    ) as t(velho, novo)
  loop
    v_achou := (length(v_abrir) - length(replace(v_abrir, r.velho, ''))) / length(r.velho);
    if v_achou <> 1 then
      raise exception 'Trecho % achado % vezes em loja_checkout_abrir (esperado 1)', r.velho, v_achou;
    end if;
    v_abrir := replace(v_abrir, r.velho, r.novo);
  end loop;
  execute 'drop function ' || v_abrir_velha::text;
  execute v_abrir;
  revoke all on function public.loja_checkout_abrir(text, jsonb, text, text, text, text, uuid, text)
    from public, anon, authenticated;
  grant execute on function public.loja_checkout_abrir(text, jsonb, text, text, text, text, uuid, text)
    to service_role;

  -- 3b. o resto: entrega, confirmação e situação da compra.
  for r in
    select * from (values
      ('public.loja_checkout_definir_entrega(text,uuid,text,numeric,jsonb,jsonb,text)'::regprocedure,
       $a$frete = 0, total = subtotal, updated_at$a$,
       $a$frete = 0, total = subtotal - desconto, updated_at$a$),
      ('public.loja_checkout_definir_entrega(text,uuid,text,numeric,jsonb,jsonb,text)'::regprocedure,
       $a$total = subtotal + v_frete,$a$,
       $a$total = subtotal - desconto + v_frete,$a$),
      ('public.loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)'::regprocedure,
       $a$andamento, entrega_em, forma
  ) values ($a$,
       $a$andamento, entrega_em, forma, cupom_codigo
  ) values ($a$),
      ('public.loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)'::regprocedure,
       $a$v.subtotal, 0, v.frete, v_taxa, v.total,$a$,
       $a$v.subtotal, v.desconto, v.frete, v_taxa, v.total,$a$),
      ('public.loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)'::regprocedure,
       $a$'a_fazer', v_entrega, forma_do_meio_mp(p_meio, v.mp_meio)
  );$a$,
       $a$'a_fazer', v_entrega, forma_do_meio_mp(p_meio, v.mp_meio), v.cupom_codigo
  );$a$),
      ('public.loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)'::regprocedure,
       $a$
  update loja_checkouts
     set status = 'pago'$a$,
       $a$
  -- O cupom conta um uso quando o pagamento entra (ONE-239).
  if v.cupom_codigo is not null then
    update catalogo_cupons set usos = usos + 1 where user_id = v.user_id and codigo = v.cupom_codigo;
  end if;

  update loja_checkouts
     set status = 'pago'$a$),
      ('public.loja_checkout_confirmar(text,uuid,text,numeric,numeric,text)'::regprocedure,
       $a$'frete', v.frete,
    'entrega_em'$a$,
       $a$'frete', v.frete,
    'desconto', v.desconto,
    'cupom', v.cupom_codigo,
    'entrega_em'$a$),
      ('public.loja_checkout_situacao(text,uuid)'::regprocedure,
       $a$'frete', c.frete,$a$,
       $a$'frete', c.frete,
    'desconto', c.desconto,
    'cupom', c.cupom_codigo,$a$)
    ) as t(fn, velho, novo)
  loop
    v_def := replace(pg_get_functiondef(r.fn), E'\r\n', E'\n');
    v_achou := (length(v_def) - length(replace(v_def, r.velho, ''))) / length(r.velho);
    if v_achou <> 1 then
      raise exception 'Trecho % achado % vezes em % (esperado 1)', r.velho, v_achou, r.fn;
    end if;
    execute replace(v_def, r.velho, r.novo);
  end loop;
end;
$troca$;
