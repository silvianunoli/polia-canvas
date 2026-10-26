# Diário de bordo

Registro curto, por sessão, do que mudou e por quê (regra do CLAUDE.md: escrever antes de mexer no código).

## 2026-09-17 — Founder Dashboard, bloco 1 (monitor em background)

Contexto: o Founder Dashboard vive no polia-admin (`office.usepolia.com.br/founder`), mas migrations e Edge Functions moram aqui. Plano completo em `~/.claude/plans/c-users-silnu-downloads-polia-founder-d-fizzy-hearth.md` (6 blocos, seguindo a prioridade do PDF de direcionamento).

- `supabase/functions/founder-monitor/`: health-checks por serviço (API `/health`, banco, auth, Stripe, Resend, IA via `ia_geracoes`, storage), snapshot diário em `founder_metricas_diarias`, regras de alerta com dedup em `founder_alertas`; alerta crítico novo repassa ao `alertas-criticos` com `tipo: founder:*`. Auth: header `x-founder-secret` (cron) ou JWT de admin (botão "Verificar agora").
- `supabase/migrations/20260917162924_founder_monitor_base.sql`: colunas de baseline, `chave_dedup`, `founder_jobs_falhos()`, `disparar_founder_monitor()` e `cron.schedule('founder-monitor', '*/10 * * * *')`.
- Segredo `founder_monitor_secret` criado no Vault e espelhado como `FOUNDER_MONITOR_SECRET` nos secrets das Edge Functions (fora de migration).
- Desagendado pela Sil no mesmo dia: `checar-taxa-erro-alertas`, que duplicava a regra `pico_erros_app` do monitor.
- Achado na primeira rodada: `STRIPE_SECRET_KEY` das Edge Functions expirada (HTTP 401 "Expired API Key") e `RESEND_API_KEY` inválida. O `stripe-webhook` depende da primeira.

## 2026-09-17 — Founder Dashboard, bloco 2 (instrumentação de eventos)

- Migration `20260917170020_founder_eventos_schema.sql`: `founder_eventos` (allowlist de eventos, RLS insert próprio/nulo, leitura admin), `founder_eventos_sistema`, `founder_api_chamadas`, `founder_features` (seed do catálogo rota→feature).
- `src/lib/founder-features.ts` (+ teste): mapa rota→feature, normalização de página, ambiente pelo hostname.
- `src/lib/founder-eventos.ts` (client): sessão em sessionStorage (30 min), fila com flush em lote por fetch keepalive, heartbeat de 60 s só com aba visível e atividade recente, `sessao_fim` no pagehide, marcação de login/signup pendente pro fluxo do Google.
- `src/lib/founder-eventos.server.ts`: eventos de servidor, eventos de sistema, medição de chamadas e leitura do `sub` do bearer (só atribuição).
- `src/start.ts`: `medirServerFn` (toda server function → `founder_api_chamadas`; erro → `api_error`) e `medirRequest` (SSR amostrado).
- Hooks: `_authenticated.tsx` (feature_opened + heartbeat), cadastro/login (signup/login, Google via marcação), Sidebar/configuracoes (logout), onboarding (started/completed/business_created/create_product), produtos, metas, e `feature_completed` em aimer, clientes, financeiro, lançamento, planejamento, plano de conteúdo, projeção, raio-x, meta concluída.
- `gemini.server.ts` mede latência/falha de toda chamada de IA (`ia_call`/`ia_failure`); `calendarGoogle.functions.ts` registra `integration_failure` quando o refresh token é recusado.
- `stripe-webhook`: `subscription_started` (status vira ativo), `subscription_cancelled`, `payment_failed` e `webhook_failure`.
- Política de privacidade: item novo sobre registro de uso do serviço por quem tem conta (sem consentimento de cookie, base contratual). ADR-001 em `docs/adr/`.
- Decisão registrada: eventos de usuária logada gravam sempre; páginas públicas seguem no `track()` antigo com consentimento.

Depois do deploy, nenhuma linha chegava em `founder_api_chamadas` em produção (no dev local chegava). Causa: o preset cloudflare-module do Nitro chama o `fetch` do `server.ts` só com a Request e guarda o ExecutionContext em `req.waitUntil` / `req.runtime.cloudflare.context`; sem `waitUntil`, o Worker cancela qualquer promessa solta quando a resposta sai. Solução em `src/lib/segundo-plano.server.ts`: resolve o contexto a partir da Request, guarda por AsyncLocalStorage e mantém uma fila global drenada pelo fetch handler. Detalhe do Worker: `Date.now()` só anda em I/O, então latência de SSR mede ~0 ms — o p95 do monitor usa só server functions.

Também corrigida a FK `founder_alertas.resolvido_por` (agora `on delete set null`): sem isso, apagar a conta de uma admin que resolveu um alerta travava o `auth.admin.deleteUser`.

## 2026-09-17 — Founder Dashboard, bloco 3 (analytics de uso, só no polia-admin)

- Migration `20260917185343_founder_analytics_funcoes.sql`: `founder_funil_config` (passos do funil editáveis, seed "Padrão") e funções SECURITY DEFINER `founder_sessoes_calc`, `founder_tempo_por_feature`, `founder_heatmap`, `founder_retencao_coortes` (execute só pro service role).
- No admin: `src/lib/founder-analytics.functions.ts` + 9 páginas em `/founder/analytics/*` (visão geral, usuárias, perfil `$id`, sessões, retenção, comportamento, funcionalidades, jornadas, segmentos). Em vez de view materializada, as sessões são calculadas na hora pela função SQL (volume pré-lançamento é pequeno); materializar quando `founder_eventos` passar de algumas centenas de milhares de linhas.

## 2026-09-17 — Founder Dashboard, bloco 4 (feature flags)

- Migration `20260917190737_founder_flags_schema.sql`: `founder_flags` (pk key+ambiente, estado on/off/beta, rollout_pct, beta_user_ids, atualizado_por), `founder_flags_historico` preenchida por trigger, seed das 5 flags de `feature_flags` em prod e preview com o mesmo estado.
- `src/lib/flags-regra.ts` (regra pura + bucket sha256 de `userId:key`, testada), `src/lib/flags.ts` (client, cache 60 s, ambiente pelo hostname) e `src/lib/flags.server.ts` (Worker, sem cache).
- Leitores migrados: `csat.ts` (padrão false), `aimer.functions.ts`, `planejamentoIa.functions.ts`, `planoConteudo.functions.ts`, `raiox.functions.ts` (padrão true, kill-switch) e o cron `raiox-mensal-cron` (off desliga o lote; rollout/beta filtram por usuária).
- `feature_flags` fica intocada até a Sil confirmar que tudo está lendo da nova (a tela antiga `/flags` do admin ainda escreve nela e não tem mais efeito).

## 2026-09-17 — Founder Dashboard, bloco 5 (produto, só no polia-admin)

- Migration `20260917192140_founder_experimentos_schema.sql`: `founder_experimentos` (flag + evento-métrica; variante = lado da flag).
- Admin: `src/lib/founder-produto.functions.ts` e páginas `/founder/produto/ativacao` (taxa de ativação = onboarding + 1ª ação de valor em 7 dias, tempo até o 1º valor, D1/D7/D30, coortes semanais, quem não ativou), `/produto/funil` (onboarding), `/produto/feedback` (CSAT de `feedback_responses` + chamados), `/produto/experimentos` (resultados com × sem flag) e `/features/experimentos` (configuração).

Próximo: bloco 6, operação/infra/negócio (erros, logs, jobs, integrações, API, banco, storage, IA, releases, receita/assinaturas/conversão/churn).

## 2026-09-17 — Founder Dashboard, bloco 6 (operação, infra, negócio, releases)

- Migration `20260917193353_founder_operacao_funcoes.sql`: funções SECURITY DEFINER `founder_jobs_status(p_horas)` (cron.job + job_run_details), `founder_banco_status()` (pg_database_size, pg_stat_activity, tabelas maiores, top 10 de `extensions.pg_stat_statements`) e `founder_storage_status(p_dias)` (buckets × objetos × bytes), execute só pro service role; tabela `founder_releases` (registro manual, RLS admin).
- Admin: `founder-operacao.functions.ts` (erros de `erros_app`, logs de `founder_eventos_sistema`, jobs, integrações: Stripe webhook, Resend, Google Agenda, IA), `founder-infra.functions.ts` (API p50/p95/p99 e taxa de erro de `founder_api_chamadas`, banco, storage, IA com custo estimado por modelo), `founder-negocio.functions.ts` (receita = faturas pagas no Stripe no período, MRR/ARR por price, assinaturas, conversão conta → assinante e teste → paga, churn sobre o snapshot diário; releases). 13 páginas trocam os últimos `EmConstrucao`.
- Detalhe do banco: `pg_stat_statements` mora no schema `extensions`, então a função qualifica o nome e põe `extensions` no `search_path`.

