-- VND-04 (23/10/2026): Fase 2 do módulo Vendas, Clientes e leads. Plano em
-- docs/plano-modulo-vendas-canais.md, seção 6.
--
-- Lead é cliente nos status de "Antes do pedido": não há tabela nova de lead,
-- a lista e o funil continuam os de Clientes. Entram:
--   clientes.origem           de onde veio (Instagram, link, indicação...)
--   clientes.whatsapp         só dígitos, com DDI (5511988880000), pra não
--                             duplicar a mesma pessoa e, na fase 4, mandar
--                             mensagem pela API oficial
--   clientes.interesse        o que ela escreveu no link
--   clientes.novo             chegou pelo link e a dona ainda não abriu
--   consentimentos_whatsapp   LIVRO do aceite (LGPD): aceite e revogação viram
--                             linha, nunca são editados nem apagados. As duas
--                             colunas whatsapp_consentimento_em/_origem em
--                             clientes são só o espelho do último evento.
--   links_captura             um link público por conta (/l/<slug>)
--   links_captura_slugs       slug usado uma vez fica com aquela conta pra
--                             sempre: QR impresso de uma marca nunca leva
--                             contato pra outra
--   leads_envios              cada envio do link (teto por link e por aparelho)
--
-- Revisão de segurança de 23/10: com as colunas abertas, a dona podia forjar
-- um aceite "pelo link" ou apagar um aceite real. Agora o aceite só muda pelas
-- funções daqui, que marcam a transação com polia.consentimento; o gatilho
-- barra qualquer outra escrita nessas colunas, em origem='link' e em novo=true.
--
-- O link público grava por capturar_lead, chamada só pelo servidor (service
-- role) depois do anti-robô, no padrão do orçamento público (20261023200000).
--
-- Aplicada em 23/10/2026 depois das revisões, com autorização da Sil.

-- ── clientes ───────────────────────────────────────────────────────────────
alter table public.clientes
  add column if not exists origem text,
  add column if not exists whatsapp text,
  add column if not exists whatsapp_consentimento_em timestamptz,
  add column if not exists consentimento_origem text,
  add column if not exists interesse text,
  add column if not exists novo boolean not null default false;

alter table public.clientes drop constraint if exists clientes_origem_check;
alter table public.clientes add constraint clientes_origem_check check (
  origem is null or origem in (
    'instagram', 'whatsapp', 'indicacao', 'feira', 'site', 'link', 'tiktok', 'outro'
  )
);
alter table public.clientes drop constraint if exists clientes_whatsapp_check;
alter table public.clientes add constraint clientes_whatsapp_check
  check (whatsapp is null or whatsapp ~ '^[0-9]{12,13}$');
alter table public.clientes drop constraint if exists clientes_consentimento_check;
alter table public.clientes add constraint clientes_consentimento_check check (
  (whatsapp_consentimento_em is null and consentimento_origem is null)
  or (whatsapp_consentimento_em is not null and consentimento_origem in ('cadastro', 'link'))
);
alter table public.clientes drop constraint if exists clientes_interesse_check;
alter table public.clientes add constraint clientes_interesse_check
  check (interesse is null or char_length(interesse) <= 500);

-- Mesma pessoa (mesmo WhatsApp) uma vez por conta.
create unique index if not exists clientes_user_whatsapp_uniq
  on public.clientes (user_id, whatsapp)
  where whatsapp is not null;
create index if not exists clientes_user_novo_idx
  on public.clientes (user_id)
  where novo;

-- ── consentimentos_whatsapp (livro) ────────────────────────────────────────
create table if not exists public.consentimentos_whatsapp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- set null: a ficha pode ser excluída, a prova do que aconteceu fica.
  cliente_id uuid references public.clientes (id) on delete set null,
  whatsapp text not null check (whatsapp ~ '^[0-9]{12,13}$'),
  evento text not null check (evento in ('aceite', 'revogacao')),
  -- cadastro: a dona marcou; link: a própria pessoa marcou no link;
  -- numero_trocado: a dona trocou o número e o aceite antigo deixou de valer.
  origem text not null check (origem in ('cadastro', 'link', 'numero_trocado')),
  -- Texto que a pessoa viu ao aceitar (link) ou que a dona confirmou (cadastro).
  texto text check (texto is null or char_length(texto) <= 300),
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 128),
  created_at timestamptz not null default now()
);
create index if not exists consentimentos_cliente_idx
  on public.consentimentos_whatsapp (cliente_id, created_at desc);

alter table public.consentimentos_whatsapp enable row level security;
revoke all on public.consentimentos_whatsapp from anon, authenticated;
grant select on public.consentimentos_whatsapp to authenticated;
drop policy if exists "Consentimentos: dona lê" on public.consentimentos_whatsapp;
create policy "Consentimentos: dona lê" on public.consentimentos_whatsapp
  for select to authenticated using (user_id = auth.uid());

