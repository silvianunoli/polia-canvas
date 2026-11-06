-- Seção "Na loja" da janela de produto (ONE-181, fase 1 do ONE-178, 06/11/2026).
-- Só vale pra conta que tem loja de marca (linha em lojas_marca): é quem vê a
-- seção. Grava de uma vez como o produto vende, os eixos e as combinações.
--
-- Diferente da salvar_estoque_produto, aceita variação sem controle de estoque:
-- sob encomenda também tem cor e tamanho. Quantidade de combinação que já existe
-- não muda aqui: segue pela aba Estoque, que deixa o movimento no histórico.
--
-- p_eixos: ["Cor", "Tamanho"]. Vazio = produto sem variação.
-- p_combinacoes: [{ "id": uuid|null, "opcoes": {"Cor": "Azul", "Tamanho": "P"},
--                   "preco": numero|null, "foto_path": texto|null, "inicial": int }]
-- p_inicial_padrao: quantidade do produto sem variação, quando o registro é novo.

create or replace function public.salvar_combinacoes_loja(
  p_produto_id uuid,
  p_controla boolean,
  p_eixos jsonb default '[]'::jsonb,
  p_combinacoes jsonb default '[]'::jsonb,
  p_inicial_padrao integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_controla boolean := coalesce(p_controla, false);
  v_item jsonb;
  v_eixo text;
  v_valor text;
  v_nome text;
  v_id uuid;
  v_preco numeric;
  v_foto text;
  v_inicial integer;
  v_qtd_eixos integer;
  v_qtd_combinacoes integer;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from lojas_marca where user_id = v_uid) then
    raise exception 'Conta sem loja de marca' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from produtos where id = p_produto_id and user_id = v_uid for update;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'no_data_found';
  end if;

  if p_eixos is null or jsonb_typeof(p_eixos) <> 'array' or jsonb_array_length(p_eixos) > 3
     or p_combinacoes is null or jsonb_typeof(p_combinacoes) <> 'array' or jsonb_array_length(p_combinacoes) > 200 then
    raise exception 'Combinações inválidas' using errcode = 'check_violation';
  end if;
  v_qtd_eixos := jsonb_array_length(p_eixos);
  v_qtd_combinacoes := jsonb_array_length(p_combinacoes);
  -- Com eixo tem que ter combinação, e sem eixo não pode ter.
  if (v_qtd_eixos = 0) <> (v_qtd_combinacoes = 0) then
    raise exception 'Combinações inválidas' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_eixos) e
     where jsonb_typeof(e) <> 'string' or char_length(btrim(e #>> '{}')) not between 1 and 40
  ) or (select count(distinct lower(btrim(e #>> '{}'))) from jsonb_array_elements(p_eixos) e) <> v_qtd_eixos then
    raise exception 'Nome de opção inválido' using errcode = 'check_violation';
  end if;

  update produtos set controla_estoque = v_controla, eixos_variacao = p_eixos
   where id = p_produto_id and user_id = v_uid;

  -- Arquiva o que saiu da lista (antes de inserir, pra liberar o nome). A linha
  -- padrão, sem nome, só sai se virou produto com variação e não tem saldo.
  update produto_skus s set arquivado = true
   where s.produto_id = p_produto_id and s.user_id = v_uid and not s.arquivado
     and not exists (
       select 1 from jsonb_array_elements(p_combinacoes) c
        where nullif(c ->> 'id', '')::uuid = s.id
     )
     and (
       s.variacao is not null
       or (v_qtd_combinacoes > 0 and coalesce(
         (select sum(m.quantidade) from estoque_movimentos m where m.sku_id = s.id), 0) = 0)
     );

  for v_item in select * from jsonb_array_elements(p_combinacoes) loop
    v_nome := null;
    for v_eixo in select e #>> '{}' from jsonb_array_elements(p_eixos) e loop
      v_valor := btrim(v_item -> 'opcoes' ->> v_eixo);
      if v_valor is null or char_length(v_valor) not between 1 and 40 then
        raise exception 'Combinação sem valor' using errcode = 'check_violation';
      end if;
      v_nome := case when v_nome is null then v_valor else v_nome || ' / ' || v_valor end;
    end loop;
    if char_length(v_nome) > 80 then
      raise exception 'Nome de combinação longo demais' using errcode = 'check_violation';
    end if;

    v_preco := round((v_item ->> 'preco')::numeric, 2);
    if v_preco is not null and (v_preco < 0 or v_preco > 100000) then
      raise exception 'Preço inválido' using errcode = 'check_violation';
    end if;
    v_foto := nullif(btrim(v_item ->> 'foto_path'), '');
    if v_foto is not null and (char_length(v_foto) > 200 or v_foto not like v_uid::text || '/%') then
      raise exception 'Foto inválida' using errcode = 'check_violation';
    end if;
    v_inicial := greatest(coalesce((v_item ->> 'inicial')::integer, 0), 0);
    v_id := nullif(v_item ->> 'id', '')::uuid;

    if v_id is not null then
      update produto_skus set
        variacao = v_nome, opcoes = v_item -> 'opcoes', preco_venda = v_preco, foto_path = v_foto
       where id = v_id and produto_id = p_produto_id and user_id = v_uid and not arquivado;
      if not found then
        raise exception 'Variação não encontrada' using errcode = 'no_data_found';
      end if;
    else
      insert into produto_skus (user_id, produto_id, variacao, opcoes, preco_venda, foto_path)
      values (v_uid, p_produto_id, v_nome, v_item -> 'opcoes', v_preco, v_foto)
      returning id into v_id;
      if v_controla and v_inicial > 0 then
        insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
        values (v_uid, v_id, 'entrada', v_inicial, 'estoque inicial');
      end if;
    end if;
  end loop;

  -- Produto sem variação com estoque precisa da linha padrão pra guardar o saldo.
  if v_controla and v_qtd_combinacoes = 0 then
    select id into v_id from produto_skus
     where produto_id = p_produto_id and user_id = v_uid and variacao is null and not arquivado
     limit 1;
    if v_id is null then
      insert into produto_skus (user_id, produto_id, variacao)
      values (v_uid, p_produto_id, null)
      returning id into v_id;
      if coalesce(p_inicial_padrao, 0) > 0 then
        insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, motivo)
        values (v_uid, v_id, 'entrada', p_inicial_padrao, 'estoque inicial');
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.salvar_combinacoes_loja(uuid, boolean, jsonb, jsonb, integer) from public, anon;
grant execute on function public.salvar_combinacoes_loja(uuid, boolean, jsonb, jsonb, integer) to authenticated, service_role;
