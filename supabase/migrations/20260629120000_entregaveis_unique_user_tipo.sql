-- Garante 1 entregavel por (user_id, tipo). Resolve as duplicatas que vinham
-- de regeracao de etapa e de double-insert (duplo clique). A partir daqui as
-- etapas usam upsert com onConflict "user_id,tipo", entao regerar um entregavel
-- atualiza o existente em vez de criar outro.
-- (Ja aplicada em producao via MCP; este arquivo versiona a mudanca no repo.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entregaveis_user_tipo_unique'
  ) THEN
    ALTER TABLE entregaveis
      ADD CONSTRAINT entregaveis_user_tipo_unique UNIQUE (user_id, tipo);
  END IF;
END $$;
