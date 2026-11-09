-- Conta da compradora nas lojas das marcas (ONE-198): entrar por código no e-mail, favoritos,
-- rastreio, avaliação de quem comprou, cadastro de e-mail e CNPJ na entrega.
--
-- A compradora da loja não é usuária da Pólia One: fica em tabelas próprias, sem auth.users.
-- Tudo aqui é escrito pelo servidor da loja com a service role. Nenhuma política para anon.

create table public.loja_clientes (
  id uuid primary key default gen_random_uuid(),
  dominio text not null,
  email text not null check (char_length(email) between 3 and 200 and email = lower(email)),
  created_at timestamptz not null default now(),
  unique (dominio, email)
);

create table public.loja_login_codigos (
  id uuid primary key default gen_random_uuid(),
  dominio text not null,
  email text not null,
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas integer not null default 0,
  usado_em timestamptz,
  created_at timestamptz not null default now()
);
create index loja_login_codigos_busca on public.loja_login_codigos (dominio, email, created_at desc);

create table public.loja_sessoes (
  token_hash text primary key,
  cliente_id uuid not null references public.loja_clientes (id) on delete cascade,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);
create index loja_sessoes_cliente on public.loja_sessoes (cliente_id);

create table public.loja_favoritos (
  cliente_id uuid not null references public.loja_clientes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_id, produto_id)
);

create table public.loja_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.loja_clientes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 60),
  nota smallint not null check (nota between 1 and 5),
  texto text not null check (char_length(texto) between 3 and 800),
  visivel boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, produto_id)
);
create index loja_avaliacoes_produto on public.loja_avaliacoes (produto_id, created_at desc);

create table public.loja_novidades_emails (
  dominio text not null,
  email text not null check (char_length(email) between 3 and 200 and email = lower(email)),
  created_at timestamptz not null default now(),
  primary key (dominio, email)
);

create table public.loja_limites (
  chave text not null,
  janela timestamptz not null,
  n integer not null default 0,
  primary key (chave, janela)
);

alter table public.loja_clientes enable row level security;
alter table public.loja_login_codigos enable row level security;
alter table public.loja_sessoes enable row level security;
alter table public.loja_favoritos enable row level security;
alter table public.loja_avaliacoes enable row level security;
alter table public.loja_novidades_emails enable row level security;
alter table public.loja_limites enable row level security;

revoke all on public.loja_clientes, public.loja_login_codigos, public.loja_sessoes, public.loja_favoritos,
  public.loja_avaliacoes, public.loja_novidades_emails, public.loja_limites from anon, authenticated;

-- Conta tentativas por hora. Devolve false quando passou do máximo.
create function public.loja_limite_ok(p_chave text, p_maximo integer)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_janela timestamptz := date_trunc('hour', now());
  v_n integer;
begin
  delete from loja_limites where janela < now() - interval '2 hours';
  insert into loja_limites as l (chave, janela, n) values (p_chave, v_janela, 1)
    on conflict (chave, janela) do update set n = l.n + 1
    returning n into v_n;
  return v_n <= p_maximo;
end;
$$;

