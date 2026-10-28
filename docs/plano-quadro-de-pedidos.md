# Plano: quadro de Pedidos

28/10/2026 · origem: GRW-93 (retenção) · status: **esperando as decisões da Sil, nada codado**

## Por que

- A Calculadora entrega um número **uma vez**. Pedido acontece **toda semana**: o que entregar hoje, o que atrasou, quanto entra. É o motivo pra voltar no dia 2 que o diagnóstico GRW-89 não achou no produto.
- Hoje quase ninguém passa da primeira tela: Planner em 3 de 186 contas, Clientes em 2, Vendas em 1.
- O pedido está espalhado e nenhum dos três lugares tem **data de entrega**:
  - `clientes.status_pedido` tem as fases (Em espera, Em produção, Atrasado, Entregue), mas **uma por cliente**: quem compra de novo não cabe.
  - `vendas.status` só fala de pagamento (`recebida`, `a_receber`, `cancelada`).
  - O Planner é quadro genérico de projeto, com cartão de tarefa (`tarefas`), sem cliente, produto nem valor.
- Já existe a parte difícil: `registrar_venda` (itens do catálogo, custo, estoque, Financeiro, idempotente), `receber_venda`, `cancelar_venda` e orçamento que vira venda (`converter_orcamento`). O quadro aproveita tudo isso.

## A ação principal e o fluxo

**Ação principal:** ver o que precisa sair hoje e mover o pedido pra frente.

**Fluxo em uma frase:** ela anota o pedido em 4 campos, arrasta de A fazer até Entregue, e na entrega a Pólia One pergunta se o dinheiro já entrou e lança no Financeiro.

## Desenho

### Onde o pedido mora (D1)

O pedido **é uma venda** com duas colunas novas. Fonte única: o mesmo registro aparece no quadro, na lista de Vendas, no Financeiro e no Painel, sem número repetido em duas telas.

| Coluna nova em `vendas` | Para quê |
|---|---|
| `andamento` (`a_fazer`, `em_producao`, `pronto`, `entregue`, nulo) | Lugar no quadro. Nulo = venda comum, que não aparece no quadro (todas as vendas de hoje continuam assim). **Na implementação o nome passou de `etapa` pra `andamento`**: "etapa" é vocabulário proibido e o teste de marca lê nome de coluna entre aspas. |
| `entrega_em` (date, nula) | Dia combinado com a cliente. Atraso = `entrega_em < hoje` e etapa antes de `entregue`. |

Duas RPCs novas (security definer, só a dona, mesmo padrão das de venda):

- `registrar_pedido(...)`: chama `registrar_venda` (canal `encomenda`) com `p_recebida` vindo do "Já pagou?" e grava `andamento = 'a_fazer'` e `entrega_em` na mesma transação. Confere o teto do Grátis.
- `atualizar_pedido(p_venda_id, p_andamento, p_entrega_em)`: move de coluna e remarca a entrega. Pedido cancelado não se move.

O estoque continua baixando na criação, como em toda venda de hoje (D6).

### Onde a tela mora (D3)

- **`/planner/pedidos`**: quadro fixo, sempre o primeiro da lista do Planner, **fora da cota de 1 quadro do Grátis**. Rota própria (`planner.pedidos.tsx`), que tem prioridade sobre `planner.$slug.tsx`; hoje nenhuma conta tem quadro com slug `pedidos`.
- Em Vendas, a aba "Todas as vendas" ganha o atalho "Ver como quadro".
- Nada novo no menu lateral: o Planner já está lá e aberto no Grátis.

### Colunas (D4)

Fixas: **A fazer · Em produção · Pronto · Entregue**. Sem renomear no começo, porque o Painel e o lembrete leem esses quatro estados. "Atrasado" não é coluna: é um selo no cartão (data passou e não foi entregue).

Arrastar usa o mesmo HTML5 nativo do Planner de hoje, com o mesmo caminho por teclado (botão "avançar" e seletor de coluna).

### Pagamento (D5)

Sem sinal nem pagamento parcial no começo. O pedido nasce `a_receber` ou `recebida` pelo "Já pagou?". Ao chegar em **Entregue** ainda `a_receber`, o cartão pergunta "O dinheiro já entrou?" com **Sim, lançar no Financeiro** (`receber_venda`) e **Ainda não**.

## Wireframe em cinza (estrutura, sem cor)

### Quadro `/planner/pedidos`

```
Pedidos                                                  [ + Novo pedido ]
Hoje: 2 entregas · Atrasados: 1 · Esta semana entram R$ 340

┌ A fazer (3) ──────┐ ┌ Em produção (2) ─┐ ┌ Pronto (1) ──────┐ ┌ Entregue ────────┐
│ Joana             │ │ Carla            │ │ Bia              │ │ (últimos 7 dias) │
│ 2x Bolo de pote   │ │ 1x Caneca        │ │ 6x Brigadeiro    │ │                  │
│ R$ 36 · lucra R$14│ │ R$ 45            │ │ R$ 30            │ │ Rita · R$ 60     │
│ entrega qui 30/10 │ │ ATRASADO 27/10   │ │ entrega hoje     │ │ Entrou no caixa  │
│ a receber         │ │ pago             │ │ a receber        │ │                  │
│            [ → ]  │ │           [ → ]  │ │           [ → ]  │ │                  │
└───────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

- Cartão: cliente, itens, total e lucro, data de entrega (ou selo de atraso), pago ou a receber, botão avançar.
- Entregue mostra só os últimos 7 dias; o resto fica na lista de Vendas.
- Celular: uma coluna por vez, com abas no topo (A fazer 3 · Em produção 2 · Pronto 1 · Entregue).

### Novo pedido (modal, 4 campos e uma pergunta)

```
Novo pedido
  Cliente          [ Joana                    ▾ ]   (escolhe ou digita nome novo)
  Produto          [ Bolo de pote · R$ 18     ▾ ]   (catálogo; o primeiro preço já está lá)
  Quantidade       [ 2 ]
  Entrega          [ 30/10 ]
  Já pagou?        ( ) Sim   (•) Ainda não
                                  [ Cancelar ]  [ Anotar pedido ]
