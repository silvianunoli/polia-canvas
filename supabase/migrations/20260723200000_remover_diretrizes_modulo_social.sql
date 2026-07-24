-- Módulo Social — reversão parcial do Ajuste 1: a feature de diretrizes por
-- upload (design/voz) saiu do escopo. O design e o tom de voz da Pólia continuam
-- vindo só dos arquivos fixos do repo (DESIGN-3.md, GUARDRAILS-VOZ.md), montados
-- no system prompt de todo produzir/ajustar — sem upload em runtime, sem R12/R16.
drop table if exists diretrizes;
