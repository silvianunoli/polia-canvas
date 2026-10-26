-- Caixa de entrada do CRM (fase 1 do "ManyChat próprio", decisão da Sil em 26/10/2026).
-- Instagram e WhatsApp chegam pelo webhook da Meta em office.usepolia.com.br/api/meta/webhook
-- (polia-admin, src/lib/conversas-meta.server.ts) e viram conversa ligada ao contato do CRM.
--
-- Mesmo desenho das crm_*: RLS ligada e nenhuma policy. Só o service role lê e escreve,
-- e só atrás do assertAdmin das server functions.

-- Contato do Instagram pode chegar sem e-mail e sem telefone: o ID dele no canal basta.
alter table public.crm_contatos
  add column if not exists ig_id text,
  add column if not exists wa_id text,
  add column if not exists foto_url text,
  add column if not exists campos jsonb not null default '{}'::jsonb;

create unique index if not exists crm_contatos_ig_id_uidx
  on public.crm_contatos (ig_id) where ig_id is not null;
create unique index if not exists crm_contatos_wa_id_uidx
  on public.crm_contatos (wa_id) where wa_id is not null;

alter table public.crm_contatos drop constraint if exists crm_contatos_contato_ck;
alter table public.crm_contatos add constraint crm_contatos_contato_ck
  check (email is not null or telefone is not null or ig_id is not null or wa_id is not null);

-- Uma conversa por contato e canal. A janela de 24h da Meta conta a partir de
-- ultima_entrada_em (última mensagem DA PESSOA, comentário não abre janela de Direct).
create table if not exists public.conv_conversas (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references public.crm_contatos(id) on delete cascade,
  canal text not null check (canal in ('instagram', 'whatsapp')),
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  nao_lidas integer not null default 0,
  automacao_pausada boolean not null default false,
  ultima_mensagem_em timestamptz,
  ultima_mensagem_resumo text,
  ultima_entrada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (contato_id, canal)
);

create index if not exists conv_conversas_lista_idx
  on public.conv_conversas (status, ultima_mensagem_em desc);

create table if not exists public.conv_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conv_conversas(id) on delete cascade,
  direcao text not null check (direcao in ('entrada', 'saida', 'interna')),
  tipo text not null default 'texto' check (tipo in (
    'texto', 'imagem', 'video', 'audio', 'arquivo', 'figurinha',
    'story_resposta', 'story_mencao', 'comentario', 'reacao', 'botao',
    'nota', 'sistema', 'outro'
  )),
  texto text,
  -- Caminho no bucket privado conv-midia (a URL da Meta expira em minutos ou horas).
  midia_path text,
  midia_mime text,
  midia_nome text,
  dados jsonb not null default '{}'::jsonb,
  meta_id text,
  status text not null default 'recebida' check (status in (
    'recebida', 'enviando', 'enviada', 'entregue', 'lida', 'falhou'
  )),
  erro text,
  autor_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- A Meta reenvia o mesmo evento quando não recebe 200 a tempo: o ID dela deduplica.
create unique index if not exists conv_mensagens_meta_id_uidx
  on public.conv_mensagens (meta_id) where meta_id is not null;
create index if not exists conv_mensagens_conversa_idx
  on public.conv_mensagens (conversa_id, criado_em);

-- Evento cru do webhook, gravado antes de processar: dá pra depurar e reprocessar.
create table if not exists public.conv_eventos (
  id bigint generated always as identity primary key,
  origem text not null,
  payload jsonb not null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  erro text
);

create index if not exists conv_eventos_pendentes_idx
  on public.conv_eventos (recebido_em) where processado_em is null;

alter table public.conv_conversas enable row level security;
alter table public.conv_mensagens enable row level security;
alter table public.conv_eventos enable row level security;

revoke all on public.conv_conversas, public.conv_mensagens, public.conv_eventos
  from anon, authenticated;

-- Bucket privado: foto, áudio e arquivo das conversas. Leitura só por URL assinada
-- gerada no servidor.
insert into storage.buckets (id, name, public, file_size_limit)
values ('conv-midia', 'conv-midia', false, 26214400)
on conflict (id) do nothing;