create function public.loja_login_pedir(p_dominio text, p_email text, p_codigo_hash text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_dominio text := lower(btrim(p_dominio));
  v_email text := lower(btrim(p_email));
  v_marca text;
begin
  select p.business_name into v_marca
    from lojas_marca l join profiles p on p.id = l.user_id
   where l.dominio = v_dominio and l.ativa;
  if not found then
    return jsonb_build_object('resultado', 'fechada');
  end if;
  if not loja_limite_ok('login:email:' || v_dominio || ':' || v_email, 5)
     or (p_ip_hash is not null and not loja_limite_ok('login:ip:' || p_ip_hash, 30)) then
    return jsonb_build_object('resultado', 'limite');
  end if;
  update loja_login_codigos set usado_em = now()
   where dominio = v_dominio and email = v_email and usado_em is null;
  insert into loja_login_codigos (dominio, email, codigo_hash, expira_em)
    values (v_dominio, v_email, p_codigo_hash, now() + interval '10 minutes');
  return jsonb_build_object('resultado', 'ok', 'marca', v_marca);
end;
$$;

create function public.loja_login_confirmar(p_dominio text, p_email text, p_codigo_hash text, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_dominio text := lower(btrim(p_dominio));
  v_email text := lower(btrim(p_email));
  v loja_login_codigos;
  v_cliente uuid;
begin
  select * into v from loja_login_codigos
   where dominio = v_dominio and email = v_email and usado_em is null and expira_em > now()
   order by created_at desc limit 1 for update;
  if not found then
    return jsonb_build_object('resultado', 'expirado');
  end if;
  if v.tentativas >= 5 then
    update loja_login_codigos set usado_em = now() where id = v.id;
    return jsonb_build_object('resultado', 'expirado');
  end if;
  if v.codigo_hash is distinct from p_codigo_hash then
    update loja_login_codigos set tentativas = tentativas + 1 where id = v.id;
    return jsonb_build_object('resultado', 'invalido');
  end if;

  update loja_login_codigos set usado_em = now() where id = v.id;
  insert into loja_clientes (dominio, email) values (v_dominio, v_email)
    on conflict (dominio, email) do update set email = excluded.email
    returning id into v_cliente;
  delete from loja_sessoes where cliente_id = v_cliente and expira_em < now();
  insert into loja_sessoes (token_hash, cliente_id, expira_em) values (p_token_hash, v_cliente, now() + interval '30 days');
  return jsonb_build_object('resultado', 'ok', 'email', v_email);
end;
$$;

-- Quem é a dona da sessão. Base das funções abaixo.
create function public.loja_cliente_da_sessao(p_token_hash text)
returns public.loja_clientes
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select c.* from loja_sessoes s join loja_clientes c on c.id = s.cliente_id
   where s.token_hash = p_token_hash and s.expira_em > now();
$$;

create function public.loja_sessao_ler(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v loja_clientes := loja_cliente_da_sessao(p_token_hash);
begin
  if v.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'email', v.email,
    'favoritos', coalesce((select jsonb_agg(f.produto_id) from loja_favoritos f where f.cliente_id = v.id), '[]'::jsonb)
  );
end;
$$;

create function public.loja_sair(p_token_hash text)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  delete from loja_sessoes where token_hash = p_token_hash;
$$;

create function public.loja_favorito_definir(p_token_hash text, p_produto_id uuid, p_ligado boolean)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v loja_clientes := loja_cliente_da_sessao(p_token_hash);
begin
  if v.id is null then
    return 'sem_sessao';
  end if;
  if not p_ligado then
    delete from loja_favoritos where cliente_id = v.id and produto_id = p_produto_id;
    return 'ok';
  end if;
  if not exists (
    select 1 from produtos p join lojas_marca l on l.user_id = p.user_id
     where p.id = p_produto_id and l.dominio = v.dominio and p.no_catalogo and not p.arquivado
  ) then
    return 'invalido';
  end if;
  insert into loja_favoritos (cliente_id, produto_id) values (v.id, p_produto_id) on conflict do nothing;
  return 'ok';
end;
$$;

create function public.loja_meus_pedidos(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v loja_clientes := loja_cliente_da_sessao(p_token_hash);
begin
  if v.id is null then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'criado_em', c.created_at, 'total', c.total, 'rastreio_status', c.rastreio_status, 'entrega_tipo', c.entrega_tipo
    ) order by c.created_at desc)
    from (select * from loja_checkouts where dominio = v.dominio and email = v.email and status = 'pago' order by created_at desc limit 50) c
  ), '[]'::jsonb);
end;
$$;