Com isso os 6 blocos do plano estão no ar. Pendências fora do código: `RESEND_API_KEY` rotacionada e válida; `STRIPE_SECRET_KEY` ainda precisa da chave `sk_live_` certa; cron duplicado já desagendado; dropar `feature_flags` numa migration própria quando a Sil confirmar.

## 2026-10-05 — Tour de boas-vindas e dicas de primeira visita (Pólia One)

- Proposta aprovada pela Sil no chat: 4 balões na primeira chegada ao Painel (Planejamento, Aimer, botão principal do Painel, presença) + uma faixa "Entendi" na primeira visita de 11 telas + "Rever o tour" em Configurações > Ajuda.
- Estado em `profiles.dicas_vistas text[]` (migration `20261005180000_profiles_dicas_vistas.sql`), não no localStorage, pra não voltar em outro aparelho. Se a coluna não existir ou a leitura falhar, nada aparece (fail closed).
- Código: textos e regra pura em `src/lib/dicas.ts` (+ teste), hook `useDicasVistas`, `components/dicas/` (TourBoasVindas com Popover do Radix ancorado em `data-tour`, DicaDaTela, BotaoReverTour) e prop `dica` no `PaginaLogada`, usada só no retorno principal de cada tela (nunca no carregamento nem no portão do Pro).
- Copy das dicas conferida contra o código de cada tela; 7 textos da proposta foram ajustados porque prometiam o que a tela não faz (Projeção sem "vender o dobro", Raio-x só lê totais, Clientes guarda um pedido por cliente, Painel só acompanha a Meta do mês, Plano de conteúdo gera o ano de uma vez, Calendário não mostra posts, Planner é por projeto).

## 2026-10-05 — Varredura de design system na área logada + Aimer fora do produto

- Botões das 25 telas no padrão de `lib/botoes.ts` (BTN_ACAO/CONTORNO/MIUDO/PRIMARIO); pílula clicável virou forma canônica; alvos de toque de 44px; `role="alert"` nos erros; erro cru do banco virou frase da Pólia (técnico no console).
- Decisões da Sil aplicadas: sidebar escondida no onboarding; foco dos campos sem a sombra turquesa-clara (reprovava 3:1), borda `--secondary-text` + contorno global; hover removido de elemento não clicável (cards do Financeiro, linha de cliente, chips de canal, "→ Abre agora"); Fraunces itálico de parágrafo virou Inter; rótulo em caixa alta = DM Sans 700 (`font-accent font-bold`); "pró-labore" virou "salário" com texto de apoio na Projeção, que agora avisa sucesso/erro ao salvar.
- Aimer sai de todo texto visível do produto (revoga exceção de 28/09): IA fala como Pólia One, menu "Assistente", prompts de sistema sem o nome. Registrado no CLAUDE.md.
- Movimento: balão do tour nasce do item apontado (zoom 95%→100%, 200ms); botões com `transition-colors` voltaram a animar o aperto.

## 2026-10-05 — Bugs do Planejamento + Pólia One em todo o produto

- Perda de dados: o rascunho de IA era salvo com o valor antigo (vazio), porque o array novo era montado dentro do updater do setState e o save rodava antes do render. Agora `definirValor` monta fora; upserts de resposta e de seção conferem o erro e mostram toast em vez de "Salvo" falso; a página do módulo usa `key` pelo número (estado não vaza do módulo 1 pro 2).
- Pulo pro Painel: o `router.invalidate` de cada renovação de login reexecutava o beforeLoad do onboarding, que redireciona quando `onboarding_completed` (vira true no passo 4). Agora só redireciona com `cause !== "stay"`.
- Clique em módulo concluído sem respostas abre o módulo (antes não fazia nada).
- IA do Planejamento complementa o texto da usuária (vai no prompt); com campo vazio o botão some e aparece a dica. Servidor recusa `sem_texto` antes de gastar cota.
- Presença removida da sidebar, do Painel e do tour (3 balões). Toasts com fundo por tipo. Lembrete diário do módulo em andamento (`LembretePlanejamento`, 1x por dia por aparelho, nunca junto do tour).
- "Pólia" → "Pólia One" nos textos do produto (script com o parser do TS); site público, iscas, remetente de e-mail, cookies e páginas de erro continuam "Pólia".

## 2026-10-05 — Plano de conteúdo pelo banco fixo de ideias (sem IA)

- Decisão da Sil: o Plano de conteúdo deixa de usar IA. `src/lib/bancoIdeias/` tem 8 nichos × 60 ideias (tipos, categorias, voz revisados; teste de qualidade em `bancoIdeias.test.ts`). A usuária escolhe UM nicho (`MAX_NICHOS = 1`) e `montarPlanoConteudoDoBanco` grava o ano em `ia_plano_conteudo` (mesma tabela e mesma tela). Trocar de nicho refaz só de hoje em diante.
- Sem cota, sem exigir Planejamento completo; continua no Pro. O código da geração por IA (`gerarPlanoConteudo`) ficou sem uso, apagar quando a Sil confirmar.
- Revisão das ideias pela Sil: https://claude.ai/artifact/ERUAoBZV2NtHs8juTZ5eZC

## 2026-10-11 — Onboarding guiado pelo Planejamento (ONE-112)

Proposta aprovada pela Sil (página em claude.ai/artifact/BoCZefMeSBPza42Y86t7kb), com as três recomendações: o Painel aponta pro Planejamento antes do Módulo 4, o vídeo de 5 min sai do primeiro acesso e a lista some quando fica pronta.

- `lib/painelAcende.ts` (+ teste): estágio do Painel (Planejamento até o Módulo 4 fechar, números depois), manchete e ação de cada estágio, itens da lista "Pra o Painel acender".
- `components/dicas/BoasVindas.tsx`: modal curto no primeiro acesso ao Painel (ciclo em 3 linhas, um botão), no lugar do convite do tutorial. `ConviteTutorial.tsx` removido, inclusive da boas-vindas do onboarding; helpers do convite saíram de `lib/tutorial.ts`.
- `TourBoasVindas.tsx`: um balão só, sem "Próximo"; o clique no item Planejamento marca o tour e leva pro módulo em andamento. No celular, sem o menu à vista, o balão traz o botão.
- Painel: manchete e ação principal por estágio, lista `ListaPraAcender`, `FaixaPlanejamento` (lembrete em faixa, só depois do Módulo 4, quando a manchete volta a ser de dinheiro). `LembretePlanejamento.tsx` (modal diário em qualquer tela) removido.
- Sidebar: selo "N de M" ao lado de Planejamento via `hooks/useProgressoPlanejamento.ts`.
- Módulo do Planejamento: dicas de uma vez só (primeiro salvamento automático, botão de completar depois das primeiras palavras, Assistente após 30 s parada num campo) e a tela `PrimeiraSecaoFeita` no fim da primeira seção da conta.
- Chaves novas em `profiles.dicas_vistas`: `boas-vindas`, `dica-completar`, `dica-salvou`, `dica-assistente`. Sem migration.
- Não mexido: o fim do onboarding continua mandando pra Calculadora (decisão de 06/10); fica pra Sil decidir se o primeiro passo vira o Planejamento.

## 2026-10-11 — Onboarding termina no Módulo 1 (ONE-116)

- Decisão da Sil: o onboarding não termina mais na Calculadora (decisão de 06/10 revogada). A tela final mostra o Módulo 1 e o ciclo da Pólia One, com um botão só, "Quero começar pelo Módulo 1", que abre `/planejamento/modulo/1`.
- Como essa tela já faz o papel das boas-vindas, o clique marca `boas-vindas` e `tour` em `profiles.dicas_vistas`: o modal e o balão do Painel não repetem o recado. Quem pular o onboarding pelo "Pular" continua vendo os dois no Painel.
- `CALCULADORA_DESC` (texto da Calculadora por tipo de negócio) saiu junto. Evento novo: `onboarding_fim_planejamento`.

## 2026-10-11 — Feedback de teste da Karla: observação no produto e status de negociação (ONE-120, ONE-123)

