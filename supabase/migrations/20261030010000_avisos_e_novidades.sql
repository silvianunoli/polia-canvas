-- Sino de avisos, Novidades da Pólia One e Suporte à vista (ONE-152, 29/10/2026).
--
-- avisos: um por dona, criado só pelo banco (gatilho). Hoje são dois tipos:
--   pedido  = venda nova que entrou pelo catálogo (loja da Pólia One ou site do Lab);
--   chamado = resposta do suporte num chamado dela.
-- A dona lê e marca como lido (só a coluna lido_em); não cria nem apaga.
--
-- novidades: o que a Pólia One lançou. Uma linha serve todo mundo; quem leu
-- fica em novidades_lidas. Regra da Sil (29/10): toda funcionalidade nova que a
-- usuária vê ganha uma novidade aqui, no mesmo trabalho que a publica.

create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('pedido', 'chamado')),
  titulo text not null check (char_length(titulo) between 1 and 140),
  corpo text check (corpo is null or char_length(corpo) <= 300),
  valor numeric(12, 2),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&.#-]*$'),
  ref_id uuid not null,
  lido_em timestamptz,
  created_at timestamptz not null default now(),
  unique (tipo, ref_id)
);

create index avisos_dona_recentes on public.avisos (user_id, created_at desc);

alter table public.avisos enable row level security;
create policy "Avisos: dona lê" on public.avisos for select to authenticated using (user_id = auth.uid());
create policy "Avisos: dona marca como lido" on public.avisos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to authenticated;
grant update (lido_em) on public.avisos to authenticated;

create table public.novidades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 80),
  texto text not null check (char_length(texto) between 1 and 400),
  imagem_url text check (imagem_url is null or imagem_url ~ '^https://'),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&.#-]*$'),
  link_rotulo text check (link_rotulo is null or char_length(link_rotulo) <= 40),
  ativa boolean not null default true,
  publicada_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index novidades_publicadas on public.novidades (publicada_em desc) where ativa;

alter table public.novidades enable row level security;
create policy "Novidades: quem tem conta lê as publicadas" on public.novidades for select to authenticated
  using (ativa and publicada_em <= now());

revoke all on public.novidades from anon, authenticated;
grant select on public.novidades to authenticated;

create table public.novidades_lidas (
  user_id uuid not null references auth.users (id) on delete cascade,
  novidade_id uuid not null references public.novidades (id) on delete cascade,
  lida_em timestamptz not null default now(),
  primary key (user_id, novidade_id)
);

alter table public.novidades_lidas enable row level security;
create policy "Novidades lidas: dona lê" on public.novidades_lidas for select to authenticated using (user_id = auth.uid());
create policy "Novidades lidas: dona marca" on public.novidades_lidas for insert to authenticated with check (user_id = auth.uid());

revoke all on public.novidades_lidas from anon, authenticated;
grant select, insert on public.novidades_lidas to authenticated;

-- Pedido novo do catálogo vira aviso. Falha aqui nunca derruba a venda.
create or replace function public.aviso_de_pedido_do_catalogo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.canal = 'catalogo' then
    begin
      insert into avisos (user_id, tipo, titulo, corpo, valor, link, ref_id)
      values (
        new.user_id, 'pedido', 'Pedido novo da loja',
        left(nullif(btrim(coalesce(new.cliente_nome, '')), ''), 120),
        new.total, '/pedidos', new.id
      )
      on conflict (tipo, ref_id) do nothing;
    exception when others then
      raise warning 'aviso_de_pedido_do_catalogo: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

create trigger vendas_aviso_pedido_catalogo
  after insert on public.vendas
  for each row execute function public.aviso_de_pedido_do_catalogo();

-- Resposta do suporte (author_role 'admin') vira aviso pra dona do chamado.
create or replace function public.aviso_de_resposta_do_suporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dona uuid;
  v_titulo text;
begin
  if new.author_role = 'admin' then
    select user_id, title into v_dona, v_titulo from tickets where id = new.ticket_id;
    if v_dona is not null then
      begin
        insert into avisos (user_id, tipo, titulo, corpo, link, ref_id)
        values (v_dona, 'chamado', 'O suporte respondeu seu chamado', left(v_titulo, 140), '/chamados/' || new.ticket_id, new.id)
        on conflict (tipo, ref_id) do nothing;
      exception when others then
        raise warning 'aviso_de_resposta_do_suporte: %', sqlerrm;
      end;
    end if;
  end if;
  return new;
end;
$$;

create trigger ticket_messages_aviso_resposta
  after insert on public.ticket_messages
  for each row execute function public.aviso_de_resposta_do_suporte();

revoke execute on function public.aviso_de_pedido_do_catalogo() from public, anon, authenticated;
revoke execute on function public.aviso_de_resposta_do_suporte() from public, anon, authenticated;

-- Primeiras novidades (29/10/2026).
insert into public.novidades (titulo, texto, link, link_rotulo, publicada_em) values
  ('Loja do Catálogo no plano Pro',
   'A marca ganha uma loja num endereço da Pólia, com as fotos e as variações de Produtos. A cliente monta o carrinho, confirma, e o pedido cai direto em Pedidos.',
   '/catalogo', 'Montar a loja', now() - interval '1 minute'),
  ('Avisos e Suporte no topo',
   'O sino no alto da tela mostra cada pedido novo da loja, as respostas do suporte e o que a Pólia One lançou. Do lado dele, o Suporte abre um chamado em um clique.',
   null, null, now());