-- O número do pedido são os 8 primeiros caracteres do id. Sem o e-mail certo, não acha.
create function public.loja_rastrear(p_dominio text, p_numero text, p_email text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
begin
  if p_numero !~ '^[0-9a-fA-F]{8}$' then
    return jsonb_build_object('resultado', 'nao_achou');
  end if;
  if p_ip_hash is not null and not loja_limite_ok('rastreio:ip:' || p_ip_hash, 20) then
    return jsonb_build_object('resultado', 'limite');
  end if;
  select id into v_id from loja_checkouts
   where dominio = lower(btrim(p_dominio)) and email = lower(btrim(p_email))
     and left(id::text, 8) = lower(p_numero) and status <> 'expirado'
   order by created_at desc limit 1;
  if v_id is null then
    return jsonb_build_object('resultado', 'nao_achou');
  end if;
  return jsonb_build_object('resultado', 'ok', 'id', v_id);
end;
$$;

create function public.loja_avaliacoes_ler(p_dominio text, p_produto_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with base as (
    select a.* from loja_avaliacoes a
      join loja_clientes c on c.id = a.cliente_id
     where a.produto_id = p_produto_id and a.visivel and c.dominio = lower(btrim(p_dominio))
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'media', (select round(avg(nota), 1) from base),
    'lista', coalesce((
      select jsonb_agg(jsonb_build_object('nome', b.nome, 'nota', b.nota, 'texto', b.texto, 'data', b.created_at) order by b.created_at desc)
      from (select * from base order by created_at desc limit 30) b
    ), '[]'::jsonb)
  );
$$;

-- Só avalia quem tem compra paga, neste e-mail, com este produto.
create function public.loja_avaliar(p_token_hash text, p_produto_id uuid, p_nome text, p_nota integer, p_texto text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v loja_clientes := loja_cliente_da_sessao(p_token_hash);
  v_nome text := btrim(p_nome);
  v_texto text := btrim(p_texto);
begin
  if v.id is null then
    return 'sem_sessao';
  end if;
  if p_nota not between 1 and 5 or char_length(v_nome) not between 2 and 60 or char_length(v_texto) not between 3 and 800 then
    return 'invalido';
  end if;
  if not exists (
    select 1 from loja_checkouts c, jsonb_array_elements(c.itens) i
     where c.dominio = v.dominio and c.email = v.email and c.status = 'pago' and i ->> 'produto_id' = p_produto_id::text
  ) then
    return 'sem_compra';
  end if;
  insert into loja_avaliacoes as a (cliente_id, produto_id, nome, nota, texto)
    values (v.id, p_produto_id, v_nome, p_nota, v_texto)
    on conflict (cliente_id, produto_id) do update
      set nome = excluded.nome, nota = excluded.nota, texto = excluded.texto, updated_at = now();
  return 'ok';
end;
$$;

create function public.loja_novidades_assinar(p_dominio text, p_email text, p_ip_hash text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_dominio text := lower(btrim(p_dominio));
begin
  if not exists (select 1 from lojas_marca where dominio = v_dominio and ativa) then
    return 'fechada';
  end if;
  if p_ip_hash is not null and not loja_limite_ok('novidades:ip:' || p_ip_hash, 20) then
    return 'limite';
  end if;
  insert into loja_novidades_emails (dominio, email) values (v_dominio, lower(btrim(p_email))) on conflict do nothing;
  return 'ok';
end;
$$;

revoke all on function
  public.loja_limite_ok(text, integer),
  public.loja_login_pedir(text, text, text, text),
  public.loja_login_confirmar(text, text, text, text),
  public.loja_cliente_da_sessao(text),
  public.loja_sessao_ler(text),
  public.loja_sair(text),
  public.loja_favorito_definir(text, uuid, boolean),
  public.loja_meus_pedidos(text),
  public.loja_rastrear(text, text, text, text),
  public.loja_avaliacoes_ler(text, uuid),
  public.loja_avaliar(text, uuid, text, integer, text),
  public.loja_novidades_assinar(text, text, text)
from public, anon, authenticated;

grant execute on function
  public.loja_limite_ok(text, integer),
  public.loja_login_pedir(text, text, text, text),
  public.loja_login_confirmar(text, text, text, text),
  public.loja_cliente_da_sessao(text),
  public.loja_sessao_ler(text),
  public.loja_sair(text),
  public.loja_favorito_definir(text, uuid, boolean),
  public.loja_meus_pedidos(text),
  public.loja_rastrear(text, text, text, text),
  public.loja_avaliacoes_ler(text, uuid),
  public.loja_avaliar(text, uuid, text, integer, text),
  public.loja_novidades_assinar(text, text, text)
to service_role;

-- Painel da dona na Pólia One: só enxerga o que é da própria loja.
create function public.loja_painel_contatos()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_dominio text;
begin
  select dominio into v_dominio from lojas_marca where user_id = v_uid limit 1;
  if v_dominio is null then
    return null;
  end if;
  return jsonb_build_object(
    'emails', coalesce((
      select jsonb_agg(jsonb_build_object('email', n.email, 'criado_em', n.created_at) order by n.created_at desc)
        from loja_novidades_emails n where n.dominio = v_dominio
    ), '[]'::jsonb),
    'avaliacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'nome', a.nome, 'nota', a.nota, 'texto', a.texto, 'visivel', a.visivel,
        'criado_em', a.created_at, 'produto', p.nome
      ) order by a.created_at desc)
      from loja_avaliacoes a
      join loja_clientes c on c.id = a.cliente_id
      join produtos p on p.id = a.produto_id
      where c.dominio = v_dominio and p.user_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

create function public.loja_avaliacao_visivel(p_id uuid, p_visivel boolean)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  update loja_avaliacoes a set visivel = p_visivel, updated_at = now()
    from produtos p
   where a.id = p_id and p.id = a.produto_id and p.user_id = auth.uid();
$$;

revoke all on function public.loja_painel_contatos(), public.loja_avaliacao_visivel(uuid, boolean) from public, anon;
grant execute on function public.loja_painel_contatos(), public.loja_avaliacao_visivel(uuid, boolean) to authenticated;

-- CPF ou CNPJ de quem recebe: a coluna segue chamando cpf, com 11 ou 14 dígitos.
alter table public.loja_checkouts drop constraint loja_checkouts_cpf_check;
alter table public.loja_checkouts add constraint loja_checkouts_cpf_check check (cpf is null or cpf ~ '^([0-9]{11}|[0-9]{14})$');

create or replace function public.loja_checkout_definir_entrega(p_dominio text, p_id uuid, p_tipo text, p_frete numeric default 0, p_servico jsonb default null::jsonb, p_endereco jsonb default null::jsonb, p_cpf text default null::text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v public.loja_checkouts;
  v_frete numeric := round(coalesce(p_frete, 0), 2);
  v_envio jsonb;
begin
  select * into v from loja_checkouts
   where id = p_id and dominio = lower(btrim(p_dominio)) and status = 'aberto' for update;
  if not found then
    return 'fechado';
  end if;
  if v.entrega_tipo is not null then
    return 'repetido';
  end if;

  if p_tipo = 'retirada' then
    select envio into v_envio from lojas_marca where user_id = v.user_id and dominio = v.dominio;
    if (v_envio -> 'retirada' ->> 'ativa') is distinct from 'true' then
      return 'invalido';
    end if;
    update loja_checkouts
       set entrega_tipo = 'retirada', frete = 0, total = subtotal, updated_at = now()
     where id = v.id;
    return 'ok';
  end if;

  if p_tipo is distinct from 'frete' or v_frete < 0 or v_frete > 9999
     or p_servico is null or jsonb_typeof(p_servico) <> 'object'
     or p_endereco is null or jsonb_typeof(p_endereco) <> 'object'
     or p_cpf is null or p_cpf !~ '^([0-9]{11}|[0-9]{14})$'
     or exists (
       select 1 from unnest(array['cep', 'rua', 'numero', 'bairro', 'cidade', 'uf']) k
        where coalesce(btrim(p_endereco ->> k), '') = ''
     ) then
    return 'invalido';
  end if;

  update loja_checkouts
     set entrega_tipo = 'frete', frete = v_frete, total = subtotal + v_frete,
         frete_servico = p_servico, endereco = p_endereco, cpf = p_cpf, updated_at = now()
   where id = v.id;
  return 'ok';
end;
$function$;