- Produtos: coluna `produtos.observacao_interna` (texto, até 2000) e campo "Observação interna" no modal, pra código do produto e dados do fornecedor. Só no cadastro, não sai em nada que a cliente vê. Migration `20261011230000_produtos_observacao_interna.sql`.
- Clientes: `lib/statusCliente.ts` (+ teste) com os status em três grupos. Antes do pedido: Primeiro contato, Orçamento enviado, Pensando. Pedido: os quatro de antes. Depois da entrega: Pós-venda. O modal mostra os grupos; o seletor da linha lista na mesma ordem. "Registrar venda" aparece em Entregue e em Pós-venda, e o Painel conta os dois como entregues. Migration `20261011230100_clientes_status_negociacao_pos_venda.sql` troca o check (os valores antigos continuam válidos).
- As duas migrations precisam entrar no banco ANTES do deploy: a tela de Produtos lê a coluna nova.

## 2026-10-11 — Projeção sem produto fora da curva na média (ONE-122)

- Pedido de teste da Karla: um produto muito acima ou abaixo dos outros puxava o custo médio. A Sil liberou seguir sem escolher entre mediana e média aparada; ficou a regra dos quartis (Tukey, 1,5 × a distância entre o 1º e o 3º quartil), que mantém o número como média e só tira o que destoa de verdade.
- `separarForaDaCurva` em `lib/projecao.functions.ts` (+ 6 testes): olha preço e custo direto; o produto que sai, sai das três médias (ticket, custo, taxas), pra sobra não ficar maior do que é. Com menos de 4 produtos ninguém sai; distância zero entre quartis não tira ninguém daquele lado.
- Projeção: abaixo dos campos, o aviso diz quem ficou fora, com o botão "Usar todos na média" (e "Tirar da média" pra voltar). A leitura de produtos passou a trazer o nome. Sem migration.

## 2026-10-11 — Importar extrato, planilha e nota no Financeiro (ONE-124)

Plano aprovado pela Sil no chat, com o XML de nota junto (em vez de Fase 2) e no Premium e Pro (onde o Financeiro já está).

- `lib/importarExtrato/` (regra pura, 37 testes): `ofx.ts` (SGML e XML, id `ofx:<conta>:<FITID>`), `csvExtrato.ts` (acha o separador e a linha de títulos depois do cabeçalho da conta, valor único ou crédito/débito, pula linha de saldo; sem títulos reconhecíveis, pede mapeamento), `nfe.ts` (NF-e 55/65; emitente = CNPJ de Configurações vira entrada "Venda de produto", senão saída "Insumos / estoque"; NFS-e fica de fora), `revisao.ts` (categoria pelo histórico dela e depois por palavras de extrato; PIX recebido sem sugestão; repetido = mesmo dia, valor e sentido, contado por quantidade), `comum.ts` (valor e data no jeito brasileiro, UTF-8 ou Windows-1252).
- Excel (.xlsx) não entra direto: a tela pede pra salvar como CSV. As bibliotecas de xlsx no npm têm falha conhecida ou pesam demais pra isso.
- `components/financeiro/ModalImportar.tsx`: arquivo (vários XML de uma vez), mapeamento quando precisa, revisão com marcar, trocar entrada/saída e categoria por linha, importação em lotes de 500 com tudo-ou-nada, e "Desfazer importação" no fim. Botão "Importar extrato" no cabeçalho do Financeiro.
- Categorias-semente saíram do ModalLancamento pra `lib/categoriasLancamento.ts` (mesma lista, agora compartilhada).
- Migration `20261011233000_lancamentos_importacao.sql`: `id_externo` (índice único por usuária; o insert usa on conflict do nothing, então reimportar o mesmo OFX não duplica) e `importacao_id` (pra desfazer). Precisa entrar no banco antes do deploy.

## 2026-10-12 — Importar produtos de planilha (ONE-121)

- Mesmo desenho da importação do Financeiro (ONE-124, aprovado): arquivo, colunas quando a Pólia não reconhece os títulos, revisão e "Desfazer importação". Sem migration.
- `lib/importarProdutos.ts` (+ 11 testes): acha nome, preço de venda, custo, tipo, onde vende, descrição e observação interna pelo título; coluna de código, SKU ou fornecedor entra junto na observação interna (ONE-120). Linha sem nome ou sem preço fica de fora com o número da linha. Produto com nome que já está no catálogo (ignorando acento, caixa e espaço, mas não número) vem desmarcado.
- `components/produtos/ModalImportarProdutos.tsx`: botão "Importar planilha" em Produtos, planilha modelo pra baixar, tipo trocável por linha. No Grátis marca só o que cabe na cota de 5 e trava o botão se passar; a trigger do banco continua sendo a barreira final. Inserção em lotes, tudo ou nada.
- Escapes `̀-ͯ` e ` ` voltaram a ser escritos como escape em `lib/importarExtrato` (estavam como caractere invisível; mesmo comportamento).

## 2026-10-12 — Nota fiscal automática pela NFE.io (PAY-32)

Decisão da Sil no chat: API da NFE.io (não o app da Stripe, que não cancela nem liga a nota à fatura), CPF/CNPJ e endereço completo obrigatórios no pagamento, e cancelamento automático quando a assinatura é reembolsada.

- `supabase/functions/_shared/documentoFiscal.ts` (CPF/CNPJ com dígito verificador e máscara) e `_shared/notaFiscalRegras.ts` (emite ou não, reembolso total ou parcial, tomador no formato da NFE.io), 22 testes em `src/lib/notaFiscalRegras.test.ts`. `_shared/nfeio.ts` é o cliente da API (emitir, cancelar) e o CEP → código IBGE pelo ViaCEP.
- `stripe-webhook`: `invoice.paid` emite a NFS-e (toda fatura paga, inclusive renovação; externalId = id da fatura), `charge.refunded` cancela a nota quando o reembolso é total. Reembolso parcial não cancela e avisa no Telegram. Erro temporário da NFE.io devolve 500 (o Stripe reentrega); erro definitivo fica gravado na linha e vai pro Telegram.
- Migration `20261012210000_notas_fiscais.sql`: uma linha por fatura, sem user_id (registro fiscal fica fora da exclusão de conta), RLS sem policy. Já aplicada no banco.
- Checkout público: `billing_address_collection: "required"` e `tax_id_collection` obrigatório (testado contra a Stripe, sessão expirada na hora). `/assinar`: campo CPF ou CNPJ + `AddressElement` no modal; `salvarDadosFiscais` grava os dois no customer antes da cobrança (+ 5 testes).
- Falta (Sil): secrets NFEIO_API_KEY / NFEIO_COMPANY_ID / NFEIO_CODIGO_SERVICO, eventos `invoice.paid` e `charge.refunded` no endpoint do webhook na Stripe, deploy da edge function (classificador barra daqui).
- 13/10, depois do 1º teste real: a NFE.io recusou a nota por ID da empresa errado (a Sil corrigiu o secret). A nota foi reemitida, mas saiu sem CPF: na compra pela `/planos`, o `tax_id_collection` da Stripe não pediu documento pra pessoa física. Troquei por um campo próprio do Checkout (`custom_fields`, chave `cpfcnpj`, numérico, 11 a 14 dígitos, obrigatório). O webhook lê o campo pela sessão da assinatura (`documentoDoCheckout`) e grava em `metadata.cpf_cnpj` do customer, pra renovação. +3 testes.

## 2026-10-14 — Onboarding sai, Painel abre com "Primeiros passos"

Desenho em cinza aprovado pela Sil em 14/10. Commit local, sem push.

