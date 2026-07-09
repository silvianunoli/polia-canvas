# Plano de rollback

> Referência de governança. Consultada em `/admin/governanca`.

## Código (Worker)

O deploy é via `wrangler deploy` (Cloudflare Workers). Cada deploy gera uma Version ID nova. Pra reverter:

1. `npx wrangler deployments list` — lista as versões anteriores.
2. `npx wrangler rollback <version-id>` — volta o Worker pra essa versão, sem precisar reverter código local nem rebuildar.

Isso reverte só o Worker (frontend + server functions). Não reverte o banco.

## Schema (migrations)

Migrations no Supabase não têm "down" automático — cada `apply_migration` é só pra frente. Reverter schema significa escrever uma migration nova que desfaz a anterior (ex.: `drop column`, `drop table`), nunca editar/apagar a migration original. Antes de aplicar uma migration arriscada em produção (troca de tipo de coluna, drop de tabela com dado), considerar rodar num branch de teste do Supabase primeiro.

## Dado

Se um bug gravou dado errado em produção: o backup automático do Supabase (ver `backup-policy.md`) é a rede de segurança — restaurar um point-in-time exige abrir chamado com o suporte do Supabase (ou usar a função de restore do painel, se disponível no plano). Não existe restore self-service automatizado dentro do app hoje.

## Quando usar cada um

- Bug visual ou de lógica sem escrita de dado ruim → rollback de Worker (rápido, resolve na hora).
- Migration quebrou algo → migration nova corrigindo, não reverter a antiga.
- Dado real corrompido/perdido → restore de backup via Supabase, é a última linha de defesa.
