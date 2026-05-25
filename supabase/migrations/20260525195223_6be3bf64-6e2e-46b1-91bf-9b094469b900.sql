-- Tarefas
create table public.tarefas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  titulo text not null,
  descricao text,
  etapa integer,
  status text not null default 'a_fazer' check (status in ('a_fazer', 'brotando', 'floresceu')),
  fonte text not null default 'manual' check (fonte in ('manual', 'sistema')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entregaveis (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  titulo text not null,
  tipo text not null,
  fase text not null check (fase in ('Sonho', 'Construção', 'Venda', 'Evolução')),
  etapa integer not null,
  conteudo jsonb,
  status text not null default 'rascunho' check (status in ('rascunho', 'concluido')),
  created_at timestamptz not null default now()
);

create table public.conquistas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  titulo text not null,
  descricao text,
  xp integer not null default 0,
  tipo text,
  created_at timestamptz not null default now()
);

alter table public.tarefas enable row level security;
alter table public.entregaveis enable row level security;
alter table public.conquistas enable row level security;

create policy "Tarefas: dono seleciona" on public.tarefas for select using (auth.uid() = user_id);
create policy "Tarefas: dono insere" on public.tarefas for insert with check (auth.uid() = user_id);
create policy "Tarefas: dono atualiza" on public.tarefas for update using (auth.uid() = user_id);
create policy "Tarefas: dono apaga" on public.tarefas for delete using (auth.uid() = user_id);

create policy "Entregaveis: dono seleciona" on public.entregaveis for select using (auth.uid() = user_id);
create policy "Entregaveis: dono insere" on public.entregaveis for insert with check (auth.uid() = user_id);
create policy "Entregaveis: dono atualiza" on public.entregaveis for update using (auth.uid() = user_id);
create policy "Entregaveis: dono apaga" on public.entregaveis for delete using (auth.uid() = user_id);

create policy "Conquistas: dono seleciona" on public.conquistas for select using (auth.uid() = user_id);
create policy "Conquistas: dono insere" on public.conquistas for insert with check (auth.uid() = user_id);
create policy "Conquistas: dono atualiza" on public.conquistas for update using (auth.uid() = user_id);
create policy "Conquistas: dono apaga" on public.conquistas for delete using (auth.uid() = user_id);

create trigger update_tarefas_updated_at
before update on public.tarefas
for each row execute function public.update_updated_at_column();

create index idx_tarefas_user on public.tarefas(user_id, created_at desc);
create index idx_entregaveis_user on public.entregaveis(user_id, created_at desc);
create index idx_conquistas_user on public.conquistas(user_id, created_at desc);