- O onboarding de 5 passos deixou de ser obrigatório: o guard de `_authenticated.tsx` não manda mais pro `/onboarding`, e cadastro (emailRedirectTo), verificação, criar-senha e `resolvePostLoginPath` levam pro `/painel`. O `/onboarding` virou redirect pro Painel, só no client (o link de confirmação traz a sessão no hash). `/assinar` perdeu a trava de onboarding.
- `lib/primeirosPassos.ts` (+ testes): quem vê o bloco (conta criada a partir de 15/10/2026 00:00 BRT, ou que ainda estava com `onboarding_completed = false`; o rastro disso é `onboarding_completed_at` depois do corte), o que está feito (produto com `calculadora_breakdown`, Módulo 1 fechado pela régua do `painelAcende`, `business_name` preenchido), destaque, textos por nicho e tipo.
- `hooks/usePrimeirosPassos.ts`: lê perfil e produtos; na primeira carga marca `onboarding_completed`/`onboarding_completed_at` (update condicional) e registra `onboarding_completed` no Founder Dashboard; `business_created` quando o nome da marca é salvo no bloco. O e-mail de boas-vindas saiu do load do `/onboarding` pra cá, uma vez por aba e só pra conta na regra do bloco.
- `components/painel/PrimeirosPassos.tsx` (+ teste): 3 passos, destaque por fundo, check nos feitos, pergunta Produto/Serviço/Os dois sem nicho (grava `business_type`), campo de nome inline. No Painel, enquanto o bloco está na tela: manchete própria, sem o botão da ação principal, sem BoasVindas, Tour e "Pra o Painel acender" (e as duas dicas ficam marcadas como vistas, como o fim do onboarding fazia).
- `nichosLanding.ts`: campos `pessoa` e `tipo` por nicho. Calculadora: `?tipo=produto|servico` abre a aba (`?produto` continua com prioridade); Encomenda trancada mostra a etiqueta "Pro" antes do clique. Menu lateral mostra "Sua marca" sem nome.
- Sem migration. Deploy precisa sair depois de 15/10 00:00 BRT (ver comentário de `CORTE_PRIMEIROS_PASSOS`).

## 2026-10-23 — Vendas e Estoque, Fase 1 (VND-03): base de dados e regras

Plano em `docs/plano-modulo-vendas-canais.md`. Wireframes em cinza mostrados à Sil no chat (Vendas, Registrar venda, aba Estoque em Produtos, Mais vendidos, card do Painel), esperando aprovação antes de codar as telas.

- Migration `20261023120000_vendas_estoque_fase1.sql`, **não aplicada**: `produtos.controla_estoque` (nasce false), `produto_skus` (variação; null = padrão), `estoque_movimentos` (livro com sinal, sem update/delete; saldo pela view `estoque_saldos`, security_invoker), `vendas` (canal + id_externo já prontos pra Shopee/TikTok), `venda_itens` (nome e custo guardados no dia). RPCs invoker: `registrar_venda` (venda + itens + baixa + lançamento numa transação; estoque pode ficar negativo; lançamento só se recebida, pelo total menos a taxa, `id_externo = venda:<id>`), `receber_venda`, `cancelar_venda` (devolve ao estoque e apaga o lançamento da venda).
- `lib/vendas.ts` (+ 23 testes): total, valor recebido, lucro da venda (null se item sem custo; frete fora), validação igual à RPC, ranking de mais vendidos com desconto e taxa rateados pelo valor do item, frase quando quem mais sai não é quem mais lucra, estoque baixo.
- Decisões tomadas por mim, a confirmar: entrada no Financeiro é o valor líquido (total - taxa do canal); custo do item é `produtos.preco_custo` (o mesmo do card, com rateio dos fixos); a dona pode editar a própria venda pela API (sem trava por coluna), sem risco entre contas.
- Falta: telas, cards do Painel, ligar o "Registrar venda" de Clientes à RPC nova, gating (`/vendas` como Premium até a Sil decidir VND-01), aplicar a migration.

## 2026-10-23 — Vendas e Estoque, Fase 1 (VND-03): telas

Wireframes e as 3 decisões de número aprovados pela Sil no chat (VND-12). Nada commitado.

- **Migration aplicada pelo MCP com autorização da Sil (23/10)**, testada numa transação desfeita (14 cenários, nada gravado), feature `vendas` cadastrada em `founder_features`. Antes ela tinha sido barrada pelo classificador; a regra era: rodar `20261023120000_vendas_estoque_fase1.sql` no SQL Editor **antes** de qualquer deploy: `produtos.tsx` passou a ler `controla_estoque` e quebra sem a coluna. `registrar_venda` ganhou `p_marcar_cliente` (Clientes marca a venda na mesma transação).
- `/vendas` (Premium, `planos.ts`): abas Pedidos e Mais vendidos, período (este mês, mês passado, 90 dias), filtro de canal, busca, resumo (vendas, entrou, a marca lucrou, estoque baixo). `ModalRegistrarVenda` (itens com variação e saldo, desconto, frete, taxa, "Já recebi o dinheiro", prévia do lucro e do estoque, aviso de estoque negativo), `ModalVenda` (receber, cancelar), `MaisVendidos` (ordena por unidades, entrou ou lucrou; frase quando o campeão de venda não é o de lucro).
- Produtos: abas Catálogo e Estoque (`?aba=estoque`). `AbaEstoque` (saldo, mínimo, só baixos, "Entrada ou ajuste" com chegou mercadoria, perdi ou quebrou, contei e corrigi; histórico por variação). Modal do produto ganhou a seção Estoque (`EstoqueDoProduto` + `useEstoqueDoProduto`): liga o controle, variações com código, quantidade inicial e mínimo. Card do produto mostra o saldo.
- Painel: `CartaoVendasPainel` (some sem venda e sem estoque). Menu: "Vendas" depois de Produtos. `server.ts`, `founder-features.ts` e `ganhoDoUpgrade.ts` com `/vendas`. Falta o seed da feature `vendas` na tabela `founder_features`.
- Clientes: cliente com produto registra pelo `ModalRegistrarVenda` (baixa estoque, lucro certo); sem produto continua o `registrar_venda_cliente`.
- `types.ts` editado à mão com as tabelas, a view e as RPCs novas (regenerar depois de aplicar a migration). Testes: 1.699 passando; tsc e build ok.
- **Depois das revisões (segurança, arquitetura, usabilidade, anti-IA), mesma data.** Migration reescrita antes de aplicar: escrita só por funções SECURITY DEFINER com `auth.uid()` em cada leitura (`salvar_estoque_produto` numa transação, `movimentar_estoque` com a variação travada e a contagem calculada no banco, `registrar_venda` com `p_id` gerado no modal pra não duplicar em reenvio, trava da cliente, erro quando o produto tem estoque ligado e nenhuma variação, `cancelar_venda` desmarca a cliente). API só lê as tabelas novas (mais `vendas.observacao`); `estoque_movimentos.sku_id` virou `on delete restrict`. Categoria do lançamento gravada na venda. Arredondamento igual no banco e em `lib/vendas.ts`; "Entrou" agora é líquido da taxa, como no Financeiro. Usabilidade: "Cancelar venda" separado do "Fechar" e confirmação com "Manter venda", tabelas viram cartão no celular, rótulos "Em estoque", "Perda ou quebra", "Contagem", "Estoque mínimo", aba "Todas as vendas", estoque desligado ou com erro dito com clareza, erros de item no próprio campo.
- Meu `eslint --fix src` reformatou 5 arquivos fora do módulo; voltei os 5 com `git checkout`. `PaginaMarcaB.tsx` e `termos.tsx` têm mudança de outra sessão e ficaram como estavam.

## 2026-10-23 — Contas a pagar (ONE-127)

Primeiro item da lista que saiu do benchmark da Bling (`../bling-raio-x-2026-10-23.md`, cards ONE-127 a ONE-136). A Sil liberou seguir sem wireframe, seguindo o design system, e autorizou commit e push.

