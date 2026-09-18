-- Espelho automático das portas de entrada dentro de crm_contatos.
--
-- Até 18/09/2026 a cópia só acontecia quando alguém clicava no botão de
-- importar em /crm (sincronizarFontes, polia-admin/src/lib/crm.functions.ts).
-- Quem fazia o quiz ou baixava o manual ficava invisível no CRM até alguém
-- lembrar de clicar: foi assim que uma lead de 02/09 passou 16 dias fora da
-- lista mesmo tendo respondido o quiz.
--
-- Os gatilhos abaixo fazem o mesmo trabalho na hora da inserção, com a mesma
-- regra da função TS de propósito: dedupe por lower(email) e contato que já
-- existe só ganha os campos que ainda estavam vazios, nunca sobrescreve o que
-- foi editado à mão no CRM. O botão continua valendo como rede de segurança e
-- para reprocessar histórico.
--
-- Falha do espelho nunca derruba o cadastro da lead: o handler no fim de
-- crm_tg_espelhar engole o erro como warning e devolve NEW.

-- Mesmo nome que o TS monta a partir do e-mail: "ana.paula2" vira "Ana Paula".
create or replace function public.crm_nome_do_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(
    nullif(
      trim(
        regexp_replace(
          initcap(
            regexp_replace(
              regexp_replace(split_part(p_email, '@', 1), '[._-]+', ' ', 'g'),
              '\d+', '', 'g'
            )
          ),
          '\s+', ' ', 'g'
        )
      ),
      ''
    ),
    p_email
  );
$fn$;

comment on function public.crm_nome_do_email(text) is
  'Nome de exibição derivado do e-mail, para iscas que não pedem nome. Espelha nomeDoEmail() de polia-admin/src/lib/crm.functions.ts.';