```

"+ mais um produto" abre outra linha de item (o `registrar_venda` já aceita vários).

### Entregue ainda a receber

```
│ Bia · 6x Brigadeiro · R$ 30                          │
│ Entregue. O dinheiro já entrou?                      │
│ [ Sim, lançar no Financeiro ]   Ainda não            │
```

### Painel (bloco novo, só pra quem tem pedido aberto)

Na implementação o cartão se chama **"Entregas"**: o Painel já tinha um "Pedidos · mês" (vendas do mês), e dois "Pedidos" na mesma tela confundiam.

```
Entregas
Hoje: 2 entregas · Amanhã: 1 · Atrasados: 1
Esta semana entram R$ 340
Abrir o quadro
```

O cartão "X entregues · Y em espera" de hoje (que lê `clientes`) dá lugar a este quando a conta tem pedido no quadro (ver Fase 3).

### Lembrete da véspera (Fase 2)

```
Assunto: Amanhã: 2 entregas na Pólia One
Joana · 2x Bolo de pote · a receber R$ 36
Bia · 6x Brigadeiro · pago
[ Quero abrir os pedidos ]
```

E-mail às 18h de Brasília pra quem tem entrega no dia seguinte e não marcou como entregue. Push no Android pelo mesmo motivo, quando houver aparelho (hoje 0). Opção de desligar em Configurações.

## Fases

| Fase | O que entra | Banco |
|---|---|---|
| **1. Quadro** | Colunas + RPCs, `/planner/pedidos`, modal Novo pedido, cartão, "O dinheiro já entrou?", atalho em Vendas, bloco no Painel, evento de uso. | migration: 2 colunas, 2 RPCs |
| **2. Véspera** | E-mail da véspera (`lembretes-conta` ou função própria) e push `entregas_amanha`, opção em Configurações. | coluna `notif_entregas`, RPC de alvos, cron |
| **3. Ligações** | Orçamento aprovado vira pedido (`converter_orcamento` grava etapa); atalho "Anotar um pedido desse produto" depois do primeiro preço guardado; Clientes passa a ler a fase do pedido do quadro (fim do "Em espera/Em produção" duplicado no cadastro da cliente). | ajuste no `converter_orcamento` |

Cada fase sobe separada e é medida antes da próxima.

## Decisões pra Sil

| # | Decisão | Minha recomendação |
|---|---|---|
| D1 | Pedido mora em Vendas (2 colunas novas) ou numa tabela separada | **Em Vendas.** Uma fonte só pra quadro, lista, Financeiro e Painel. |
| D2 | O Grátis tem o quadro de Pedidos | **Sim, com teto de 15 pedidos abertos** (A fazer até Pronto). Hoje Vendas é Premium (VND-01 em aberto) e só 17 contas estão no Grátis, mas 162 estão no teste do Pro e voltam pro Grátis no fim dele: sem o quadro, quem criou o hábito no teste perde o motivo de voltar no dia seguinte. A lista completa de Vendas, orçamento e canais continuam Premium. |
| D3 | Onde mora a tela | **Quadro fixo no Planner** (`/planner/pedidos`, fora da cota) + atalho em Vendas. Nada novo no menu. |
| D4 | Colunas | **Fixas**: A fazer, Em produção, Pronto, Entregue. Atrasado é selo, não coluna. |
| D5 | Sinal e pagamento parcial | **Fora da Fase 1.** "Já pagou?" sim/não e a pergunta na entrega. |
| D6 | Estoque | **Baixa na criação**, igual a toda venda hoje (sem mexer no `registrar_venda`). |
| D7 | Lembrete da véspera | **E-mail às 18h + push quando houver aparelho**, ligado por padrão e com opção de desligar. Fase 2. |

## Como medir

| Métrica | Hoje |
|---|---|
| Contas novas com 1 pedido ou mais nos primeiros 7 dias | 0 (o quadro não existe) |
| Volta em outro dia, entre quem anotou pedido e quem não anotou | 1 a 15% por coorte, sem separar |
| Pedidos movidos por conta ativa por semana | não existe |

Se quem anota pedido volta muito mais que o resto, o próximo passo é levar o "Novo pedido" pra primeira sessão (logo depois do primeiro preço).

## Riscos

- **Mais uma tela pouco vista:** se o primeiro minuto não melhorar (GRW-92, 11/11), o quadro chega a pouca gente. Por isso a Fase 3 liga o quadro ao primeiro preço.
- **Duplicação com Clientes** até a Fase 3: a cliente continua com "Em produção" no cadastro dela. A Fase 1 não grava nada em `clientes.status_pedido`, pra não ter duas escritas brigando.
- **Abrir Vendas pro Grátis (D2)** mexe na decisão de plano do VND-01. O teto de 15 abertos e a lista completa no Premium seguram isso.

## Ordem de execução depois das decisões

1. Diário de bordo em `docs/script.md`.
2. Migration da Fase 1, testada numa transação desfeita, aplicada só com o ok da Sil.
3. Regras puras (`lib/pedidos.ts`: atraso, resumo do dia e da semana, teto do Grátis) + testes.
4. Quadro, modal, cartão e estados (vazio, carregando, erro, teto atingido, pedido cancelado).
5. Bloco no Painel e atalho em Vendas.
6. `npm test` inteiro, tipos, lint, build e análise de confiança.
7. Commit só dos arquivos da fase e deploy só com o ok da Sil.
