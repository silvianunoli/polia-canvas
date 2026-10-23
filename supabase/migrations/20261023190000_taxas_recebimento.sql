-- ONE-128 (23/10/2026): taxa cadastrada uma vez por forma de recebimento
-- (maquininha, link, Pix) e por marketplace (Shopee, TikTok Shop).
-- Benchmark Bling (Ajustes do Meu Negócio, ONE-126). Antes a taxa era digitada
-- em cada venda; agora o modal de venda puxa a regra e a dona só confere.
--
-- Taxa = percentual sobre o total da venda + valor fixo por venda. A lista de
-- chaves mora em lib/taxas.ts (FORMAS_RECEBIMENTO e marketplaces); o check
-- abaixo repete a lista pra o banco não aceitar chave que a tela não conhece.
-- Sem valor padrão de mercado: cada maquininha cobra diferente, e número
-- inventado viraria lucro errado.

create table if not exists public.taxas_recebimento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chave text not null check (chave in (
    'pix', 'dinheiro', 'debito', 'credito', 'credito_parcelado', 'link', 'shopee', 'tiktok_shop'
  )),
  percentual numeric(5, 2) not null default 0 check (percentual >= 0 and percentual <= 100),
  fixo numeric(10, 2) not null default 0 check (fixo >= 0 and fixo <= 100000),
  updated_at timestamptz not null default now(),
  unique (user_id, chave)
);

alter table public.taxas_recebimento enable row level security;

revoke all on public.taxas_recebimento from anon, authenticated;
grant select, insert, update, delete on public.taxas_recebimento to authenticated;

drop policy if exists "Taxas: dona lê" on public.taxas_recebimento;
create policy "Taxas: dona lê" on public.taxas_recebimento for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Taxas: dona cria" on public.taxas_recebimento;
create policy "Taxas: dona cria" on public.taxas_recebimento for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "Taxas: dona edita" on public.taxas_recebimento;
create policy "Taxas: dona edita" on public.taxas_recebimento for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Taxas: dona exclui" on public.taxas_recebimento;
create policy "Taxas: dona exclui" on public.taxas_recebimento for delete to authenticated
  using (user_id = auth.uid());

drop trigger if exists taxas_recebimento_updated on public.taxas_recebimento;
create trigger taxas_recebimento_updated before update on public.taxas_recebimento
  for each row execute function public.vendas_tocar_updated_at();
