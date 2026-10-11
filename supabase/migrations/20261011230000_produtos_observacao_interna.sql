-- ONE-120 (feedback de teste, 11/10/2026): campo de texto livre só pra dona
-- da marca guardar código do produto, fornecedor e o que mais precisar.
-- "Interna" porque não aparece em nada que sai pra cliente. A RLS de
-- produtos (dona lê e escreve só as próprias linhas) já cobre a coluna.
alter table public.produtos
  add column if not exists observacao_interna text;

alter table public.produtos
  drop constraint if exists produtos_observacao_interna_tamanho;

alter table public.produtos
  add constraint produtos_observacao_interna_tamanho
  check (observacao_interna is null or char_length(observacao_interna) <= 2000);
