-- QA-30 (08/10/2026): histórico mensal da Meta do mês.
--
-- POR QUE
-- O raio-x de um mês passado lia a Meta do mês de HOJE: se a Ana mudou a meta
-- em outubro, o raio-x de setembro comparava setembro com a meta de outubro.
-- Não existia histórico nenhum. A partir desta migração, cada mês guarda o
-- valor_alvo que a Meta do mês tinha naquele mês (o último valor do mês).
--
-- O QUE FAZ
--  1) Tabela meta_do_mes_historico (user_id, mes 'AAAA-MM', valor_alvo,
--     criado_em). RLS: a dona lê; ninguém escreve pelo client (sem policy de
--     insert/update/delete). Quem escreve é só o gatilho (SECURITY DEFINER).
--  2) Gatilho em metas: quando uma linha "Meta do mês" é criada, ou muda
--     valor_alvo / status / título / da_jornada, recalcula qual linha vale
--     como Meta do mês (mesmo critério de escolherMetaDoMes em
--     src/lib/metaDoMes.ts: arquivada nunca, ativa antes de concluída, a do
--     Planejamento antes da criada à mão, a atualizada mais recentemente) e
--     grava o valor_alvo dela no mês corrente em horário de Brasília.
--     Mudança só de valor_atual (progresso) não dispara.
--  3) Backfill: grava o valor de hoje como o do mês corrente pra quem já tem
--     Meta do mês. Meses anteriores ficam sem linha de propósito: ninguém
--     sabe qual era a meta deles, e o raio-x diz isso na tela.
--  4) ia_raiox.avisos: frases fixas que o raio-x mostra junto da leitura
--     (ex.: "A meta de agosto não ficou guardada; a leitura usa a meta de
--     hoje."). O app funciona sem esta coluna (cai no fallback), mas só
--     guarda o aviso depois dela existir.
--
-- O app (raiox.functions.ts) funciona antes desta migração: sem a tabela,
-- a leitura do histórico falha, cai na meta de hoje e o aviso aparece.
--
-- Exclusão de conta: excluir_dados_do_usuario() varre toda tabela de public
-- com user_id uuid (migração 20260915150000), então esta entra sozinha. A FK
-- com on delete cascade cobre a exclusão pelo auth.users.
--
-- APLICAR pelo MCP apply_migration (supabase db push falha pela dessincronia
-- antiga do histórico). Idempotente: seguro rodar de novo.

-- 1) Tabela -------------------------------------------------------------------
create table if not exists public.meta_do_mes_historico (
  user_id uuid not null references auth.users(id) on delete cascade,
  mes text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor_alvo numeric not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, mes)
);

comment on table public.meta_do_mes_historico is
  'Valor da Meta do mês em cada mês (último valor do mês, horário de Brasília). Escrita só pelo gatilho registrar_meta_do_mes_historico; lida pelo raio-x de mês passado.';

alter table public.meta_do_mes_historico enable row level security;

drop policy if exists "MetaDoMesHistorico: dona seleciona" on public.meta_do_mes_historico;
create policy "MetaDoMesHistorico: dona seleciona"
  on public.meta_do_mes_historico for select
  using (auth.uid() = user_id);
-- sem policy de insert/update/delete: o client não escreve aqui.

revoke insert, update, delete, truncate on public.meta_do_mes_historico from anon, authenticated;

-- 2) Gatilho ------------------------------------------------------------------
create or replace function public.registrar_meta_do_mes_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_alvo numeric;
  v_mes  text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
begin
  -- Só interessa linha que é (ou deixou de ser) a Meta do mês.
  -- (ifs aninhados: SQL não garante curto-circuito no OR, e OLD é nulo no INSERT)
  if NEW.titulo is distinct from 'Meta do mês' then
    if TG_OP = 'INSERT' then
      return NEW;
    elsif OLD.titulo is distinct from 'Meta do mês' then
      return NEW;
    end if;
  end if;

  -- Mesmo critério de escolherMetaDoMes (src/lib/metaDoMes.ts).
  select m.valor_alvo
    into v_alvo
    from public.metas m
   where m.user_id = NEW.user_id
     and m.titulo = 'Meta do mês'
     and m.status <> 'arquivada'
   order by (case when m.status = 'ativa' then 2 else 0 end)
          + (case when m.da_jornada then 1 else 0 end) desc,
            m.updated_at desc nulls last
   limit 1;

  -- Sem Meta do mês válida (ou sem alvo): não apaga o que o mês já guardou.
  if v_alvo is null then
    return NEW;
  end if;

  insert into public.meta_do_mes_historico (user_id, mes, valor_alvo)
  values (NEW.user_id, v_mes, v_alvo)
  on conflict (user_id, mes) do update
    set valor_alvo = excluded.valor_alvo
    where public.meta_do_mes_historico.valor_alvo is distinct from excluded.valor_alvo;

  return NEW;
end;
$fn$;

revoke execute on function public.registrar_meta_do_mes_historico() from public, anon, authenticated;

drop trigger if exists metas_registrar_meta_do_mes_historico on public.metas;
create trigger metas_registrar_meta_do_mes_historico
  after insert or update of valor_alvo, status, titulo, da_jornada
  on public.metas
  for each row
  execute function public.registrar_meta_do_mes_historico();

-- 3) Backfill: o valor de hoje vira o do mês corrente -------------------------
-- O distinct on escolhe a linha preferida antes de olhar o alvo; se ela não
-- tem valor_alvo, a usuária fica sem linha (mesmo comportamento do gatilho).
insert into public.meta_do_mes_historico (user_id, mes, valor_alvo)
select escolhida.user_id,
       to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'),
       escolhida.valor_alvo
  from (
    select distinct on (m.user_id) m.user_id, m.valor_alvo
      from public.metas m
     where m.titulo = 'Meta do mês'
       and m.status <> 'arquivada'
       -- metas.user_id não tem FK: linha órfã de conta apagada direto no
       -- auth quebraria a FK daqui e derrubaria a migração inteira.
       and exists (select 1 from auth.users u where u.id = m.user_id)
     order by m.user_id,
              (case when m.status = 'ativa' then 2 else 0 end)
            + (case when m.da_jornada then 1 else 0 end) desc,
              m.updated_at desc nulls last
  ) escolhida
 where escolhida.valor_alvo is not null
on conflict (user_id, mes) do nothing;

-- 4) Avisos fixos do raio-x ---------------------------------------------------
alter table public.ia_raiox
  add column if not exists avisos text[] not null default '{}';

comment on column public.ia_raiox.avisos is
  'Frases fixas mostradas junto da leitura (meta ou preço do mês que não ficaram guardados). Escritas pelo app, não pela IA.';
