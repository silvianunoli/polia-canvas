-- Teste de 7 dias do Pro (reverse trial), GRW-66, aprovado pela Sil em 20/10/2026.
--
-- Conta nova nasce no Pro por 7 dias e volta pro Grátis sozinha se não assinar.
-- Durante o teste profiles.plano = 'projete' DE VERDADE: as dezenas de leitores
-- do plano (rotas, cotas no banco, IA, Raio-x) funcionam sem mudar um por um.
-- O que diz "isso é teste, não assinatura" é esta tabela, que só o servidor
-- escreve (a usuária só lê a própria linha, pra tela mostrar quantos dias faltam).
-- A data de fim não mora em profiles de propósito: lá a usuária edita a própria
-- linha, e uma coluna nova ali precisaria de outra trava na policy de update.

create table if not exists public.testes_pro (
  user_id uuid primary key references auth.users (id) on delete cascade,
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  -- 'cadastro' (conta nova) ou 'reativacao' (conta do Grátis que já existia em 20/10/2026)
  origem text not null default 'cadastro' check (origem in ('cadastro', 'reativacao')),
  -- Quando o cron fechou o teste (voltou pro Grátis ou já tinha assinado).
  encerrado_em timestamptz,
  -- Resultado do fechamento: 'voltou_gratis' ou 'assinou'.
  resultado text check (resultado in ('voltou_gratis', 'assinou')),
  created_at timestamptz not null default now()
);

alter table public.testes_pro enable row level security;

drop policy if exists "Testes Pro: dona lê o próprio" on public.testes_pro;
create policy "Testes Pro: dona lê o próprio" on public.testes_pro
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Testes Pro: admin lê tudo" on public.testes_pro;
create policy "Testes Pro: admin lê tudo" on public.testes_pro
  for select to authenticated using (public.is_admin(auth.uid()));

revoke insert, update, delete on public.testes_pro from anon, authenticated;

create index if not exists testes_pro_abertos_idx on public.testes_pro (fim) where encerrado_em is null;

-- Começa o teste: só pra conta no Grátis, sem assinatura ativa, que nunca teve teste.
create or replace function public.iniciar_teste_pro(p_user uuid, p_dias int, p_origem text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_plano text;
begin
  select plano into v_plano from profiles where id = p_user for update;
  if v_plano is distinct from 'confere' then
    return false;
  end if;
  if exists (select 1 from profiles where id = p_user and coalesce(is_admin, false)) then
    return false;
  end if;
  if exists (
    select 1 from assinaturas
    where user_id = p_user and status in ('active', 'trialing', 'past_due')
  ) then
    return false;
  end if;

  insert into testes_pro (user_id, fim, origem)
  values (p_user, now() + make_interval(days => p_dias), p_origem)
  on conflict (user_id) do nothing;
  if not found then
    return false;
  end if;

  update profiles set plano = 'projete' where id = p_user;
  return true;
end;
$$;

revoke all on function public.iniciar_teste_pro(uuid, int, text) from public, anon, authenticated;

-- Conta nova: o perfil nasce 'confere' (default) e o teste começa logo depois.
-- AFTER INSERT pra rodar depois do aplicar_convite_no_perfil (BEFORE INSERT):
-- convite que já dá plano pago ou beta deixa plano <> 'confere' e não ganha teste.
create or replace function public.teste_pro_no_cadastro()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.plano = 'confere' then
    perform public.iniciar_teste_pro(new.id, 7, 'cadastro');
  end if;
  return new;
end;
$$;

drop trigger if exists teste_pro_no_cadastro on public.profiles;
create trigger teste_pro_no_cadastro
  after insert on public.profiles
  for each row execute function public.teste_pro_no_cadastro();

-- Fecha os testes vencidos. Quem assinou (Premium ou Pro, assinatura ativa)
-- fica como está; quem não assinou volta pro Grátis. Só mexe em plano
-- 'projete': se o webhook já gravou 'controle', o teste só é marcado.
create or replace function public.encerrar_testes_pro()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  v_assinou boolean;
  v_total integer := 0;
begin
  for r in
    select t.user_id from testes_pro t
    where t.encerrado_em is null and t.fim <= now()
    for update of t skip locked
  loop
    v_assinou := exists (
      select 1 from assinaturas
      where user_id = r.user_id and status in ('active', 'trialing', 'past_due')
    );
    if not v_assinou then
      update profiles set plano = 'confere' where id = r.user_id and plano = 'projete';
    end if;
    update testes_pro
      set encerrado_em = now(), resultado = case when v_assinou then 'assinou' else 'voltou_gratis' end
      where user_id = r.user_id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.encerrar_testes_pro() from public, anon, authenticated;

-- Assinou no meio do teste: fecha o teste na hora (a faixa "faltam N dias"
-- sumiria só quando o cron passasse depois do fim). Vale pra Premium e Pro.
create or replace function public.fechar_teste_pro_ao_assinar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status in ('active', 'trialing', 'past_due') then
    update testes_pro
      set encerrado_em = now(), resultado = 'assinou'
      where user_id = new.user_id and encerrado_em is null;
  end if;
  return new;
end;
$$;

drop trigger if exists fechar_teste_pro_ao_assinar on public.assinaturas;
create trigger fechar_teste_pro_ao_assinar
  after insert or update of status on public.assinaturas
  for each row execute function public.fechar_teste_pro_ao_assinar();

-- A cada 15 minutos. O cron.schedule com o mesmo nome substitui o anterior.
select cron.schedule('encerrar-testes-pro', '*/15 * * * *', $$select public.encerrar_testes_pro();$$);
