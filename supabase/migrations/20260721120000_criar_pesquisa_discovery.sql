-- Pesquisa de discovery PÚBLICA e ANÔNIMA (substitui as entrevistas 1:1).
-- Duas tabelas novas, nada destrutivo, não toca em tabela existente.
--
-- Modelo:
--  - pesquisas: metadados (uma linha por pesquisa). Liga/desliga pela coluna
--    `ativa` sem precisar de deploy. Leitura só admin; a página pública lê o
--    cabeçalho e o status por server function (service role), nunca direto.
--  - pesquisa_respostas: uma linha POR SESSÃO (upsert por sessao_id). A mesma
--    linha nasce quando a pessoa começa e é atualizada até concluir, então dá
--    pra medir começou/concluiu/abandono sem depender de cookie de análise.
--    Anônima: sem user_id, sem e-mail (o e-mail do fim vai pra lista_espera,
--    desacoplado). Escrita só via service role, espelhando lista_espera/contatos.

-- 1) Pesquisas -------------------------------------------------------------
create table public.pesquisas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  subtitulo text,
  ativa boolean not null default false,
  abre_em timestamptz,
  fecha_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table public.pesquisas enable row level security;

-- Só admin lê a tabela direto. O público não lê daqui.
create policy "pesquisas: leitura so admin"
  on public.pesquisas
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Criar/editar/ativar pesquisa só via service role. Sem policy de escrita pro
-- cliente + revoke explícito por garantia.
revoke insert, update, delete on public.pesquisas from anon, authenticated;

-- 2) Respostas -------------------------------------------------------------
create table public.pesquisa_respostas (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisas(id) on delete cascade,
  sessao_id text not null,
  progresso smallint not null default 0,   -- ordem da última pergunta respondida (0 = começou)
  concluida boolean not null default false,
  respostas jsonb not null default '{}'::jsonb,  -- { pergunta_id: valor | valor[] }
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (pesquisa_id, sessao_id)
);

alter table public.pesquisa_respostas enable row level security;

-- Leitura só admin (é o que o painel /admin/pesquisas consome).
create policy "pesquisa_respostas: leitura so admin"
  on public.pesquisa_respostas
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Escrita só via service role (server function com Turnstile + honeypot).
-- Sem policy de escrita pro cliente + revoke: um POST anônimo direto na REST
-- não grava nada.
revoke insert, update, delete on public.pesquisa_respostas from anon, authenticated;

-- Índice pro painel: filtra por pesquisa e status o tempo todo.
create index pesquisa_respostas_pesquisa_status_idx
  on public.pesquisa_respostas (pesquisa_id, concluida);

comment on table public.pesquisa_respostas is 'Respostas anônimas da pesquisa de discovery. Sem user_id/e-mail. Escrita só via service role (server function). Uma linha por sessao_id (upsert).';

-- 3) Semente (desligada; você liga em `ativa` quando quiser abrir) ---------
insert into public.pesquisas (slug, titulo, subtitulo, ativa)
values (
  'discovery-negocio',
  'Me conta como é tocar o seu negócio hoje',
  'Anônimo. Cerca de 3 minutos. Sem cadastro.',
  false
)
on conflict (slug) do nothing;
