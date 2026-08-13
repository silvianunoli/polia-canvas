# Análise heurística — /planejamento

> Feita em 12/08/2026 sobre `src/routes/_authenticated/planejamento.index.tsx` (1.046 linhas).
> **Método:** leitura do código que renderiza a tela, não do print. O painel de navegador está
> proibido nesta máquina, então tudo aqui é o que o componente de fato monta. Onde eu não pude
> confirmar visualmente (proporção, peso real na tela), está marcado como **[a confirmar no olho]**.

## Contexto e ação principal

A `/planejamento` é o documento vivo do negócio: 6 módulos que a usuária responde e que viram as
ferramentas (Marca, Mercado, Catálogo, Financeiro, Caderno, Metas). A tela tem duas vistas,
Documento e Mapa.

**Ação principal (inferida):** *continuar o planejamento de onde parou* — abrir o módulo atual e
responder as seções que faltam. Tudo o mais na tela (reler módulo concluído, ir pra ferramenta,
trocar de vista) é secundário.

Essa inferência importa porque **a tela hoje não privilegia essa ação em lugar nenhum**: não existe
um "continuar" em posição de destaque. A ação principal está escondida dentro do módulo atual, que
pode estar a três rolagens de distância, embaixo dos módulos já concluídos.

## Diagnóstico por heurística

| # | Heurística | Status | Observação | Impacto |
|---|---|---|---|---|
| 1 | Visibilidade do status | **violação** | A vista Documento não mostra progresso global. `MapaMental` recebe `concluidos`/`total`, mas a vista Documento não exibe nada equivalente: pra saber "2 de 6", é preciso somar os chips com o olho. | Alto: a usuária não sabe onde está na única coisa que a tela mede |
| 2 | Correspondência com o mundo real | OK | "Módulo", "seção", "concluído", nomes dos 6 módulos em português claro. Nenhum jargão. | — |
| 3 | Controle e liberdade | atenção | Dá pra voltar e reler módulo concluído, e o toggle Documento/Mapa persiste. Mas módulo bloqueado é um `<button disabled>` mudo: clicar não explica nada. | Médio |
| 4 | Consistência e padrões | **violação** | Cinco formas de botão/link convivendo na mesma tela (detalhe abaixo). | Alto: a usuária não aprende o que é clicável |
| 5 | Prevenção de erros | OK | Desbloqueio sequencial impede pular módulo; `disabled` impede o clique inválido. | — |
| 6 | Reconhecimento vs. memorização | atenção | A faixa sticky mantém os 6 módulos visíveis, o que é bom. Mas o motivo do bloqueio só aparece lá embaixo, dentro do módulo, não no chip. | Médio |
| 7 | Flexibilidade e eficiência | atenção | Não há atalho pra ação principal ("continuar"). Quem já usa precisa rolar até o módulo atual toda vez. | Médio |
| 8 | Estética e minimalismo | **violação** | Pra quem está começando, a tela é uma parede de seis blocos repetindo "Este módulo ainda está em branco". Cabeçalho redundante. Faixa sticky com três informações por chip. | Alto: primeira impressão de vazio, não de começo |
| 9 | Recuperação de erros | não aplicável | A tela é de leitura; não há formulário nem erro a recuperar. | — |
| 10 | Ajuda e documentação | atenção | Nenhuma explicação do que é o Planejamento pra quem abre pela primeira vez. O subtítulo diz "Seu planejamento de negócio.", que só repete o título. | Médio |

## Problemas priorizados