- Migration `20261023180000_contas_a_pagar.sql`, **aplicada pelo MCP** e testada numa transação de teste (pagar mensal de 31/01 cria a de 28/02 com o dia 31 guardado; desfazer apaga o lançamento e a próxima; nada ficou gravado). Tabela nova `contas_pagar` em vez de status em `lancamentos`: lançamento continua sendo dinheiro que já se mexeu, e tudo que soma `lancamentos` segue igual. API cria, edita (só a pagar) e exclui; `status`, `pago_em`, `lancamento_id` e `proxima_id` só mudam pelas RPCs `pagar_conta` (saída no Financeiro com `id_externo = conta:<id>` e, se mensal, a conta do mês seguinte) e `desfazer_pagamento`.
- `lib/contasPagar.ts` (+ 10 testes): situação (atrasada, hoje, próximos 7 dias, depois), rótulo do vencimento, próximo vencimento igual ao do banco, resumo, ordenação, validação.
- Financeiro: seção "Contas a pagar" entre as ações rápidas e o histórico (`SecaoContasPagar`, `ModalContaPagar`, `contasPagarDados.ts`). "Paguei" lança com a data de hoje e o toast traz "Desfazer"; as pagas dos últimos 30 dias ficam num recolhido com "Desfazer pagamento".
- Painel: `CartaoContasPainel` pra quem tem o Financeiro, some sem conta atrasada nem vencendo em 7 dias.
- `types.ts` editado à mão. tsc, eslint e 1.715 testes passando.
- **Depois das revisões (segurança, arquitetura, usabilidade, anti-IA), mesma data.** Segurança sem furo. Corrigido: `desfazer_pagamento` recusa quando a conta do mês seguinte já foi paga (antes, desfazer e pagar de novo criava um segundo vencimento no mesmo mês; aplicado pelo MCP e testado); editar conta que foi paga em outra aba agora avisa em vez de dizer "salvo"; conta atrasada pergunta "Paguei em" (e todo item tem "Paguei em outra data"), pra saída não cair no mês errado; categorias do modal vêm do histórico dela, com "+ nova categoria"; o que falta pra salvar aparece sempre, ligado ao botão; "Ver contas" do Painel rola até a seção e põe o foco no título; resumo e cartão do Painel com o valor de cada grupo e rótulo que diz se soma atrasadas; toast "Conta paga: X. Entrou como saída no histórico." com a data da próxima; "todo mês" escrito na linha; "Desfazer" visível nas pagas, com retorno; nome da conta no excluir e nos rótulos de leitor de tela; "vence dia 05/11" (com ano quando muda). `proximoVencimento` passou a ser usado no aviso, então a cópia TS da regra do banco não é mais só de teste.
- Fica pra decisão da Sil: excluir no Histórico a saída criada por uma conta deixa a conta como paga (mesmo comportamento das vendas).

## 2026-10-23 — Taxas de recebimento (ONE-128)

Segundo item da lista do benchmark da Bling. Nada commitado.

- Decisão: na venda manual quem cobra é a forma de recebimento (Pix, dinheiro, débito, crédito à vista, crédito parcelado, link), não o Instagram. Shopee e TikTok Shop já cabem na tabela pra integração (VND-05) e lucro por canal (VND-07), mas não aparecem na tela ainda. Sem taxa padrão de mercado: número inventado viraria lucro errado.
- Migration `20261023190000_taxas_recebimento.sql`, **aplicada pelo MCP**: `taxas_recebimento` (chave, percentual com 2 casas, fixo por venda), RLS de dona nas 4 operações, chave restrita por check.
- `lib/taxas.ts` (+ 13 testes): `taxaDaVenda` em centavos inteiros com meio centavo pra cima (igual ao `round` do Postgres; em float, R$ 50 a 3,19% + R$ 0,50 dava 2,09), limitada ao total; `decidirTaxa` (o campo só reescreve taxa que a própria Pólia preencheu; a digitada fica); validação de até 2 casas; `lerNumero` aceita "3," no meio da digitação.
- `ModalTaxas` (botão "Taxas de recebimento" em Vendas e link dentro do Registrar venda). Registrar venda ganhou "Forma de recebimento", dica sob a taxa (carregando, erro de leitura, sem taxa cadastrada, "Usar a taxa de X" quando ela digitou outra), rótulo "Taxa da maquininha ou do link". Detalhe da venda diz só "Taxa".
- `PaginaLogada`: a caixa da ação ganhou `max-w-full` pra dois botões quebrarem linha no celular.
- Revisões (segurança, arquitetura, usabilidade, anti-IA) feitas e corrigidas na mesma data. A forma de recebimento não é gravada na venda (só a taxa); se o lucro por forma for preciso, entra uma coluna em `vendas` pela RPC.

## 2026-10-23 — Orçamento com a cara da marca que vira venda (ONE-129)

Terceiro item da lista do benchmark da Bling. Decisões da Sil: link público com aprovação da cliente; identidade = logo + uma cor. Sem wireframe, por pedido dela. Nada commitado.

- Migrations **aplicadas pelo MCP** e testadas em transação desfeita: `20261023200000_orcamentos_e_identidade.sql` (`profiles.logo_path`/`cor_marca` com grant por coluna; bucket público `marca-logos`, só PNG/JPG/WEBP até 1 MB, escrita só na pasta da própria usuária; tabela `orcamentos` com `link_token` uuid, itens como retrato do dia, totais e número calculados no gatilho) e `20261023210000_orcamentos_travas.sql` (depois da revisão de segurança: máquina de estados no gatilho, só o service role aprova, só `converter_orcamento` marca convertido, respondido não muda; `converter_orcamento` grava venda e status numa transação, com id de venda próprio; venda cancelada reabre o orçamento; trava por conta no número; `variacao` e tamanho do jsonb validados; `logo_path` só no formato do app).
- Página pública `/o/$token`: loader no servidor (prévia do link no WhatsApp com o nome da marca, não a da Pólia), `noindex`, aprovação com Turnstile, honeypot que devolve erro (não sucesso falso), aprovação presa à versão lida (`updated_at`), estados aprovado, virou pedido, vencido, cancelado, link inexistente e falha de rede com "Tentar de novo". Cor da marca: `usoDaCor` pinta o fundo quando dá contraste AA e vira faixa quando não dá. Sem nome de marca, nunca mostra o nome pessoal da dona.
- `lib/orcamentos.functions.ts`: leitura e aprovação por service role, resposta só com o que a página mostra; e-mail pra dona quando a cliente aprova (best-effort, casca `emailPolia`).
- Do lado da dona: "Logo e cor" na página Marca (prévia igual à da cliente, aviso quando a cor vira faixa, "Tirar a cor"); "Fazer orçamento" no menu da cliente (cliente em negociação passa pra "Orçamento enviado"); aba "Orçamentos" em Vendas, com contagem de aprovados no rótulo, "Virar venda" à vista só no aprovado, "Duplicar e ajustar", cancelar e excluir. Registrar venda aceita vários itens prontos e grava pelo `converter_orcamento` quando vem de orçamento.
- `lib/orcamentos.ts` (+ 11 testes). Pendências registradas: limite de taxa na leitura pública (regra no Cloudflare) e "gerar link novo".

## 2026-10-23 — Clientes e leads, Fase 2 (VND-04): base e regras

Wireframes em cinza mostrados à Sil no chat (lista com filtros e números de leads, ficha da cliente com histórico de compras, cadastro com WhatsApp, origem e autorização, modal do link de captura, página pública /l/<slug> e confirmação). Telas esperam aprovação.

- Migration `20261023230000_clientes_leads_fase2.sql`, **não aplicada**: em `clientes`, `origem`, `whatsapp` (dígitos com 55, único por conta), `whatsapp_consentimento_em` + `consentimento_origem` (prova do aceite), `interesse`, `novo`. Tabela `links_captura` (um link por conta, slug único). Função `capturar_lead` só pro service role: link desligado ou conta sem plano pago devolve "indisponivel", teto de 200 por dia, mesmo WhatsApp atualiza a ficha em vez de duplicar, aceite nunca é apagado.
- `lib/leads.ts` (+ 13 testes): normalizar e formatar WhatsApp, sugerir e validar slug, lead = antes do pedido ou sem status, filtro por grupo, resumo do topo (novos no mês, pelo link, viraram cliente, não vistos, origem mais comum e a que mais compra).
- Outra sessão está mexendo em Vendas e já mexeu em `clientes.tsx` (orçamento, ONE-129). As telas da Fase 2 mudam `clientes.tsx`: combinar antes pra não colidir.
- **Telas e banco (mesma data).** Wireframes aprovados pela Sil (ficha em painel lateral, link no Premium). Clientes ganhou os 3 números do mês, filtros (Todas, Leads, Com pedido, Depois da entrega, origem), etiqueta "novo", WhatsApp e origem na linha, botão "Link de captura". `FichaCliente` (Sheet): pedidos, quanto comprou, última compra, WhatsApp com "Abrir conversa", aceite, interesse, Registrar venda, Criar orçamento, Editar. Cadastro com WhatsApp, Outro contato, De onde veio e a caixinha de autorização. `ModalLinkCaptura` (endereço, título, pergunta, liga/desliga, copiar; sem nome de marca não abre). Página pública `/l/$slug` com logo e cor da marca, Turnstile, honeypot e rodapé da Pólia; server functions em `lib/captura.functions.ts` (hash do IP com o dia, plano pela `rotaLiberada`).
- **Revisão de segurança mudou o banco antes de aplicar:** aceite virou livro (`consentimentos_whatsapp`, só acréscimo); gatilho `clientes_trava_leads` barra escrita direta no espelho do aceite, `origem='link'` e `novo=true`, e trocar o número derruba o aceite com evento `numero_trocado`; `registrar_consentimento` pra dona (aceite e revogação viram linha); `leads_envios` conta todo envio (200/dia por link, 5/hora por aparelho) e reenvio do mesmo número não sobrescreve a ficha; `links_captura_slugs` nunca libera um endereço pra outra conta, e há uma lista de endereços reservados. Migration `20261023230000` aplicada com autorização da Sil e testada numa transação desfeita (13 cenários, nada gravado).
- Pendências: o aceite pelo link é declarado (número não verificado), confirmar na 1ª mensagem da fase 4; sem cache na leitura pública do link. `sheet.tsx` (compartilhado) tem o X de fechar pequeno, não mexi.

