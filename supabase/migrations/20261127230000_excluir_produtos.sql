-- Excluir produtos, um ou vários de uma vez (27/11/2026, pedido da Sil).
--
-- Por que uma função e não um DELETE direto do app:
-- * estoque_movimentos.sku_id é RESTRICT: produto que já teve estoque lançado
--   não sai com um DELETE simples (a cascata pra produto_skus trava). E a dona
--   só lê estoque_movimentos (sem policy de delete), então o app não limpa.
-- * produto_componentes.componente_id e .sku_id são RESTRICT: produto que é
--   peça de um kit não pode sumir debaixo do kit. Esse fica de fora e volta
--   com o nome do kit, pra tela explicar.
--
-- O que fica: venda_itens e producoes guardam produto_nome e o produto_id vira
-- null (FK set null); loja_pedido_itens guarda o nome e não tem FK. Clientes
-- com produto_id também viram null. Somem junto (cascade): variações, fotos,
-- materiais da receita, favoritos e avaliações da loja.
--
-- Devolve {excluidos, bloqueados:[{id,nome,kits}], fotos:[path]}; o app apaga
-- as fotos do bucket depois (o banco não mexe no storage).

create or replace function public.excluir_produtos(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_bloqueados jsonb;
  v_fotos jsonb;
  v_excluidos integer;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    return jsonb_build_object('excluidos', 0, 'bloqueados', '[]'::jsonb, 'fotos', '[]'::jsonb);
  end if;
  if cardinality(p_ids) > 1000 then
    raise exception 'Produtos demais de uma vez' using errcode = 'check_violation';
  end if;

  -- Só o que é da própria dona; id de outra conta some do pedido em silêncio.
  select coalesce(array_agg(id), '{}') into v_ids
    from produtos
   where id = any(p_ids) and user_id = v_uid;

  -- Kit que também vai ser excluído solta as próprias peças primeiro.
  delete from produto_componentes where kit_id = any(v_ids);

  -- Peça de um kit que fica: não exclui, avisa qual kit.
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'kits', b.kits)), '[]'::jsonb)
    into v_bloqueados
    from (
      select p.id, p.nome, string_agg(distinct k.nome, ', ') as kits
        from produtos p
        join produto_componentes c
          on c.componente_id = p.id
          or c.sku_id in (select s.id from produto_skus s where s.produto_id = p.id)
        join produtos k on k.id = c.kit_id
       where p.id = any(v_ids)
       group by p.id, p.nome
    ) b;

  v_ids := array(
    select unnest(v_ids)
    except
    select (e ->> 'id')::uuid from jsonb_array_elements(v_bloqueados) e
  );

  select coalesce(jsonb_agg(distinct f.path), '[]'::jsonb) into v_fotos
    from produto_fotos f
   where f.produto_id = any(v_ids);

  -- Histórico de estoque do produto que sai não tem mais a que se referir.
  delete from estoque_movimentos m
   using produto_skus s
   where m.sku_id = s.id and s.produto_id = any(v_ids) and s.user_id = v_uid;

  delete from produtos where id = any(v_ids) and user_id = v_uid;
  get diagnostics v_excluidos = row_count;

  return jsonb_build_object('excluidos', v_excluidos, 'bloqueados', v_bloqueados, 'fotos', v_fotos);
end;
$function$;

revoke all on function public.excluir_produtos(uuid[]) from public, anon;
grant execute on function public.excluir_produtos(uuid[]) to authenticated;