-- ── trava das colunas sensíveis de clientes ────────────────────────────────
-- Fora das funções desta migration (que ligam polia.consentimento), ninguém
-- escreve o espelho do aceite, origem='link' nem novo=true. Trocar o número
-- com aceite ativo vira revogação "numero_trocado" no livro.
create or replace function public.clientes_trava_leads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('polia.consentimento', true), 'off') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.whatsapp_consentimento_em is not null or new.consentimento_origem is not null
       or new.origem = 'link' or new.novo then
      raise exception 'Aceite, origem pelo link e marca de novo só pelas funções da Pólia'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.whatsapp_consentimento_em is distinct from old.whatsapp_consentimento_em
     or new.consentimento_origem is distinct from old.consentimento_origem then
    raise exception 'Aceite de WhatsApp só muda pela função registrar_consentimento'
      using errcode = 'insufficient_privilege';
  end if;
  if new.origem = 'link' and old.origem is distinct from 'link' then
    raise exception 'Origem pelo link só entra pelo próprio link' using errcode = 'insufficient_privilege';
  end if;
  if new.novo and not old.novo then
    raise exception 'Marca de novo só entra pelo link' using errcode = 'insufficient_privilege';
  end if;

  -- O aceite vale pro número em que foi dado.
  if new.whatsapp is distinct from old.whatsapp and old.whatsapp_consentimento_em is not null then
    insert into consentimentos_whatsapp (user_id, cliente_id, whatsapp, evento, origem)
    values (old.user_id, old.id, old.whatsapp, 'revogacao', 'numero_trocado');
    new.whatsapp_consentimento_em := null;
    new.consentimento_origem := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clientes_trava_leads on public.clientes;
create trigger clientes_trava_leads before insert or update on public.clientes
  for each row execute function public.clientes_trava_leads();

