-- 08/10/2026: parse_primeiro_numero ignorava "mil", "milhão" e "k". No
-- Planejamento, "A meta atual é faturar 10 mil reais por mês" virou uma
-- "Meta pessoal" de R$ 10 (achado navegando na conta da Sil). Agora o sufixo
-- logo depois do número multiplica: mil/k = 1.000; mi/milhão/milhões =
-- 1.000.000. Formatos que já funcionavam ("R$ 3.000,00", "1.500", "49.90")
-- continuam iguais; "15 milhas" e "5 minutos" não viram milhar.
-- Metas do Planejamento que ainda guardam o número lido do jeito antigo
-- (separadas ANTES de trocar a função; meta que ela ajustou depois fica).
create temp table _metas_parse_antigo on commit drop as
select m.id, pc.valor
  from public.metas m
  join public.planejamento_campos pc
    on pc.user_id = m.user_id
   and pc.campo = case m.titulo when 'Meta do mês' then 'financeiro.meta_boa'
                                when 'Meta pessoal' then 'financeiro.meta_mensal' end
 where m.da_jornada
   and m.valor_alvo = public.parse_primeiro_numero(pc.valor);

create or replace function public.parse_primeiro_numero(p text)
returns numeric
language plpgsql
immutable
set search_path to ''
as $function$
declare
  r text[];
  m text;
  sufixo text;
  ultimo text;
  v numeric;
begin
  if p is null then return null; end if;
  r := regexp_match(p, '(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?|\d+(?:\.\d+)?)\s*(milh[õoã]es|milh[ãa]o|mil\M|mi\M|k\M)?', 'i');
  if r is null then return null; end if;
  m := r[1];
  sufixo := lower(coalesce(r[2], ''));
  if position(',' in m) > 0 then
    -- vírgula = decimal BR; ponto = milhar
    m := replace(replace(m, '.', ''), ',', '.');
  elsif position('.' in m) > 0 then
    -- sem vírgula: se o último grupo após ponto tem 3 dígitos, é milhar
    ultimo := (regexp_match(m, '\.(\d+)$'))[1];
    if ultimo is not null and length(ultimo) = 3 then
      m := replace(m, '.', '');
    end if;
  end if;
  v := m::numeric;
  if sufixo in ('mil', 'k') then
    v := v * 1000;
  elsif sufixo like 'milh%' or sufixo = 'mi' then
    v := v * 1000000;
  end if;
  return v;
exception when others then
  return null;
end;
$function$;

-- Corrige só as metas separadas acima, quando o número novo é diferente.
update public.metas m
   set valor_alvo = public.parse_primeiro_numero(a.valor), updated_at = now()
  from _metas_parse_antigo a
 where m.id = a.id
   and public.parse_primeiro_numero(a.valor) is not null
   and m.valor_alvo is distinct from public.parse_primeiro_numero(a.valor);
