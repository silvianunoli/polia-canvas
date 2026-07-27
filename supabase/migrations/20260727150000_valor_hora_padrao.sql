-- Valor-hora persistido (Fase 2 — modo Encomenda da calculadora, Projete).
-- Antes só existia dentro do calculadora_breakdown de um produto tipo serviço
-- já salvo; agora é reaproveitado entre os modos Serviço/Encomenda e entre
-- sessões, sem precisar redigitar.
alter table public.profiles add column if not exists valor_hora_padrao numeric;
