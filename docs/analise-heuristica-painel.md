# Análise heurística — /painel

> Feita em 13/08/2026 sobre a tela **em produção** (`https://usepolia.com.br/painel`), aberta no
> Chrome com a sessão real da fundadora, e cruzada com `src/routes/_authenticated/painel.tsx` (869 linhas).
> **Método:** desta vez a tela foi vista e medida, não só lida no código. Cada número abaixo veio de
> `getBoundingClientRect()` na página servida. Onde a conclusão depende do plano da conta, está dito.

## Contexto e ação principal

O painel é a tela de abertura da área logada: mostra o estado do negócio no mês e leva para a
próxima ação. A conta observada está no plano **Confere** (o gratuito) — a barra lateral marca com
cadeado Projeção, Financeiro, Raio-x, Clientes, Metas, Plano de conteúdo e Calendário.

**Ação principal (inferida):** *fazer a próxima coisa que move o mês* — hoje a tela responde
"registre sua primeira venda", mas quem decide o que é essa próxima coisa é o dado que o painel
acabou de mostrar.

Essa inferência é o centro do diagnóstico, porque **a tela nomeia a ação principal na manchete e
não a oferece em lugar nenhum** — e, no plano gratuito, a página que executaria essa ação está
bloqueada.

## Diagnóstico por heurística

| # | Heurística | Status | Observação | Impacto |
|---|---|---|---|---|
| 1 | Visibilidade do status | atenção | Mês, presença e dia no planejamento aparecem bem. Mas nada indica que 5 dos blocos clicáveis levam a página bloqueada: o painel mostra o dado e esconde a tranca que a barra lateral mostra. | Alto |
| 2 | Correspondência com o mundo real | **violação** | Dois cartões vizinhos se contradizem: a manchete diz "Vamos registrar sua **primeira venda**?" e o cartão ao lado diz "12 clientes · **8 entregues**". Pela leitura da tela, ela entregou 8 pedidos e nunca vendeu. | Médio |
| 3 | Controle e liberdade | **violação** | Clicar em "Quanto sobrou", "Receita", "Pedidos", "Clientes" ou "Calendário" tira a usuária do painel e a joga em `/upgrade`. Nenhum deles avisa antes. | Alto |
| 4 | Consistência e padrões | atenção | O botão de guardar a intenção é pêssego (`--accent`); toda ação primária do produto é turquesa. Os títulos de cartão são `<p>`, não `<h2>` — a página inteira tem **um único heading**. | Médio |
| 5 | Prevenção de erros | **violação** | Mesmo ponto da nº 3, pelo outro lado: o cartão principal instrui "registre entradas e saídas pra ver" — uma instrução que o plano da usuária não permite cumprir. A tela pede o impossível e não diz por quê. | Alto |
| 6 | Reconhecimento vs. memorização | OK | Nomes claros, métricas rotuladas, prazos escritos por extenso ("era pra 16/07"). | — |
| 7 | Flexibilidade e eficiência | **violação** | Não existe atalho para a ação que a manchete pede. A manchete é uma pergunta sem botão. | Alto |
| 8 | Estética e minimalismo | **violação** | O cartão de tarefas renderiza **as 26 tarefas atrasadas**, sem teto: 1.328px de altura. O cartão ao lado tem 258px de conteúdo, deixando ~1.070px de branco na coluna direita. E as 26 linhas são todas vermelhas. | Alto |
| 9 | Recuperação de erros | não aplicável | Só o erro de salvar a intenção, que já tem toast com texto claro. | — |
| 10 | Ajuda e documentação | atenção | O gráfico "Sua semana de trabalho" ocupa metade da largura para exibir quatro zeros e barras de 2px. Não explica que ele conta tarefas concluídas do Planner nem o que fazer para preenchê-lo. | Médio |

## Problemas priorizados

