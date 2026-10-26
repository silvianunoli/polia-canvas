-- Automações da caixa de entrada do CRM (fase 2 do "ManyChat próprio", CRM-27, 26/10/2026).
-- O motor fica no polia-admin (src/lib/automacoes.server.ts) e roda quando o webhook da Meta
-- grava uma mensagem da pessoa. Mesmo desenho das conv_*: RLS ligada, nenhuma policy, sem grant
-- pro navegador. Só o service role, atrás do assertAdmin.

create table if not exists public.auto_automacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  canal text not null check (canal in ('instagram', 'whatsapp', 'ambos')),
  ativa boolean not null default false,
  -- {tipo: comentario|palavra_chave|resposta_padrao, ...}: validado por zod no servidor.
  gatilho jsonb not null,
  -- Lista de passos (construtor em lista). O canvas da fase 5 lê o mesmo JSON.
  passos jsonb not null default '[]'::jsonb,
  execucoes integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists auto_automacoes_ativas_idx
  on public.auto_automacoes (ativa, canal);

-- Em que passo cada pessoa está. "aguardando" = esperando a resposta da pessoa (pergunta ou
-- botão) ou esperando ela escrever pra abrir a janela de 24h (depois de uma resposta privada
-- a comentário).
create table if not exists public.auto_execucoes (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid not null references public.auto_automacoes(id) on delete cascade,
  conversa_id uuid not null references public.conv_conversas(id) on delete cascade,
  contato_id uuid not null references public.crm_contatos(id) on delete cascade,
  estado text not null default 'rodando' check (estado in (
    'rodando', 'aguardando', 'concluida', 'cancelada', 'expirada', 'erro'
  )),
  passo_idx integer not null default 0,
  aguardando text check (aguardando in ('resposta', 'janela')),
  tentativas integer not null default 0,
  -- comentario_id de quem disparou por comentário (a 1ª mensagem vira resposta privada).
  dados jsonb not null default '{}'::jsonb,
  erro text,
  iniciado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- No máximo uma execução viva por conversa: a resposta da pessoa sempre tem dono certo.
create unique index if not exists auto_execucoes_viva_uidx
  on public.auto_execucoes (conversa_id) where estado in ('rodando', 'aguardando');
create index if not exists auto_execucoes_automacao_idx
  on public.auto_execucoes (automacao_id, iniciado_em desc);

alter table public.auto_automacoes enable row level security;
alter table public.auto_execucoes enable row level security;

revoke all on public.auto_automacoes, public.auto_execucoes from anon, authenticated;
