-- ONE-124 (feedback de teste, 11/10/2026): importar extrato OFX, planilha CSV
-- e XML de NF-e no Financeiro.
--   id_externo: id estável da origem ("ofx:<conta>:<FITID>", "nfe:<chave>").
--     O índice único por usuária faz o mesmo extrato importado duas vezes não
--     duplicar nada (o insert usa on conflict do nothing). Null não conflita,
--     então lançamento digitado e linha de CSV (sem id) seguem livres.
--   importacao_id: agrupa as linhas de uma importação pra dar pra desfazer.
-- As duas são aditivas; a RLS de lancamentos (dona só nas próprias linhas)
-- já cobre as colunas novas.
alter table public.lancamentos
  add column if not exists id_externo text,
  add column if not exists importacao_id uuid;

alter table public.lancamentos
  drop constraint if exists lancamentos_id_externo_tamanho;
alter table public.lancamentos
  add constraint lancamentos_id_externo_tamanho
  check (id_externo is null or char_length(id_externo) <= 200);

create unique index if not exists lancamentos_user_id_externo_uniq
  on public.lancamentos (user_id, id_externo);

create index if not exists lancamentos_importacao_id_idx
  on public.lancamentos (importacao_id)
  where importacao_id is not null;