## 2026-10-23 — Preço e lucro por canal, Fase 5 (VND-07): base e regras

Com o TikTok Shop e o WhatsApp oficial esperando os acessos da Sil (VND-02) e o Plug4Market descartado (VND-11, conexão direta), a próxima fase sem dependência é a 5. Wireframe em cinza mostrado no chat: bloco "Quanto esse preço deixa em cada canal" na Calculadora (taxa, lucra, preço pra lucrar o mesmo, frase do canal que mais pesa) e tabela "Por canal" no topo da aba Mais vendidos de Vendas. Telas esperam aprovação.

- `lib/precoPorCanal.ts` (+ 9 testes), usando as taxas do ONE-128 (`lib/taxas.ts`): lucro no canal, menor preço que devolve o mesmo lucro (ajuste de centavo pelo arredondamento da taxa), linhas por taxa cadastrada, canal que mais derruba o lucro, resumo de vendas por canal. Sem migration.
- A outra sessão está editando `ModalRegistrarVenda.tsx` e `vendas/dados.ts`: a Fase 5 não mexe neles.
- **Telas (mesma data).** Wireframe aprovado pela Sil (VND-20). `LucroPorCanal` na Calculadora, logo abaixo do preço sugerido: "Quanto esse preço deixa em cada forma de receber" (taxa, lucra, pra lucrar o mesmo, frase da forma que mais pesa, cadastrar/editar taxas pelo mesmo `ModalTaxas` de Vendas; no Grátis, uma linha com o Premium). `PorCanal` no topo de Vendas > Mais vendidos (vendas, vendeu, taxa paga, lucrou, nota do que entra no lucro). Revisão corrigiu: o lucro de base é recalculado no preço arredondado com a taxa da conta (antes 1 centavo de diferença em 1 de cada 4 contas e frase errada), comparação em centavos inteiros, sem lucro na conta some a coluna "pra lucrar o mesmo", canal só com vendas sem custo mostra "sem custo" em vez de R$ 0,00. 11 testes.

## 2026-10-24 — TikTok Shop direto, etapa 3a.1 (VND-05)

Plano aprovado pela Sil em 24/10 (`docs/plano-fase3a-tiktok-shop.md`, card VND-22): só no Pro; item sem vínculo entra sem baixar estoque e avisa. Esta etapa: banco da conexão, tokens no Supabase Vault, regras puras do TikTok com testes, cliente da API, conectar e desconectar, card em Configurações > Integrações e a rota de volta da autorização (`/configuracoes/integracoes/tiktok`, a mesma cadastrada no app do Partner Center e no secret `TIKTOK_SHOP_REDIRECT_URI`).

- Diferente do Google Agenda: o token não fica em coluna aberta. Fica no Vault, lido e gravado só por RPC de service role (promessa da política de segurança v1.0 e do questionário do TikTok).
- Desconectar apaga a conexão, os segredos do Vault (gatilho) e os vínculos de anúncio na hora.

## 2026-10-24 — TikTok Shop direto, etapa 3a.2 (VND-05)

A 3a.1 conectou a loja de teste de ponta a ponta. Esta etapa: a Pólia lista os anúncios da loja (Search Products 202502 + detalhe quando falta a variação), sugere o par com as variações da Pólia (`sugerirVinculos`, pelo código e depois pelo nome) e a usuária aprova numa tela própria (`/configuracoes/integracoes/tiktok/anuncios`, wireframe 6.3 aprovado). Cada linha pode: ligar a uma variação existente, ligar a um produto sem estoque ligado (liga o estoque com uma variação padrão), criar produto novo na Pólia (nome, preço e quantidade do TikTok) ou não ligar.

- Token renovado sozinho quando falta menos de 5 minutos para vencer (`tiktokShopAcesso.server.ts`); se o TikTok recusar, a conexão vira "erro" e o card pede para conectar de novo.
- Criar produto e ligar estoque usam o cliente com a sessão dela (`context.supabase`), pelas mesmas RPCs da tela de Produtos: valem as travas e o RLS de sempre.

## 2026-10-24 — TikTok Shop direto, etapa 3a.3 (VND-05)

A 3a.2 foi conferida na loja de teste (VND-25). Esta etapa: pedido pago no TikTok vira venda "a receber" na Pólia, sozinho.

- Migration `20261024140000_tiktok_pedidos_vendas.sql`: fila `canal_eventos` (um pedido por linha, só service role), `registrar_venda_canal` (dona por parâmetro, idempotente pelo pedido, item ligado baixa estoque e leva custo, item sem vínculo entra sem produto e sem mexer no estoque), `cancelar_venda_canal` (devolve o estoque e tira do Financeiro), segredo do cron no Vault e `disparar_tiktok_sync()` agendado a cada minuto, que só chama a edge function quando há evento pendente ou loja há 15 minutos sem varredura. Testada numa transação desfeita.
- Edge function `tiktok-webhook`: confere a assinatura (HMAC de app_key + corpo cru) e enfileira o pedido; responde na hora (o TikTok exige 3 s).
- Edge function `tiktok-sync`: varredura de 15 min (Search Orders desde o último sync, menos 5 min de folga), processa a fila (Get Order Detail em lotes de 50), renova o token quando falta pouco, desiste depois de 5 tentativas guardando o erro. Só para conta Pro.
- Taxa estimada pela regra do TikTok Shop em `taxas_recebimento` (`taxaEstimada`, mesma conta de `taxaDaVenda`, teste confere as duas).
- Cliente HTTP do TikTok foi para `_shared/tiktokShopCliente.ts` (credenciais por parâmetro), usado pelo Worker e pelo Deno.
- Edge functions precisam dos segredos `TIKTOK_SHOP_APP_KEY` e `TIKTOK_SHOP_APP_SECRET` no Supabase; o webhook precisa ser cadastrado no app do Partner Center.

## 2026-10-24 — TikTok Shop direto, etapa 3a.4 (VND-05)

A 3a.3 foi conferida com pedidos de teste (webhook → venda em menos de 1 min). Esta etapa: com "A Pólia cuida do estoque" ligado no card, o saldo da Pólia atualiza o TikTok.

- Migration `20261024180000_tiktok_estoque_fila.sql`: `canal_fila_estoque` (uma linha por variação e canal, só service role), `enfileirar_estoque_canal()` (só variação ligada, de loja conectada com cuida_estoque), gatilhos em `estoque_movimentos` (todo movimento: venda, entrada, perda, contagem, cancelamento) e em `anuncio_vinculos` (ligou depois), e `disparar_tiktok_sync()` olhando também a fila de estoque. Testada numa transação desfeita.
- `tiktok-sync` manda o SALDO (não a diferença) por produto, no depósito que o Get Product mostra, depois de processar os pedidos; negativo vai como zero; 5 tentativas.
- Card: liga/desliga "A Pólia cuida do estoque" (`alternarCuidaEstoqueTiktok`); ao ligar, enfileira todas as variações ligadas para o TikTok começar igual à Pólia.

## 2026-10-24 — TikTok Shop direto, etapa 3a.5 (VND-26)

Revisão de segurança da Fase 3a (agente só de leitura, conferiu as permissões no banco de produção): nenhum achado alto, um médio, o resto baixo. Corrigido:

