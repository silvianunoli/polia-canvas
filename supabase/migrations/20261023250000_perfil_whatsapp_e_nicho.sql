-- WhatsApp e nicho no perfil (23/10/2026, pedido da Sil).
--
-- WhatsApp: opcional, pedido no cadastro (e editável em Configurações). Serve
-- pra Pólia mandar lembrete de tarefa e outros avisos por lá, com limite no
-- Grátis (o envio ainda não existe; esta migration só guarda o número).
-- Guardado só em dígitos com o 55, o mesmo formato de clientes.whatsapp.
-- Preencher o campo é o aceite: whatsapp_consentimento_em guarda quando, e só
-- o banco mexe nele (trigger abaixo), pra o cliente não forjar a data.
--
-- Nicho: obrigatório no bloco "Primeiros passos" do Painel (o onboarding desde
-- 14/10/2026). As chaves são as 8 do banco de ideias (lib/bancoIdeias) mais
-- 'outro'; a lista da tela mora em lib/nichoNegocio.ts.

alter table public.profiles
  add column if not exists whatsapp text,
  add column if not exists whatsapp_consentimento_em timestamptz,
  add column if not exists nicho text;

-- 55 + DDD (11 a 99, sem zero) + celular com 9 ou fixo de 8 dígitos.
alter table public.profiles drop constraint if exists profiles_whatsapp_check;
alter table public.profiles add constraint profiles_whatsapp_check
  check (whatsapp is null or whatsapp ~ '^55[1-9][1-9](9[0-9]{8}|[2-8][0-9]{7})$');

alter table public.profiles drop constraint if exists profiles_nicho_check;
alter table public.profiles add constraint profiles_nicho_check check (
  nicho is null or nicho in (
    'papelaria', 'moda', 'beleza', 'comida', 'digital', 'bemestar', 'servicos', 'artesanato',
    'outro'
  )
);

-- ── Data do aceite do WhatsApp ─────────────────────────────────────────────
-- Número novo (ou trocado) grava agora; número apagado apaga a data; qualquer
-- outra escrita mantém a data que já estava.
create or replace function public.profiles_whatsapp_consentimento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.whatsapp is distinct from old.whatsapp then
    new.whatsapp_consentimento_em := case when new.whatsapp is null then null else now() end;
  else
    new.whatsapp_consentimento_em := old.whatsapp_consentimento_em;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_whatsapp_consentimento on public.profiles;
create trigger profiles_whatsapp_consentimento
  before insert or update on public.profiles
  for each row execute function public.profiles_whatsapp_consentimento();

-- ── Cadastro ───────────────────────────────────────────────────────────────
-- O cadastro manda o WhatsApp já normalizado em raw_user_meta_data.whatsapp.
-- Valor fora do padrão vira null em vez de derrubar o cadastro inteiro (o
-- check acima recusaria o insert e a conta não seria criada).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, business_name, whatsapp)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'business_name',
    case
      when (new.raw_user_meta_data ->> 'whatsapp') ~ '^55[1-9][1-9](9[0-9]{8}|[2-8][0-9]{7})$'
        then new.raw_user_meta_data ->> 'whatsapp'
    end
  );
  return new;
end;
$function$;
