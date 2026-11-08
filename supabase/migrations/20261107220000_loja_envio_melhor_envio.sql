-- Frete pelo Melhor Envio, etapa 1 (ONE-189, fase 3 do ONE-178). Decisões da Sil em 07/11/2026:
-- frete calculado e retirada, etiqueta dentro da Pólia One, peso e medidas por produto.
--
-- Aqui só entram os dados: medidas no produto, a configuração de envio da loja e o canal
-- "melhor_envio" nas conexões (o token mora no Vault pelas funções canal_token_*, como no
-- Mercado Livre). Quem fala com o Melhor Envio é a função melhor-envio do Supabase.

-- ── medidas do produto ────────────────────────────────────────────────────
-- Em kg e cm, como o Melhor Envio pede. Vazio usa a caixa padrão da loja.
alter table public.produtos
  add column peso_kg numeric(7,3) check (peso_kg is null or (peso_kg > 0 and peso_kg <= 100)),
  add column altura_cm numeric(5,1) check (altura_cm is null or (altura_cm > 0 and altura_cm <= 200)),
  add column largura_cm numeric(5,1) check (largura_cm is null or (largura_cm > 0 and largura_cm <= 200)),
  add column comprimento_cm numeric(5,1) check (comprimento_cm is null or (comprimento_cm > 0 and comprimento_cm <= 200));

-- ── envio da loja ─────────────────────────────────────────────────────────
-- { cep_origem, caixa_padrao: {peso_kg, altura_cm, largura_cm, comprimento_cm},
--   retirada: {ativa, instrucoes}, remetente: {nome, documento, telefone, email,
--   cep, rua, numero, complemento, bairro, cidade, uf} }
-- Nada daqui sai pela loja_marca_publica: o remetente e as instruções da retirada são
-- privados (a retirada só aparece para quem já pagou).
alter table public.lojas_marca
  add column envio jsonb not null default '{}'::jsonb
    check (jsonb_typeof(envio) = 'object' and octet_length(envio::text) <= 8000);

-- ── canal da conexão ──────────────────────────────────────────────────────
alter table public.canal_conexoes drop constraint canal_conexoes_canal_check;
alter table public.canal_conexoes add constraint canal_conexoes_canal_check
  check (canal = any (array['tiktok_shop', 'shopee', 'mercado_livre', 'catalogo', 'melhor_envio']));

-- ── segredo interno da função melhor-envio ────────────────────────────────
-- Quem chama a função (cron, Worker da Pólia One, Worker das lojas) manda este segredo.
-- Os Workers leem pela service role; a função confere. O segredo do aplicativo do Melhor
-- Envio fica só nos secrets da função.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'melhor_envio_interno') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'melhor_envio_interno');
  end if;
end $$;

create or replace function public.melhor_envio_segredo_interno()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'melhor_envio_interno';
$$;

create or replace function public.conferir_segredo_melhor_envio(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select decrypted_secret = p_segredo from vault.decrypted_secrets where name = 'melhor_envio_interno'),
    false
  );
$$;

-- ── renovação diária do token ─────────────────────────────────────────────
-- O token do Melhor Envio vale 30 dias e o de renovação 45. Uma vez por dia, se alguma
-- conexão vence em menos de 10 dias, a função renova.
create or replace function public.disparar_melhor_envio_renovar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  segredo text;
begin
  if not exists (
    select 1 from canal_conexoes
     where canal = 'melhor_envio' and status = 'conectada'
       and access_expira_em < now() + interval '10 days'
  ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'melhor_envio_interno';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/melhor-envio',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-melhor-envio-segredo', segredo),
      body := jsonb_build_object('acao', 'renovar')
    );
  end if;
end;
$$;

select cron.schedule('melhor-envio-renovar', '23 6 * * *', $$select public.disparar_melhor_envio_renovar()$$);

do $$
declare
  f text;
begin
  foreach f in array array[
    'melhor_envio_segredo_interno()',
    'conferir_segredo_melhor_envio(text)',
    'disparar_melhor_envio_renovar()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