-- ── registrar_consentimento (a dona) ───────────────────────────────────────
-- Marcar a caixinha no cadastro grava um aceite "cadastro"; desmarcar grava
-- uma revogação. Nada é apagado: o livro guarda as duas coisas.
create or replace function public.registrar_consentimento(p_cliente_id uuid, p_aceite boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cliente public.clientes;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  select * into v_cliente from clientes where id = p_cliente_id and user_id = v_uid for update;
  if not found then
    raise exception 'Cliente não encontrada' using errcode = 'no_data_found';
  end if;
  if v_cliente.whatsapp is null then
    raise exception 'Cliente sem WhatsApp' using errcode = 'check_violation';
  end if;
  -- Nada a fazer: já está no estado pedido.
  if p_aceite = (v_cliente.whatsapp_consentimento_em is not null) then
    return;
  end if;

  perform set_config('polia.consentimento', 'on', true);
  insert into consentimentos_whatsapp (user_id, cliente_id, whatsapp, evento, origem, texto)
  values (
    v_uid, p_cliente_id, v_cliente.whatsapp,
    case when p_aceite then 'aceite' else 'revogacao' end,
    'cadastro',
    case when p_aceite then 'A dona confirmou que a cliente autorizou mensagens da marca no WhatsApp' end
  );
  update clientes set
    whatsapp_consentimento_em = case when p_aceite then now() end,
    consentimento_origem = case when p_aceite then 'cadastro' end,
    updated_at = now()
  where id = p_cliente_id;
  perform set_config('polia.consentimento', 'off', true);
end;
$$;

-- ── links_captura ──────────────────────────────────────────────────────────
create table if not exists public.links_captura (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  ativo boolean not null default true,
  titulo text check (titulo is null or char_length(titulo) <= 120),
  pergunta text check (pergunta is null or char_length(pergunta) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists links_captura_slug_uniq on public.links_captura (slug);

-- Slug é da primeira conta que usou, pra sempre (sem FK: sobrevive à exclusão
-- da conta, justamente pra não ser herdado por outra marca).
create table if not exists public.links_captura_slugs (
  slug text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.links_captura_slugs enable row level security;
revoke all on public.links_captura_slugs from anon, authenticated;

create or replace function public.links_captura_reserva_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono uuid;
begin
  new.slug := lower(new.slug);
  if new.slug in (
    'polia', 'usepolia', 'polia-one', 'one', 'lab', 'admin', 'office', 'suporte', 'ajuda',
    'sil', 'oficial', 'teste', 'comunidade', 'blog', 'api', 'www'
  ) then
    raise exception 'Endereço reservado' using errcode = 'unique_violation';
  end if;
  select user_id into v_dono from links_captura_slugs where slug = new.slug;
  if v_dono is not null and v_dono <> new.user_id then
    raise exception 'Endereço já usado por outra marca' using errcode = 'unique_violation';
  end if;
  if v_dono is null then
    insert into links_captura_slugs (slug, user_id) values (new.slug, new.user_id);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists links_captura_slug on public.links_captura;
create trigger links_captura_slug before insert or update on public.links_captura
  for each row execute function public.links_captura_reserva_slug();

alter table public.links_captura enable row level security;
revoke all on public.links_captura from anon, authenticated;
grant select, insert, update on public.links_captura to authenticated;
drop policy if exists "Link: dona" on public.links_captura;
create policy "Link: dona" on public.links_captura for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── leads_envios ───────────────────────────────────────────────────────────
-- Cada envio do link, mesmo de número que já existe: é o que conta pro teto
-- (o teto antigo contava só ficha criada e reenvio do mesmo número passava).
create table if not exists public.leads_envios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 128),
  interesse text check (interesse is null or char_length(interesse) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists leads_envios_user_idx on public.leads_envios (user_id, created_at desc);
create index if not exists leads_envios_ip_idx on public.leads_envios (ip_hash, created_at desc)
  where ip_hash is not null;
alter table public.leads_envios enable row level security;
revoke all on public.leads_envios from anon, authenticated;

-- ── capturar_lead ──────────────────────────────────────────────────────────
-- Chamada só pelo servidor (service role), depois do anti-robô. Devolve:
-- 'ok', 'indisponivel' (link desligado, inexistente, conta sem plano pago ou
-- sem nome de marca) ou 'limite' (200 envios no dia pro link, ou 5 na hora
-- pro mesmo aparelho).
-- Número que já existe: não sobrescreve nada da ficha (o interesse novo fica
-- em leads_envios) e só ganha aceite se ainda não tinha nenhum. O aceite pelo
-- link é declarado, o número não é verificado: a fase 4 confirma na primeira
-- mensagem.
-- A lista de planos pagos anda junto com tierDoPlano em src/lib/planos.ts.
create or replace function public.capturar_lead(
  p_slug text,
  p_nome text,
  p_whatsapp text,
  p_interesse text default null,
  p_consentimento boolean default false,
  p_ip_hash text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_plano text;
  v_marca text;
  v_nome text := left(btrim(coalesce(p_nome, '')), 120);
  v_interesse text := left(nullif(btrim(p_interesse), ''), 500);
  v_ip text := left(nullif(btrim(p_ip_hash), ''), 128);
  v_cliente public.clientes;
  v_cliente_id uuid;
begin
  if v_nome = '' or p_whatsapp is null or p_whatsapp !~ '^[0-9]{12,13}$' then
    raise exception 'Dados inválidos' using errcode = 'check_violation';
  end if;

  select l.user_id, p.plano, nullif(btrim(p.business_name), '')
    into v_uid, v_plano, v_marca
  from links_captura l
  join profiles p on p.id = l.user_id
  where l.slug = lower(p_slug) and l.ativo;
  if v_uid is null or v_marca is null
     or coalesce(v_plano, '') not in ('controle', 'projete', 'beta') then
    return 'indisponivel';
  end if;

  if (select count(*) from leads_envios
      where user_id = v_uid and created_at > now() - interval '1 day') >= 200 then
    return 'limite';
  end if;
  if v_ip is not null and (select count(*) from leads_envios
      where ip_hash = v_ip and created_at > now() - interval '1 hour') >= 5 then
    return 'limite';
  end if;

  perform set_config('polia.consentimento', 'on', true);

  select * into v_cliente from clientes
    where user_id = v_uid and whatsapp = p_whatsapp for update;

  if found then
    v_cliente_id := v_cliente.id;
    update clientes set novo = true, updated_at = now() where id = v_cliente_id;
  else
    insert into clientes (user_id, nome, whatsapp, origem, status_pedido, interesse, novo)
    values (v_uid, v_nome, p_whatsapp, 'link', 'Primeiro contato', v_interesse, true)
    on conflict (user_id, whatsapp) where whatsapp is not null do update set novo = true
    returning * into v_cliente;
    v_cliente_id := v_cliente.id;
  end if;

  if p_consentimento and v_cliente.whatsapp_consentimento_em is null then
    insert into consentimentos_whatsapp (user_id, cliente_id, whatsapp, evento, origem, texto, ip_hash)
    -- Mesmo texto da caixinha da página /l/<slug>.
    values (v_uid, v_cliente_id, p_whatsapp, 'aceite', 'link',
            left('Aceito receber mensagens de ' || v_marca || ' no WhatsApp', 300), v_ip);
    update clientes set whatsapp_consentimento_em = now(), consentimento_origem = 'link'
    where id = v_cliente_id;
  end if;

  insert into leads_envios (user_id, cliente_id, ip_hash, interesse)
  values (v_uid, v_cliente_id, v_ip, v_interesse);

  perform set_config('polia.consentimento', 'off', true);
  return 'ok';
end;
$$;

revoke all on function public.capturar_lead(text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.capturar_lead(text, text, text, text, boolean, text) to service_role;
revoke all on function public.registrar_consentimento(uuid, boolean) from public, anon;
grant execute on function public.registrar_consentimento(uuid, boolean) to authenticated;
revoke all on function public.clientes_trava_leads() from public, anon, authenticated;
revoke all on function public.links_captura_reserva_slug() from public, anon, authenticated;
