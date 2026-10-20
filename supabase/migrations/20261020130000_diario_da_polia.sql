-- Diário da Pólia (20/10/2026, GRW-69 / CRM-19 / CRM-20).
--
-- 1. Campanha ganha modelo: 'padrao' (cartão branco, igual aos avisos) ou
--    'diario' (a newsletter de terça e quinta, com cabeçalho de edição,
--    saudação, caixa "Pra fazer hoje", assinatura e PS). Os campos próprios do
--    Diário ficam em jsonb pra não espalhar sete colunas que só um modelo usa.
--
-- 2. O botão "Diário da Pólia" em Configurações passa a valer no CRM. Até aqui
--    o espelho de profiles só rodava em business_type/full_name/business_name e
--    "consentir uma vez basta": desligar a preferência no app não tirava
--    ninguém da lista. Agora desligar descadastra e religar reinscreve.
--    reinscrito_em avisa a sincronização da lista que precisa destravar o
--    contato no Resend (quem saiu pelo link do e-mail fica marcado lá).

alter table public.crm_campanhas
  add column if not exists modelo text not null default 'padrao',
  add column if not exists diario jsonb;

alter table public.crm_campanhas drop constraint if exists crm_campanhas_modelo_check;
alter table public.crm_campanhas
  add constraint crm_campanhas_modelo_check check (modelo in ('padrao', 'diario'));

comment on column public.crm_campanhas.diario is
  'Só no modelo diario: {titulo, edicao, acao_texto, acao_rotulo, acao_url, despedida, ps}.';

alter table public.crm_contatos add column if not exists reinscrito_em timestamptz;

comment on column public.crm_contatos.reinscrito_em is
  'Religou o Diário em Configurações depois de sair. A sincronização da lista destrava o contato no Resend e limpa o campo.';

create or replace function public.crm_tg_preferencia_novidades()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.notif_novidades is not distinct from old.notif_novidades then
    return new;
  end if;

  if new.notif_novidades then
    update public.crm_contatos
       set consent_marketing = true,
           descadastrado_em = null,
           reinscrito_em = now(),
           atualizado_em = now()
     where user_id = new.id;
  else
    update public.crm_contatos
       set consent_marketing = false,
           descadastrado_em = coalesce(descadastrado_em, now()),
           reinscrito_em = null,
           atualizado_em = now()
     where user_id = new.id;
  end if;

  return new;
exception
  when others then
    raise warning 'crm_tg_preferencia_novidades falhou em %: %', new.id, sqlerrm;
    return new;
end;
$fn$;

revoke all on function public.crm_tg_preferencia_novidades() from public, anon, authenticated;

drop trigger if exists crm_preferencia_novidades on public.profiles;
create trigger crm_preferencia_novidades
  after update of notif_novidades on public.profiles
  for each row execute function public.crm_tg_preferencia_novidades();