| Gravidade | Problema | Correção concreta |
|---|---|---|
| **Alta** | **Cinco formas de botão na mesma tela.** Toggle em `rounded-lg`; chip da ferramenta em `rounded-full` com fundo `--secondary-light`; "Editar módulo" como link de texto; "Começar agora" em `rounded-full` sólido; cards do fim em `rounded-full`; e o cartão de conclusão usando `rounded-[var(--radius-md)]`, único uso dessa variável no arquivo. | Adotar as duas formas do site: primário = `rounded-xl` + fundo `--secondary` + borda 1.5px `--ink`; secundário = `rounded-xl` + borda `--ink` sem preenchimento. Pill (`rounded-full`) só para *badge* que não é clicável. O chip "→ Ferramenta" vira botão secundário pequeno. |
| **Alta** | **Nenhum atalho para a ação principal.** Não existe "continuar de onde parou" no topo. | Colocar no cabeçalho, ao lado do h1, um botão primário `Continuar o Módulo N · {nome}` apontando para `/planejamento/modulo/{moduloAtual}`. É a mesma informação que a tela já calcula em `moduloAtual`. |
| **Alta** | **Parede de vazio para quem começa.** Com 0 módulos feitos, a tela repete "Este módulo ainda está em branco" até 6 vezes, e 5 delas ainda dizem "Disponível após concluir o Módulo N-1". | Renderizar por extenso apenas o módulo atual e os concluídos. Os futuros viram uma lista compacta de uma linha cada, sob um rótulo "O que vem depois", sem repetir a frase de vazio. |
| **Média** | **Sem progresso global na vista Documento.** | Abaixo do h1, uma linha com `{concluidos} de 6 módulos concluídos` e uma barra fina `--secondary` sobre trilho `--line`. Os dois valores já existem no componente. |
| **Média** | **Cabeçalho redundante.** Eyebrow "Planejamento" + h1 com o nome do negócio + subtítulo "Seu planejamento de negócio.": a palavra aparece duas vezes em três linhas e o subtítulo não informa nada. | Trocar o subtítulo pela linha de progresso acima. Quem não tem `businessName` vê "A base do seu negócio." no h1, que já resolve. |
| **Média** | **Módulo bloqueado não explica no lugar do clique.** O chip é `disabled` e mudo. | Dar ao chip bloqueado `title` e `aria-label` com "Abre depois do Módulo {n-1}", e trocar o `cursor-default` por `cursor-not-allowed`. |
| **Baixa** | **Setas "→" dentro do rótulo** em quatro pontos ("→ Ferramenta", "Editar módulo →", "Começar agora →", "Catálogo →"). O leitor de tela lê a seta junto com o texto, e visualmente a direção fica inconsistente (uma antes, três depois). | Tirar do texto e usar `<span aria-hidden="true">→</span>` separado, sempre depois do rótulo. |
| **Baixa** | **Faixa sticky densa.** Cada chip empilha ícone, nome e status; no celular são 124px por item, 744px de rolagem horizontal. | Manter ícone e nome; mostrar o status ("seção 2 de 4") só no módulo atual. Os demais já se distinguem por preenchimento do ícone. |
| **Baixa** | **Rotação no hover do ícone do módulo** (`group-hover:-rotate-[4deg]`). | Movimento decorativo que não comunica nada e não é usado em nenhuma outra tela. Trocar por mudança de fundo apenas. |

## Top 3 de maior retorno

1. **Unificar as formas de botão** para as duas do site (primário turquesa com borda de tinta, secundário só contorno, ambos `rounded-xl`). É o que mais faz a tela parecer desenhada por uma pessoa só, e é mecânico: nenhuma decisão de produto envolvida.
2. **Criar o "Continuar o Módulo N"** no cabeçalho. A tela sabe qual é o módulo atual e hoje não faz nada com essa informação; é a maior distância entre o que a usuária veio fazer e o que a tela oferece.
3. **Colapsar os módulos futuros** em vez de repetir seis blocos de vazio. Muda a primeira impressão de "não fiz nada" para "estou no começo de um caminho de seis".

## Observação sobre o que esta análise não cobre

Proporção, peso visual real, o quanto a faixa sticky come da dobra e como isso tudo se comporta no
celular são coisas que só se julgam com a tela na frente. Os problemas acima são os que dá pra
afirmar lendo o que o componente monta. Se houver incômodo que não está nesta lista, provavelmente é
de proporção, e aí um print resolve na hora.

---

## Adendo: os 3 incômodos que só o print revelou (13/08/2026)

A análise acima foi feita lendo o código, e por isso não pegou três problemas de **proporção** —
exatamente a classe que eu tinha avisado que precisaria de olho na tela. Os prints da fundadora
mostraram, e os três eram bugs de implementação, não escolha de design:

| Incômodo | Causa real | Correção |
|---|---|---|
| Metade da largura vazia ao lado do bloco de destaque | `max-w-[30em]` no wrapper. `em` herda o 16px do contêiner, não os 26px do parágrafo: dava ~480px de medida para um texto grande, ou seja ~18 caracteres por linha. | Medida movida para o `<p>` em `ch`, que acompanha o tamanho real do texto: `max-w-[46ch]`. |
| Colunas finas demais, quebrando a frase a cada duas palavras | Os quatro blocos de prosa do Módulo 2 (dores, sonhos, gatilhos, objeções) eram `span: 3`. A 25% de um contêiner de 860px, cada um fica com ~200px. | `span: 6` nos quatro: duas colunas de ~415px. |
| Borda "falhada" no cartão ativo da faixa do topo | O destaque era `ring-1`, que é desenhado **fora** da caixa do elemento. A faixa é `overflow-x-auto`, e overflow em um eixo faz o outro virar `auto` também, então o anel era recortado em cima e embaixo e sobravam só os cantos. | Trocado por `border`, que vive dentro da caixa e nunca é recortada. Base `border-transparent` para não haver salto de layout. |

Junto: `items-start` no bento, para cada cartão ter a altura do próprio texto. Esticados pela linha,
os curtos ficavam com metade da caixa vazia ao lado de um vizinho comprido.

**Lição:** proporção não se audita lendo código. Os três tinham causa mecânica identificável, mas
nenhum deles apareceu na leitura do componente — só quando a tela foi vista.
