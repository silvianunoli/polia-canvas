-- O convite passa a carregar o tipo de acesso: qual plano a conta nasce e se
-- vem com acesso de administradora. Antes disto não existia NENHUMA forma de
-- definir plano ou is_admin pela interface -- só SQL na mão.
alter table public.convites_cadastro
  add column if not exists plano text not null default 'confere',
  add column if not exists is_admin boolean not null default false;

-- Trava os valores: profiles.plano não tem check (histórico), mas o convite
-- é escrito pela interface e um valor torto aqui vira conta sem acesso.
-- 'beta' = acesso total, usado nas contas de teste (ver lib/planos.ts do app).
alter table public.convites_cadastro
  drop constraint if exists convites_cadastro_plano_check;
alter table public.convites_cadastro
  add constraint convites_cadastro_plano_check
  check (plano in ('confere', 'controle', 'projete', 'beta'));

comment on column public.convites_cadastro.plano is
  'Plano com que a conta nasce. Aplicado por aplicar_convite_no_perfil() no INSERT do profile. Não é retroativo: mudar aqui depois da conta criada não muda nada.';
comment on column public.convites_cadastro.is_admin is
  'true = a conta nasce com acesso ao office.usepolia.com.br e às telas admin. Aplicado junto com o plano.';

-- O convite só vale no nascimento da conta. Fica em BEFORE INSERT no profile
-- (e não em handle_new_user) pra não reescrever uma função de auth que já
-- funciona, e porque é o mesmo lugar onde tmp_plano_beta_conta_teste já mexe
-- em new.plano.
create or replace function public.aplicar_convite_no_perfil()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text;
  v_plano text;
  v_admin boolean;
begin
  -- handle_new_user() roda AFTER INSERT em auth.users, então o e-mail já está lá.
  select lower(trim(u.email)) into v_email from auth.users u where u.id = new.id;
  if v_email is null then
    return new;
  end if;

  -- Sem filtro por usado_em de propósito: marcar_convite_usado() é outro
  -- gatilho da mesma transação e a ordem entre os dois não deve importar.
  select c.plano, c.is_admin into v_plano, v_admin
  from public.convites_cadastro c
  where c.email = v_email;

  if not found then
    return new;
  end if;

  new.plano := v_plano;
  new.is_admin := v_admin;
  return new;
end $$;

-- Sem EXECUTE pra anon/authenticated: função security definer que escreve
-- is_admin não tem por que ficar alcançável (mesmo cuidado das crm_*).
revoke all on function public.aplicar_convite_no_perfil() from anon, authenticated;

-- Nome começando com 'a' de propósito: gatilhos do mesmo timing disparam em
-- ordem alfabética, então este roda ANTES de tmp_plano_beta_conta_teste e a
-- conta de teste continua ganhando 'beta' por cima, como já era.
drop trigger if exists aplicar_convite_no_perfil on public.profiles;
create trigger aplicar_convite_no_perfil
  before insert on public.profiles
  for each row execute function public.aplicar_convite_no_perfil();