- **Médio, autorização sem state:** um link com o `code` de outra pessoa trocava a loja da conexão em erro ou pendente antes da confirmação, e o "Cancelar" chamava o desconectar (apagava os anúncios ligados). Agora a volta sem state nunca troca a loja que já está na conta, em nenhum status; a mesma loja já confirmada volta sem perguntar; "Cancelar" usa `cancelarConfirmacaoTiktok`, que só descarta a loja esperando confirmação; começar pela Pólia descarta a loja não confirmada.
- Ligar a "produto sem estoque" recusa produto que já tem variação ativa (a RPC arquivaria todas).
- Pixels da Meta e do TikTok não mandam PageView em URL com `?code=` (volta do TikTok e do Google Agenda).
- Migration `20261024200000_tiktok_revisao_seguranca.sql`, testada numa transação desfeita: FK composta `anuncio_vinculos (sku_id, user_id)` → `produto_skus (id, user_id)`; `varredura_tentada_em` (sem Pro ou com erro do TikTok, o cron não chama o sync todo minuto, e o "desde" da varredura continua no último sync certo); trava `pegar_trava_sync`/`soltar_trava_sync` (arrendamento de 2 min, duas rodadas não renovam o mesmo token); cron diário `limpar-canal-eventos` (7 dias, o que o plano e o questionário prometem); `search_path = public, pg_temp` nas funções security definer da 3a.
- Aceitos, sem ação: webhook sem checar timestamp (replay só recoloca o pedido na fila, idempotente); `app_secret` na query do token (é a especificação do TikTok, não é logado); teto de 1.000 itens em `salvarVinculosTiktok` (só afeta a própria conta); conexão de quem perde o Pro continua guardada.
- ADR `docs/adr/0002-marketplaces-conexao-direta.md` e rascunho do anúncio na loja de apps `docs/tiktok-shop-anuncio-app-store.md` (decisões da Sil antes de preencher).

## 2026-10-24 — Taxa do TikTok Shop pela tabela oficial (VND-05)

A Pólia guardava uma regra só por canal (percentual + fixo por venda), mas o TikTok cobra por item e por faixa de preço desde 15/07/2026: abaixo de R$ 50, 10% + R$ 4 por item; de R$ 50 pra cima, 6% + R$ 6; quem participa do Frete Grátis paga mais 6% do item, até R$ 50. Decisão da Sil: tabela oficial para todo mundo, Frete Grátis como opção.

- `_shared/taxaTiktokShop.ts` (puro, Worker e Deno, + 7 testes): `taxaTiktokDoItem`, `taxaTiktokDaVenda` (soma por unidade, cada uma na faixa do próprio preço, nunca acima do preço), `descreverTabelaTiktok`.
- Migration `20261024233000_taxa_tiktok_frete_gratis.sql`: `taxas_recebimento.frete_gratis`. Na linha `tiktok_shop`, percentual e fixo deixam de valer.
- `tiktok-sync` calcula a taxa do pedido pela tabela, com o Frete Grátis da conta.
- Modal de taxas: bloco "TikTok Shop" com a tabela e a caixa "Participo do Programa de Frete Grátis do TikTok".
- Lucro por canal: a linha do TikTok usa a tabela (busca binária para o menor preço que lucra o mesmo, porque a taxa muda de faixa) e mostra as faixas no lugar do percentual.

## 2026-10-24 — Mercado Livre direto, etapa 3c.1 (VND-30)

Plano `docs/plano-fase3c-mercado-livre.md`, aprovado pela Sil em 24/10 (Mercado Livre antes da Shopee, só Pro, frete em coluna própria, Full só leitura). Esta etapa: base de banco, regras e conectar/desconectar.

- Migration `20261024220000_mercado_livre_canal.sql`, testada numa transação desfeita (venda do TikTok igual, venda do ML com tarifa 3,60 e frete 24,90, pedido repetido não duplica, verificador curto recusado, uma assinatura só da RPC). **Aplicada pelo MCP com autorização da Sil** (o classificador tinha barrado a primeira tentativa) e conferida: 6 checks com `mercado_livre`, as 2 colunas novas, uma assinatura só da RPC, só o service role executa. Conteúdo: `mercado_livre` nos checks de canal (`vendas`, `taxas_recebimento`, `canal_conexoes`, `anuncio_vinculos`, `canal_eventos`, `canal_fila_estoque`), `canal_conexoes.verificador_pendente` (PKCE), `vendas.custo_envio` e `registrar_venda_canal` com `p_custo_envio` (a assinatura antiga sai; o tiktok-sync chama por nome e fica com 0).
- `_shared/canais.ts`: saíram do `tiktokShop.ts` `sugerirVinculos`, os tipos de anúncio, SKU, item e status, e `diaEmBrasilia`. O `tiktokShop.ts` reexporta, então nenhum import mudou; os 54 testes do TikTok continuam verdes.
- `_shared/mercadoLivre.ts` (regras puras, 16 testes em `src/lib/mercadoLivre.test.ts`): PKCE S256 (confere com o exemplo da RFC 7636), URL de autorização, tokens da resposta (6 h; sem refresh_token não conecta), status do pedido (paid e partially_refunded viram venda, cancelled e fraud_risk_detected cancelam), itens com chave `item:variação`, tarifa real (`sale_fee` × quantidade), dia em Brasília, aviso `orders_v2` só do próprio app, anúncio no Full.
- `_shared/mercadoLivreCliente.ts`: troca do code com o verificador, renovação, GET autenticado com token no cabeçalho, `/users/me`.
- `src/lib/mercadoLivreApi.ts` (lê `MERCADO_LIVRE_CLIENT_ID/_CLIENT_SECRET/_REDIRECT_URI`) e `mercadoLivre.functions.ts` (14 testes): status, iniciar (state + verificador), finalizar (state obrigatório, zerado antes da troca; conta do ML em outra conta da Pólia recusada; trocar de conta do ML apaga as ligações antigas; sem apelido conecta com nome padrão e registra a falha), desconectar.
- Rota de volta `configuracoes_.integracoes.mercado-livre.tsx` e `components/configuracoes/CardMercadoLivre.tsx` (card 6.1/6.2 sem "Ligar anúncios" e sem "cuida do estoque", que entram na 3c.2 e 3c.4).
- `mercado_livre` em `taxas.ts`, `vendas.ts` (rótulo "Mercado Livre", fora dos canais manuais) e na ordem da calculadora por canal.
- **Fica para a 3c.3:** ler `custo_envio` em Vendas e tirar do lucro (ler a coluna antes da migration quebraria a tela); `disparar_tiktok_sync` hoje dispara com evento pendente de qualquer canal.
- Suíte inteira: 1.923 testes verdes, tipos e build ok.

## 2026-10-24 — Mercado Livre direto, etapa 3c.2 (VND-30)

A 3c.1 subiu (commit 89b63e3). Esta etapa: a tela "Ligar anúncios" do Mercado Livre.

- `canalVinculos.server.ts`: a prévia (variações da Pólia, ligações atuais, sugestões) e a gravação das ligações saíram de `tiktokShopAnuncios.functions.ts` para um módulo comum, com o canal e o nome do canal por parâmetro. O TikTok só busca os próprios anúncios e chama o comum; os testes dele continuam verdes sem mudança.
- `components/configuracoes/LigarAnunciosCanal.tsx`: a tela de "Ligar anúncios" virou componente; a rota do TikTok e a nova do Mercado Livre (`configuracoes_.integracoes.mercado-livre_.anuncios.tsx`) só passam nome e funções. Anúncio no Full aparece com "no Full" e a etiqueta "Full", com um aviso de que a quantidade no galpão é do Mercado Livre.
- `mercadoLivreAcesso.server.ts` (10 testes): token válido sai direto; perto de vencer (menos de 10 min), renova pela trava `ml_token:<conexão>` em `canal_sync_travas` (a mesma do tiktok-sync, sem migration nova); quem não pega a trava espera o token novo; recusa 400/401 marca erro, rede não; par novo tenta gravar 3 vezes. Ajuste no plano §5: o Worker também renova, pela mesma trava.
- `mercadoLivreCliente.ts`: ids dos anúncios ativos (`/users/{id}/items/search`, 100 por página, até 500) e detalhe em multiget de 20 com `include_attributes=all` (SELLER_SKU das variações, conferir com a conta de teste). `pedirTokenMl` devolve `recusado`.
- `anunciosDoItem` (4 testes): uma linha por variação com a chave `anúncio:variação`, código pelo SELLER_SKU ou `seller_custom_field`, preço da variação ou do anúncio, Full marcado.
- `mercadoLivreAnuncios.functions.ts` (7 testes): paginação, lotes de 20, aviso acima de 500, erro do Mercado Livre vira "tenta de novo", gravação com canal e nome certos.
- Card: contagem de anúncios ligados e botão "Ligar anúncios".
- Suíte inteira: 1.954 testes verdes, tipos, lint e build ok.

## 2026-10-24 — Mercado Livre direto, etapa 3c.3 (VND-30)

A 3c.2 subiu (commit d1734ee). Esta etapa: pedido pago no Mercado Livre vira venda na Pólia, com a tarifa real e o frete que a vendedora pagou.