| Gravidade | Problema | Correção concreta |
|---|---|---|
| **Alta** | **A tela pede o que o plano proíbe.** O maior elemento do painel ("Quanto sobrou · mês", R$ 0) diz "registre entradas e saídas pra ver" e aponta para `/financeiro`, bloqueado no Confere. Idem Receita, Pedidos, Clientes e Calendário: **5 blocos clicáveis levam a `/upgrade`, nenhum com cadeado.** | Decidir uma das duas posturas e aplicar inteira. (a) *Honesta:* marcar cada bloco bloqueado com o mesmo cadeado da barra lateral e trocar o texto de apoio por "no Controle", mantendo o clique para `/upgrade`. (b) *Enxuta:* não exibir métrica financeira no Confere e usar o espaço para o que o plano entrega (Planejamento, Produtos, Planner, Caderno). O que não pode continuar é a terceira via de hoje: mostrar o número, mandar registrar, e barrar na porta. |
| **Alta** | **A manchete é uma pergunta sem resposta.** "Vamos registrar sua primeira venda?" não vem acompanhada de nenhum botão. | Colocar um botão primário logo abaixo da manchete, apontando para a ação que ela nomeia, e derivá-lo do mesmo `useMemo` que já escolhe o texto: sem receita → "Registrar uma entrada"; com meta em aberto → "Ver o Financeiro"; meta batida → "Ver o mês". No Confere, o mesmo botão vira "Conhecer o Controle". |
| **Alta** | **Cartão de tarefas sem teto: 26 itens, 1.328px.** É a causa direta do branco na coluna direita (o cartão vizinho tem 258px) e faz a tela abrir como uma parede de atraso, tudo em `--danger`. | Limitar a 5 itens por grupo, com "mais 21 atrasadas →" apontando para o Planner filtrado. Cor de perigo só no rótulo do grupo e nos 3 mais antigos; o resto em `--muted`. Vinte e seis linhas vermelhas não informam mais que cinco: só pesam mais. |
| **Média** | **Larguras fixas outra vez.** `SPAN_CLASS` dá 5/3/4 a Receita, Pedidos e Clientes: 424px, 248px e 336px medidos na tela. São três métricas comparáveis do mesmo mês. | Largura igual para as três (`sm:col-span-4`), como já foi feito nos cartões de produto do `/planejamento`. Item comparável pede grade regular; conteúdo de tamanho livre é que pede coluna que se acomoda. |
| **Média** | **Gráfico morto.** 150px de altura para mostrar quatro zeros e barras de 2px; Sex/Sáb/Dom sem rótulo algum. | Estado vazio próprio: quando a semana soma zero, trocar o gráfico por uma linha ("Nenhuma tarefa concluída nesta semana ainda") e o atalho para o Planner. O gráfico volta quando houver o que desenhar. |
| **Média** | **Um heading na página inteira.** "Suas tarefas", "Sua semana de trabalho", "Quanto sobrou" são `<p>`. | Promover os títulos de cartão a `<h2>`. Leitor de tela hoje não consegue navegar o painel por seções. |
| **Baixa** | **"Planejamento concluído ver".** O link "ver" tem a mesma cor do texto e nenhum sublinhado até o hover, colado na frase. Lê como erro de digitação. | Trocar por um link explícito em `--secondary-text` ("abrir o Planejamento") ou remover, já que o item existe na barra lateral. |
| **Baixa** | **Botão da intenção em pêssego.** `--accent` como cor de ação, enquanto o resto do produto usa turquesa. | Turquesa com borda de tinta, a mesma forma dos outros botões primários. |
| **Baixa** | **Rotação no hover dos ícones** (`group-hover:-rotate-[4deg]`, 2 ocorrências). | Mesmo movimento decorativo já removido do `/planejamento`. Trocar por mudança de fundo apenas. |

## Top 3 de maior retorno

1. **Resolver a contradição do plano.** É o único problema que faz a usuária bater numa porta fechada depois de a tela ter mandado ela ir até lá. Qualquer melhoria de layout feita antes disso está polindo uma tela que engana.
2. **Dar um botão à manchete.** A tela já calcula qual é a próxima ação — ela só não oferece. É a menor distância entre o que o painel sabe e o que a usuária consegue fazer.
3. **Pôr teto no cartão de tarefas.** Resolve de uma vez o vazio da coluna direita, a altura de 1.328px e a parede vermelha na abertura.

## O que esta análise não cobre

Celular. A janela desta máquina não desce a uma largura de CSS que sirva de teste (o zoom do
navegador distorce a conta), então o comportamento mobile foi lido no código — a grade cai para
`col-span-12` e empilha — mas não foi visto. Vale um print do celular.

## Adendo: corrigido e medido na tela (13/08/2026, versão `bab21cf7`)

Todos os itens da tabela foram aplicados, pela postura **honesta** (métrica visível, bloqueio
declarado). Medições antes → depois, na mesma página servida:

| O quê | Antes | Depois |
|---|---|---|
| Altura do cartão de tarefas | 1.328px, 26 itens | 402px, 5 itens + "mais 21 atrasadas →" |
| Vazio na coluna direita | ~1.070px | 0 (as duas colunas fecham em 402px) |
| Altura total da página | 2.173px | 1.298px |
| Larguras de Receita / Pedidos / Clientes | 424 / 248 / 336px | 336 / 336 / 336px |
| Headings na página | 1 | 7 (h1 + 6 h2) |
| Blocos que levavam a página fechada sem aviso | 5 | 0 (todos com selo "no Controle") |

Duas decisões que não estavam na tabela e vieram do próprio conserto:

- **Traço no lugar de "R$ 0"** nas métricas fechadas. Sem Financeiro não existe lançamento, então
  "R$ 0" afirmava algo falso: não é que não sobrou, é que não há o que somar. Era essa afirmação
  que contradizia o cartão de "8 entregues" ao lado.
- **Ordenação por prazo** nos três grupos de tarefas. Com teto de 5, quem aparece tem que ser quem
  mais espera; a lista vinha na ordem de criação, então o corte pegaria as tarefas erradas (na tela
  antiga, "era pra 28/06" aparecia depois de "era pra 27/07").

## Nota de método

A largura horizontal **não** é problema: medida na tela, o container ocupa 87% da área útil, com
87px de folga de cada lado a 1.526px de viewport. Uma medição intermediária sugeriu 1.149px de
vazio lateral; era estado velho da janela durante um redimensionamento, e foi descartada em vez de
virar achado. Diferente da análise do `/planejamento`, aqui os problemas de proporção foram
medidos, não inferidos.
