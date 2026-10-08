-- Plano de conteúdo: apagar e inserir numa transação só.
--
-- O BURACO
-- montarPlanoConteudoDoBanco (src/lib/planoConteudoBanco.functions.ts) apagava
-- de hoje em diante e DEPOIS inseria o ano novo, em duas chamadas separadas.
-- Se o insert falhasse (rede, timeout, linha inválida), o delete já tinha
-- acontecido: o plano de hoje até dezembro sumia da tela.
--
-- O QUE FAZ
-- RPC substituir_plano_conteudo_do_ano(p_user_id, p_ano, p_desde, p_linhas):
-- delete + insert dentro da mesma função, ou seja, da mesma transação. Erro
-- em qualquer ponto desfaz tudo e o plano antigo fica como estava.
--  - SECURITY DEFINER (a tabela não tem policy de insert/delete pra usuária)
--    com search_path vazio e tudo qualificado.
--  - Confere auth.uid() = p_user_id: o app chama pelo client da SESSÃO dela
--    (JWT), não pelo service role.
--  - Confere o plano no banco (Pro ou beta, mesma regra de temProjete), senão
--    qualquer conta logada criaria o plano chamando a RPC direto.
--  - Valida as linhas: até 366, data dentro do ano, tipo da lista do app,
--    título e ideia preenchidos e de tamanho razoável.
--  - Insert com ON CONFLICT (user_id, data) DO NOTHING: dia passado que já
--    tem linha (e o "já postei" dela) nunca é sobrescrito.
--  - Devolve quantos dias entraram.
--  - EXECUTE só pra authenticated e service_role (revogado de PUBLIC e anon).
--
-- O app funciona antes desta migração: sem a função, a RPC volta PGRST202 e o
-- código cai no caminho antigo de dois passos.
--
-- APLICAR pelo MCP apply_migration (supabase db push falha pela dessincronia
-- antiga do histórico). NÃO APLICADA ainda. Idempotente.

create or replace function public.substituir_plano_conteudo_do_ano(
  p_user_id uuid,
  p_ano integer,
  p_desde date,
  p_linhas jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inseridos integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'sem permissão pra alterar este plano de conteúdo'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id = p_user_id and p.plano in ('projete', 'beta')
  ) then
    raise exception 'plano sem acesso ao plano de conteúdo'
      using errcode = '42501';
  end if;

  if p_ano is null or p_ano < 2024 or p_ano > 2100 or p_desde is null then
    raise exception 'ano ou data inicial inválidos' using errcode = '22023';
  end if;

  if p_linhas is null
     or jsonb_typeof(p_linhas) <> 'array'
     or jsonb_array_length(p_linhas) > 366 then
    raise exception 'lista de dias inválida' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_linhas) as x(data date, tipo text, titulo text, ideia text)
     where x.data is null
        or extract(year from x.data) <> p_ano
        or x.tipo is null
        or x.tipo not in ('feed', 'stories', 'reels', 'carrossel')
        or coalesce(length(x.titulo), 0) = 0 or length(x.titulo) > 500
        or coalesce(length(x.ideia), 0) = 0 or length(x.ideia) > 5000
  ) then
    raise exception 'dia do plano inválido' using errcode = '22023';
  end if;

  delete from public.ia_plano_conteudo
   where user_id = p_user_id
     and ano = p_ano
     and data >= p_desde;

  insert into public.ia_plano_conteudo (user_id, ano, data, tipo, titulo, ideia)
  select p_user_id, p_ano, x.data, x.tipo, x.titulo, x.ideia
    from jsonb_to_recordset(p_linhas) as x(data date, tipo text, titulo text, ideia text)
  on conflict (user_id, data) do nothing;

  get diagnostics v_inseridos = row_count;
  return v_inseridos;
end;
$$;

comment on function public.substituir_plano_conteudo_do_ano(uuid, integer, date, jsonb) is
  'Troca o plano de conteúdo de p_desde em diante numa transação só (delete + insert). Chamada pelo app com o JWT da dona; confere auth.uid() e plano Pro/beta.';

revoke all on function public.substituir_plano_conteudo_do_ano(uuid, integer, date, jsonb) from public, anon;
grant execute on function public.substituir_plano_conteudo_do_ano(uuid, integer, date, jsonb) to authenticated, service_role;
