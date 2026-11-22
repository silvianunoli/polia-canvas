-- Banner rotativo da Vitrine online (22/11/2026, pedido da Sil). Até 5 imagens
-- que passam sozinhas no topo da loja pública (/loja/<endereço>). O arquivo
-- mora no bucket produtos-fotos (público, 3 MB, png/jpeg/webp), na pasta da
-- dona, que já tem as políticas de subir e apagar só na própria pasta.
-- A loja pública lê pelo service role (loja.functions.ts), como as fotos.

create table if not exists public.catalogo_banners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null check (char_length(path) <= 200 and path like user_id::text || '/%'),
  ordem smallint not null check (ordem between 0 and 4),
  created_at timestamptz not null default now()
);
create index if not exists catalogo_banners_por_dona on public.catalogo_banners (user_id, ordem);

alter table public.catalogo_banners enable row level security;
revoke all on public.catalogo_banners from public, anon;
grant select, insert, update, delete on public.catalogo_banners to authenticated;

drop policy if exists "Banners: dona lê" on public.catalogo_banners;
create policy "Banners: dona lê" on public.catalogo_banners for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Banners: dona cria" on public.catalogo_banners;
create policy "Banners: dona cria" on public.catalogo_banners for insert to authenticated
  with check (
    user_id = auth.uid()
    and (select count(*) from public.catalogo_banners b where b.user_id = auth.uid()) < 5
  );
drop policy if exists "Banners: dona reordena" on public.catalogo_banners;
create policy "Banners: dona reordena" on public.catalogo_banners for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Banners: dona apaga" on public.catalogo_banners;
create policy "Banners: dona apaga" on public.catalogo_banners for delete to authenticated
  using (user_id = auth.uid());