-- Upsert idempotente de uma pessoa no CRM. Existindo, só preenche buraco.
create or replace function public.crm_espelhar_contato(
  p_email text,
  p_nome text default null,
  p_origem text default 'manual',
  p_telefone text default null,
  p_tipo_negocio text default null,
  p_consent_marketing boolean default false,
  p_consent_texto text default null,
  p_descadastrado_em timestamptz default null,
  p_user_id uuid default null,
  p_status text default 'lead',
  p_criado_em timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  if v_email = '' then
    return null;
  end if;

  select id into v_id from public.crm_contatos where lower(email) = v_email;

  if v_id is null then
    insert into public.crm_contatos (
      nome, email, telefone, tipo_negocio, origem, status, user_id,
      consent_marketing, consent_texto, descadastrado_em, criado_em
    ) values (
      coalesce(nullif(trim(coalesce(p_nome, '')), ''), public.crm_nome_do_email(v_email)),
      v_email,
      nullif(trim(coalesce(p_telefone, '')), ''),
      p_tipo_negocio,
      coalesce(p_origem, 'manual'),
      coalesce(p_status, 'lead'),
      p_user_id,
      coalesce(p_consent_marketing, false) and p_descadastrado_em is null,
      p_consent_texto,
      p_descadastrado_em,
      coalesce(p_criado_em, now())
    )
    -- duas iscas no mesmo instante: quem chegou primeiro fica, a segunda cai
    -- no update da próxima vez que a pessoa aparecer.
    on conflict do nothing
    returning id into v_id;
    return v_id;
  end if;

  update public.crm_contatos set
    telefone = coalesce(telefone, nullif(trim(coalesce(p_telefone, '')), '')),
    tipo_negocio = coalesce(tipo_negocio, p_tipo_negocio),
    user_id = coalesce(user_id, p_user_id),
    consent_texto = coalesce(consent_texto, p_consent_texto),
    -- virou usuária do app: status e origem sobem, nunca descem
    status = case
      when p_status = 'cliente' and status in ('lead', 'conversando') then 'cliente'
      else status
    end,
    origem = case when p_origem = 'app' then 'app' else origem end,
    -- descadastro de qualquer fonte manda; fora isso, consentir uma vez basta
    consent_marketing = case
      when p_descadastrado_em is not null then false
      else consent_marketing or coalesce(p_consent_marketing, false)
    end,
    descadastrado_em = coalesce(descadastrado_em, p_descadastrado_em),
    atualizado_em = now()
  where id = v_id;

  return v_id;
end;
$fn$;

comment on function public.crm_espelhar_contato is
  'Espelha uma pessoa em crm_contatos deduplicando por lower(email). Idempotente: contato existente só recebe os campos que estavam vazios.';

-- Um gatilho para todas as fontes: lê NEW como jsonb e traduz cada tabela.
create or replace function public.crm_tg_espelhar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  n jsonb := to_jsonb(new);
  v_email text;
  v_nome text;
  v_origem text;
  v_telefone text;
  v_tipo text;
  v_consent boolean := false;
  v_consent_texto text;
  v_descadastrado timestamptz;
  v_user uuid;
  v_status text := 'lead';
  v_criado timestamptz;
begin
  case tg_table_name
    when 'lista_espera' then
      v_email := n->>'email';
      v_nome := n->>'nome';
      v_origem := 'lista_espera';
      v_telefone := n->>'telefone';
      v_tipo := n->>'tipo_negocio';
      v_consent := coalesce((n->>'novidades')::boolean, false);
      v_criado := (n->>'criado_em')::timestamptz;

    when 'quiz_leads' then
      v_email := n->>'email';
      v_origem := 'quiz';
      v_telefone := n->>'telefone';
      v_consent := coalesce((n->>'consentimento')::boolean, false);
      v_consent_texto := n->>'consent_texto';
      v_descadastrado := (n->>'descadastrado_em')::timestamptz;
      v_criado := (n->>'created_at')::timestamptz;

    when 'manual_leads' then
      v_email := n->>'email';
      v_origem := 'manual_gratuito';
      v_telefone := n->>'telefone';
      v_consent := coalesce((n->>'consentimento')::boolean, false);
      v_consent_texto := n->>'consent_texto';
      v_descadastrado := (n->>'descadastrado_em')::timestamptz;
      v_criado := (n->>'created_at')::timestamptz;

    when 'contatos' then
      v_email := n->>'email';
      v_nome := n->>'nome';
      v_origem := 'formulario_contato';
      v_telefone := n->>'telefone';
      -- quem manda mensagem pelo /contato não pediu e-mail de marketing
      v_consent := false;
      v_criado := (n->>'created_at')::timestamptz;

    when 'profiles' then
      v_user := (n->>'id')::uuid;
      select u.email into v_email from auth.users u where u.id = v_user;
      v_nome := coalesce(nullif(n->>'full_name', ''), nullif(n->>'business_name', ''));
      v_origem := 'app';
      v_tipo := n->>'business_type';
      v_consent := coalesce((n->>'notif_novidades')::boolean, false);
      v_status := 'cliente';
      v_criado := (n->>'created_at')::timestamptz;

    else
      return new;
  end case;

  perform public.crm_espelhar_contato(
    v_email, v_nome, v_origem, v_telefone, v_tipo, v_consent,
    v_consent_texto, v_descadastrado, v_user, v_status, v_criado
  );

  return new;
exception
  when others then
    -- o CRM é espelho, não fonte: a lead entra de qualquer jeito
    raise warning 'crm_tg_espelhar falhou em % (%): %', tg_table_name, coalesce(v_email, '?'), sqlerrm;
    return new;
end;
$fn$;

comment on function public.crm_tg_espelhar() is
  'Gatilho compartilhado que espelha lista_espera, quiz_leads, manual_leads, contatos e profiles em crm_contatos. Erro aqui vira warning: nunca derruba a inserção da fonte.';

drop trigger if exists crm_espelho_lista_espera on public.lista_espera;
create trigger crm_espelho_lista_espera
  after insert on public.lista_espera
  for each row execute function public.crm_tg_espelhar();

drop trigger if exists crm_espelho_quiz_leads on public.quiz_leads;
create trigger crm_espelho_quiz_leads
  after insert or update of descadastrado_em, telefone on public.quiz_leads
  for each row execute function public.crm_tg_espelhar();

drop trigger if exists crm_espelho_manual_leads on public.manual_leads;
create trigger crm_espelho_manual_leads
  after insert or update of descadastrado_em, telefone on public.manual_leads
  for each row execute function public.crm_tg_espelhar();

drop trigger if exists crm_espelho_contatos on public.contatos;
create trigger crm_espelho_contatos
  after insert on public.contatos
  for each row execute function public.crm_tg_espelhar();

drop trigger if exists crm_espelho_profiles on public.profiles;
create trigger crm_espelho_profiles
  after insert or update of business_type, full_name, business_name on public.profiles
  for each row execute function public.crm_tg_espelhar();

-- As funções acima são SECURITY DEFINER e escrevem em crm_contatos, que tem RLS
-- sem policy. Sem isto o PostgREST as expõe em /rest/v1/rpc/... para anon: dava
-- para qualquer um na internet injetar contato no CRM. Só service role chama, que
-- é por onde o site grava as leads (supabaseAdmin em polia-app/src/lib/*.ts).
revoke all on function public.crm_nome_do_email(text) from public, anon, authenticated;
revoke all on function public.crm_espelhar_contato(
  text, text, text, text, text, boolean, text, timestamptz, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.crm_tg_espelhar() from public, anon, authenticated;
