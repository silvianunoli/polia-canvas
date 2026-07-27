-- Projeção e cenários: campo próprio de pró-labore desejado, editável e
-- persistido entre sessões (mesmo padrão de valor_hora_padrao, Fase 2).
alter table public.profiles add column if not exists pro_labore_desejado numeric;
