# Política de backup e retenção

> Referência de governança. Consultada em `/admin/governanca`.

## Backup do banco (Supabase)

O Supabase faz backup automático diário do Postgres. Retenção depende do plano do projeto (7 dias no Free, mais no Pro+). Não há backup próprio adicional configurado hoje — se o projeto crescer, considerar exportação periódica adicional (ex.: `pg_dump` agendado) antes de depender só do backup do provedor.

## Retenção por tipo de dado

| Tabela | Retenção | Por quê |
|---|---|---|
| `edge_function_logs` | 30 dias | Log operacional — sem valor de diagnóstico depois disso. |
| `erros_app` | 90 dias | Diagnóstico de erro client/server — útil por mais tempo que log de função. |
| `eventos_analytics` | sem limpeza automática ainda | Dado de negócio (comportamento de usuária) — decisão de reter fica pra quando o volume justificar. |
| `admin_audit_log` | permanente | Trilha de compliance — nunca apagar. |
| `convites_cadastro`, `assinaturas`, `profiles` e demais tabelas de produto | permanente | Dado operacional/de negócio, não é log. |

Limpeza dos dois primeiros é manual, via botão em `/admin/governanca` (RPC `admin_limpar_logs_antigos()`). Não roda em cron — precisa ser acionada por uma admin.

## Dado sensível

Nenhuma das tabelas de log guarda segredo, senha, ou dado de pagamento. `google_calendar_conexoes` guarda token OAuth e só é acessada via service role (nunca policy de leitura pra usuária). Ver `docs/checklist-seguranca.md`.