- Migration `20261025100000_mercado_livre_sync.sql`, testada numa transação desfeita (venda de R$ 100 com tarifa 12 e frete 20 lança R$ 68 no Financeiro ao receber; segredo confere; cron criado). **Aplicada pelo MCP com autorização da Sil** e conferida (cron ativo, segredo criado, receber_venda e disparar_tiktok_sync novos). Edge functions publicadas pela CLI. Conteúdo: `disparar_tiktok_sync` só olha a fila do TikTok; `receber_venda` tira também `custo_envio` do lançamento; segredo `ml_sync_secret` no Vault, `conferir_segredo_ml_sync`, `disparar_ml_sync()` e cron `ml-sync` a cada minuto (só chama quando há pedido na fila ou conta há 15 min sem varredura).
- Edge function `ml-webhook`: aviso `orders_v2` do próprio app e de vendedora conectada vira id na fila; o resto recebe 200 e é ignorado (o aviso não é assinado; a venda só nasce do pedido buscado com o token dela).
- Edge function `ml-sync`: varredura de 15 min (`/orders/search` por `order.date_last_updated.from`, até 200 pedidos), fila (`/orders/{id}`), venda com `tarifaDoPedido` e frete de `/shipments/{id}/costs` (parte da vendedora); frete não lido entra como zero com aviso na observação. Pago e devolução parcial viram venda; cancelado e fraude cancelam. Só Pro. `missed_feeds` ficou de fora: a varredura por data já cobre o aviso perdido.
- `_shared/mercadoLivreAcesso.ts`: a renovação travada saiu do Worker para o comum; Worker e ml-sync usam a mesma regra e a mesma trava.
- `custoEnvioDaVendedora` e `observacaoDoPedido` (5 testes).
- Vendas: `custoEnvio` sai do lucro, do resumo, do rateio dos mais vendidos e do "vai entrar no Financeiro"; a venda mostra "Frete do envio" (4 testes). `config.toml` com as duas funções sem verify_jwt.
- As edge functions foram conferidas com tsc e um shim do Deno (sem Deno na máquina), junto com as do TikTok.
- Suíte inteira: 1.965 testes verdes, tipos, lint e build ok.

## 2026-10-25 — Mercado Livre direto, etapa 3c.4 (VND-30)

A 3c.3 subiu (commit a6674c0, migration e edge functions no ar). Esta etapa: com "A Pólia cuida do estoque" ligado no card, o saldo da Pólia atualiza os anúncios ligados no Mercado Livre.

- `alternarCuidaEstoqueMercadoLivre` (4 testes): ligar só no Pro e com a conta conectada; ao ligar, enfileira todas as variações ligadas para o Mercado Livre começar igual à Pólia. O status devolve `cuidaEstoque`.
- Card: switch "A Pólia cuida do estoque", avisando que quantidade zero pausa o anúncio e que anúncio no Full fica com o Mercado Livre.
- `ml-sync`, passo 3: lê a fila `canal_fila_estoque` do canal, manda o SALDO (negativo como zero) por anúncio (`PUT /items/{id}`) ou por variação (`PUT /items/{id}/variations/{var}`; mandar a lista de variações no PUT do anúncio apagaria as que ficassem de fora). Anúncio no Full fica de fora (uma consulta por anúncio na rodada). Mesma variação ligada a mais de um anúncio: todos recebem. 5 tentativas.
- `alvoDoEstoque` e `quantidadeParaCanal` (3 testes); `estadoAnuncioMl` e `atualizarEstoqueMl` no cliente.
- Migration `20261025110000_mercado_livre_estoque_fila.sql`, testada numa transação desfeita (ligar anúncio com "cuida do estoque" ligado põe a variação na fila do canal): `disparar_ml_sync` passa a olhar também a fila de estoque. **Aplicada pelo MCP com autorização da Sil** e conferida; ml-sync publicado pela CLI.
- Edge functions conferidas com tsc e o shim do Deno. Suíte inteira: 1.972 testes verdes, tipos, lint e build ok.
- Conferir com a conta de teste: se o PUT por variação funciona em anúncio do modelo novo (User Products).

## 2026-10-25 — Mercado Livre direto, etapa 3c.5 (VND-30)

A 3c.4 subiu (commit 54fb676). Esta etapa: revisão de segurança da Fase 3c, ADR e lista de lançamento.

Revisão de segurança por um agente só de leitura sobre o código (2 altos, 4 médios), mais a conferência das permissões no banco de produção (todas as funções do canal só para o service role; tabelas do canal sem acesso do navegador; `vendas` só leitura). Corrigido:

- **Alto, saldo zerado:** leitura de `estoque_saldos` ou dos vínculos que falhava virava quantidade 0 e pausava os anúncios. Agora erro de leitura marca a fila com erro, e variação sem saldo (arquivada) não manda nada. Mesmo conserto no `tiktok-sync`, que tinha o mesmo padrão.
- **Alto, trava do token vencendo no meio:** `pegar_trava_com_dono`/`soltar_trava_com_dono` (só quem pegou solta), trava de 60 s, prazo de 10 s em toda chamada ao Mercado Livre (`AbortSignal.timeout`), espera de 12 s, e releitura do token antes de marcar erro quando o Mercado Livre recusa. O `ml-sync` também usa a trava com dono (300 s).
- **Médio, pedido de outra vendedora:** venda e cancelamento só se `seller.id` do pedido for a vendedora conectada; senão o evento é descartado sem nova tentativa.
- **Médio, aviso enchendo a fila:** `enfileirar_evento_canal` não zera tentativas, não ressuscita evento morto e para em 500 pendentes por vendedora; id de pedido e vendedora até 20 dígitos.
- **Médio, corrida na fila de estoque:** a linha só fecha se `pedido_em` não mudou desde a leitura (ML e TikTok).
- **Médio, frete em dobro no carrinho:** a observação leva `envio <id>`; pedido do mesmo envio entra sem frete.
- Baixos: `receber_venda` com `pg_temp`; prévia busca anúncios ativos e pausados; prévia não fica em cache depois de sair da tela; comentário sobre quem renova corrigido.
- Desconectar tenta revogar a autorização no Mercado Livre (melhor esforço, conferir com a conta de teste).
- Aceitos, sem ação: varredura limitada a 200 pedidos alterados por 15 minutos (fora do volume da persona); a mesma variação ligada a vários anúncios manda o saldo inteiro para cada um (decisão de desenho).
- Migration `20261025120000_mercado_livre_revisao_seguranca.sql`, testada numa transação desfeita (trava pega, recusa ocupada, outro dono não solta, dono solta; evento reaberto mantém tentativas; morto não volta; teto de 500). **Aplicada pelo MCP com autorização da Sil** e conferida; ml-webhook, ml-sync e tiktok-sync publicados pela CLI.
- ADR `docs/adr/0003-mercado-livre-token-de-uso-unico.md` e lista `docs/mercado-livre-lancamento.md` (ligar, usuários de teste, roteiro de 10 passos, pontos a conferir, teste de 7 dias, antes de abrir).

## 2026-10-26 — Anúncios nos canais na sidebar (VND-39)

A integração do Mercado Livre está conectada e os anúncios de teste foram ligados. Faltava um caminho até a tela Ligar anúncios, que só existia dentro de Configurações > Integrações. Plano e wireframe aprovados pela Sil com três decisões: o subnível só aparece com canal conectado, as telas passam para /produtos/anuncios e, depois de conectar, a Pólia leva direto para Ligar anúncios.

- `useCanaisConectados`: junta o status do Mercado Livre e do TikTok Shop (mesmas chaves de cache dos cards) e devolve só canal configurado, conectado e liberado no plano.
- Sidebar: subnível "Anúncios nos canais" abaixo de Produtos, recuado, só quando há canal conectado; no modo compacto vira ícone com dica.
- `/produtos/anuncios`: uma seção por canal com quantos anúncios estão ligados, última sincronização e "Ligar anúncios"; estados de carregando, erro e vazio (vazio leva para Integrações).
- `/produtos/anuncios/mercado-livre` e `/produtos/anuncios/tiktok` usam a mesma `LigarAnunciosCanal`; as rotas antigas em Configurações redirecionam (links velhos continuam funcionando). Salvar e Voltar levam para /produtos/anuncios.
- Retorno da autorização (ML e TikTok): conectou, vai para Ligar anúncios do canal; falhou ou cancelou, volta para Integrações.
