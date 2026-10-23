-- ONE-129 (23/10/2026): orçamento com a cara da marca que vira venda.
-- Benchmark Bling (Propostas Comerciais, ONE-126). Decisões da Sil (23/10):
-- link público com aprovação da cliente; identidade = logo + uma cor.
--
-- Três partes:
--   profiles.logo_path / cor_marca  identidade que o orçamento usa (e outros
--                                   documentos depois). Logo no bucket público
--                                   marca-logos, uma pasta por usuária.
--   orcamentos                      itens guardados como retrato do dia (nome,
--                                   preço, variação), como venda_itens: a página
--                                   pública não lê produtos nem estoque.
--   link_token                      uuid aleatório. A página pública /o/<token>
--                                   lê e aprova por server function com service
--                                   role (padrão de manual_leads): anon não tem
--                                   policy nenhuma aqui.
--
-- Virar venda usa registrar_venda com p_id = id do orçamento: reenvio não
-- duplica a venda.

-- ── identidade da marca ────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists logo_path text,
  add column if not exists cor_marca text;

alter table public.profiles drop constraint if exists profiles_logo_path_check;
alter table public.profiles add constraint profiles_logo_path_check
  check (logo_path is null or (char_length(logo_path) <= 200 and logo_path like id::text || '/%'));
alter table public.profiles drop constraint if exists profiles_cor_marca_check;
alter table public.profiles add constraint profiles_cor_marca_check
  check (cor_marca is null or cor_marca ~ '^#[0-9A-Fa-f]{6}$');

grant select (logo_path, cor_marca), update (logo_path, cor_marca)
  on public.profiles to authenticated;

-- Público pra leitura (o logo aparece pra cliente sem login). SVG fica de fora:
-- servido do domínio do Storage, poderia carregar script.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca-logos', 'marca-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Logos: dona lê a pasta" on storage.objects;
create policy "Logos: dona lê a pasta" on storage.objects for select to authenticated
  using (bucket_id = 'marca-logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Logos: dona sobe na pasta" on storage.objects;
create policy "Logos: dona sobe na pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'marca-logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Logos: dona apaga da pasta" on storage.objects;
create policy "Logos: dona apaga da pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'marca-logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── orcamentos ─────────────────────────────────────────────────────────────
create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  numero integer not null,
  cliente_id uuid references public.clientes (id) on delete set null,
  cliente_nome text check (cliente_nome is null or char_length(cliente_nome) <= 120),
  -- [{produto_id, sku_id, produto_nome, variacao, quantidade, preco_unitario}]
  itens jsonb not null check (
    jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) between 1 and 50
  ),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  desconto numeric(12, 2) not null default 0 check (desconto >= 0),
  frete numeric(12, 2) not null default 0 check (frete >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  validade date not null,
  observacao text check (observacao is null or char_length(observacao) <= 1000),
  status text not null default 'enviado'
    check (status in ('enviado', 'aprovado', 'convertido', 'cancelado')),
  aprovado_em timestamptz,
  venda_id uuid references public.vendas (id) on delete set null,
  link_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, numero),
  check (desconto <= subtotal)
);

create unique index if not exists orcamentos_link_token_uniq on public.orcamentos (link_token);
create index if not exists orcamentos_user_created_idx on public.orcamentos (user_id, created_at desc);

-- Número sequencial por conta, itens validados e totais calculados aqui: a
-- página pública mostra o que o banco somou, não o que o navegador mandou.
-- Mesma conta de totaisDoOrcamento em lib/orcamentos.ts.
create or replace function public.orcamentos_antes_de_gravar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_subtotal numeric(12, 2) := 0;
begin
  for v_item in select * from jsonb_array_elements(new.itens) loop
    if coalesce(char_length(v_item ->> 'produto_nome'), 0) not between 1 and 200
       or (v_item ->> 'quantidade') !~ '^\d{1,6}$'
       or (v_item ->> 'quantidade')::int < 1
       or (v_item ->> 'preco_unitario') !~ '^\d{1,10}(\.\d{1,2})?$' then
      raise exception 'Item do orçamento inválido' using errcode = 'check_violation';
    end if;
    v_subtotal := v_subtotal
      + round((v_item ->> 'quantidade')::int * (v_item ->> 'preco_unitario')::numeric, 2);
  end loop;
  new.subtotal := v_subtotal;
  new.total := greatest(v_subtotal - new.desconto + new.frete, 0);

  if tg_op = 'INSERT' then
    select coalesce(max(numero), 0) + 1 into new.numero
      from orcamentos where user_id = new.user_id;
    new.status := 'enviado';
    new.aprovado_em := null;
    new.venda_id := null;
  else
    new.link_token := old.link_token;
    new.numero := old.numero;
    if new.status = 'aprovado' and old.status <> 'aprovado' then
      new.aprovado_em := coalesce(new.aprovado_em, now());
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orcamentos_gravar on public.orcamentos;
create trigger orcamentos_gravar before insert or update on public.orcamentos
  for each row execute function public.orcamentos_antes_de_gravar();

alter table public.orcamentos enable row level security;

revoke all on public.orcamentos from anon, authenticated;
grant select, delete on public.orcamentos to authenticated;
grant insert (user_id, cliente_id, cliente_nome, itens, desconto, frete, validade, observacao)
  on public.orcamentos to authenticated;
grant update (cliente_id, cliente_nome, itens, desconto, frete, validade, observacao, status, venda_id)
  on public.orcamentos to authenticated;

drop policy if exists "Orçamentos: dona lê" on public.orcamentos;
create policy "Orçamentos: dona lê" on public.orcamentos for select to authenticated
  using (user_id = auth.uid());
-- cliente_id e venda_id só apontam pra linha da própria conta (sem BOLA).
drop policy if exists "Orçamentos: dona cria" on public.orcamentos;
create policy "Orçamentos: dona cria" on public.orcamentos for insert to authenticated
  with check (
    user_id = auth.uid()
    and (cliente_id is null or exists (
      select 1 from public.clientes c where c.id = cliente_id and c.user_id = auth.uid()
    ))
  );
drop policy if exists "Orçamentos: dona edita" on public.orcamentos;
create policy "Orçamentos: dona edita" on public.orcamentos for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (cliente_id is null or exists (
      select 1 from public.clientes c where c.id = cliente_id and c.user_id = auth.uid()
    ))
    and (venda_id is null or exists (
      select 1 from public.vendas v where v.id = venda_id and v.user_id = auth.uid()
    ))
  );
drop policy if exists "Orçamentos: dona exclui" on public.orcamentos;
create policy "Orçamentos: dona exclui" on public.orcamentos for delete to authenticated
  using (user_id = auth.uid());
