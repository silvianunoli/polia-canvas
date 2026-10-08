-- SEG-07 (achado no QA-33, 07/10/2026). No plano Grátis o quadro mais antigo
-- fica na cota (1) e os outros abrem só leitura na tela (planner.$slug.tsx,
-- idsAcimaDaCota). O gatilho cota_confere_quadros só protege a LINHA do quadro:
-- os cartões (tarefas) e as colunas (quadro_colunas) de um quadro excedente
-- seguiam graváveis chamando a API direto.
--
-- Este gatilho barra INSERT e UPDATE de cartão e de coluna num quadro acima da
-- cota, com a mesma ordem da tela (created_at, depois id). Apagar continua
-- permitido: ela pode limpar o quadro, e apagar o quadro leva os filhos junto.
-- Mover um cartão PARA FORA de um quadro excedente também conta como editar
-- esse quadro e é barrado.

create or replace function public.quadro_acima_da_cota(p_quadro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.quadros q
      join public.profiles p on p.id = q.user_id
     where q.id = p_quadro_id
       and coalesce(p.plano, 'confere') in ('confere', 'cancelada')
       -- 1 = COTAS_CONFERE.planner, o mesmo argumento do cota_confere_quadros.
       and (
         select count(*)
           from public.quadros o
          where o.user_id = q.user_id
            and (o.created_at < q.created_at or (o.created_at = q.created_at and o.id < q.id))
       ) >= 1
  );
$fn$;

create or replace function public.assert_quadro_dentro_da_cota()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.quadro_id is not null and public.quadro_acima_da_cota(new.quadro_id) then
    raise exception 'Este quadro passou do limite do plano Grátis. Assine o Premium pra editar.'
      using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.quadro_id is not null
     and old.quadro_id is distinct from new.quadro_id
     and public.quadro_acima_da_cota(old.quadro_id) then
    raise exception 'Este quadro passou do limite do plano Grátis. Assine o Premium pra editar.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

revoke all on function public.quadro_acima_da_cota(uuid) from public, anon;
grant execute on function public.quadro_acima_da_cota(uuid) to authenticated;

drop trigger if exists quadro_excedente_tarefas on public.tarefas;
create trigger quadro_excedente_tarefas
  before insert or update on public.tarefas
  for each row execute function public.assert_quadro_dentro_da_cota();

drop trigger if exists quadro_excedente_colunas on public.quadro_colunas;
create trigger quadro_excedente_colunas
  before insert or update on public.quadro_colunas
  for each row execute function public.assert_quadro_dentro_da_cota();
