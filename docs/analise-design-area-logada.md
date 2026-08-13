# Análise de design — área logada

> 13/08/2026. Feita **na aplicação em produção**, no Chrome, com a sessão real
> (`silviaoliveira7288@gmail.com`, plano `controle`). Cada medida veio de
> `getBoundingClientRect()` e `getComputedStyle()` na página servida, a 1.536px de viewport.
> **Escopo: só design.** Copy foi deixada de fora de propósito, como pedido.

## Cobertura

**14 telas vistas e medidas:** Painel, Planejamento, Financeiro, Produtos, Clientes, Metas,
Caderno, Planner, Aimer, Calendário, Mercado, Chamados, Assinar, Raio-x (portão).

**10 telas não vistas**, e vale saber por quê — nenhuma foi por escolha:

| Tela | Motivo |
|---|---|
| Raio-x, Projeção, Plano de conteúdo | São Projete; a conta é Controle. Vi só o portão, não a tela real. |
| Marca, Upgrade, Módulo do Planejamento, Planejamento completo, Quadro do Planner, Chamado aberto | O classificador de permissão passou a barrar a navegação no meio da varredura. |
| Onboarding | Só aparece pra conta sem onboarding concluído. |

**Limitação que atravessa tudo:** essa conta está praticamente vazia. Onze das quatorze telas
apareceram em **estado vazio**. Isso é ótimo pra auditar estados vazios (e eles têm problema), mas
significa que **proporção com conteúdo real só foi observada no Painel** — que era a conta de demo,
com 26 tarefas e 12 clientes, e onde justamente apareceram os piores problemas de proporção. É
provável que as outras telas tenham defeitos equivalentes que só aparecem cheias.

---

## Achado nº 1 — não existe um container. Cada tela inventa a sua largura.

Este é o problema de origem, e é o que se sente sem saber nomear ao trocar de aba: **o conteúdo
salta de lugar toda vez.**

| Tela | Início do título (x) | Largura do conteúdo |
|---|---|---|
| Painel | 366 | **1.120px** |
| Financeiro / Produtos / Caderno / Calendário | 364–366 | **~1.070px** |
| Planejamento | ~380 | **~860px** |
| Planner | 485 | **~835px** |
| Clientes | 494 | **~820px** |
| Assinar | centrado | **~775px** |
| Metas | 544 | **760px** |
| Chamados | 556 | **~692px** |
| Aimer / Mercado | 576 | **~650px** |

**Oito larguras distintas em quatorze telas**, e com elas oito margens esquerdas diferentes. Sair de
Produtos (título a 364px) para Aimer (título a 576px) move o título 212px para a direita. Nenhuma
dessas diferenças comunica nada: não é que Aimer precise ser estreita e Painel largo — é que cada
rota declarou o próprio `max-w` sem consultar as outras.

**Correção:** um componente de layout único (`<PaginaLogada>`) com uma largura padrão e, no máximo,
duas variantes justificadas — larga para telas de dados (Painel, Financeiro, Calendário) e estreita
para telas de leitura ou conversa (Aimer). Toda rota passa a usá-lo; nenhuma rota declara `max-w`
própria. É a mudança de maior efeito por linha de código de toda esta lista.

## Achado nº 2 — o botão primário tem três formas

| Forma | Onde | Medida |
|---|---|---|
| Pílula turquesa **sem borda** | Clientes, Produtos, Metas, Caderno, Planner, Chamados, Financeiro, Calendário | raio 16px, borda 0 |
| Retângulo turquesa **sem borda** | Assinar, portão do Raio-x | raio 12px, borda 0 |
| Retângulo turquesa **com borda de tinta 1,5px** | Painel, Planejamento | raio 12px, borda 1,5px |

A terceira é a forma do site público e das telas de auth — a que a usuária vê antes de entrar, e a
única das três que existe fora da área logada. As outras duas são divergências internas. Hoje quem
sai da home e entra no app troca de linguagem de botão na primeira tela.

**Correção:** adotar a terceira em toda a área logada, exatamente como já está em
`components/site/Editorial.tsx` (`BTN_PRIMARIO` / `BTN_CONTORNO`), e reservar `rounded-full` para
selo que **não** é clicável. Extrair para um único módulo compartilhado, senão a divergência volta.

## Achado nº 3 — a ação principal muda de lugar a cada tela

Não há uma posição canônica para o botão que a tela existe para oferecer:

- **Abaixo do título, à esquerda:** Metas, Produtos, Painel
- **À direita, alinhado ao subtítulo:** Clientes, Chamados
- **À direita, alinhado ao título:** Caderno, Planner
- **Não existe:** Mercado

Quatro posições em oito telas. O olho tem que reprocurar o botão em cada troca de aba, e é o que
mais faz a área logada parecer montada por pessoas diferentes.

**Correção:** uma posição só, no mesmo componente de cabeçalho do Achado nº 1 — sugiro topo à
direita, alinhado ao título, porque é o único ponto que não se desloca quando existe ou não
subtítulo.

## Achado nº 4 — Fraunces virou fonte de subtítulo

A regra do projeto é que Fraunces é **itálico pontual** (pull-quote, saudação). Hoje ela é o
subtítulo padrão de Clientes, Caderno, Planner, Chamados e Assinar. Em Chamados chegou ao pior caso:
um parágrafo de **duas linhas** em serifada itálica com um link sublinhado no meio.

E é inconsistente até na própria transgressão: Calendário e Mercado usam Inter no mesmo papel de
subtítulo. Mesma função, duas fontes.

**Correção:** subtítulo de página em Inter, `--ink-soft`. Fraunces volta a ser só a saudação do
Painel e citação.

## Achado nº 5 — o estado vazio tem três desenhos

Onze telas apareceram vazias, em três formatos diferentes:

1. **Caixa branca, texto centralizado, link abaixo** — Produtos, Metas, Mercado
2. **Caixa de borda tracejada, texto em Fraunces itálico cinza** — Clientes, Chamados
3. **Painel dividido com ícone em círculo pêssego** — Caderno

A borda tracejada não aparece em nenhum outro lugar do produto. E os três centralizam o texto, num
app que alinha à esquerda em todo o resto — o estado vazio é hoje a maior fonte de centralização da
área logada.

**Correção:** um componente `<Vazio>` com título, uma linha de explicação e uma ação, alinhado à
esquerda, com a borda sólida `--line` do resto do sistema.

## Achado nº 6 — Assinar tem o defeito que já corrigimos no Painel

Os dois cartões de plano têm alturas diferentes porque Controle lista cinco benefícios e Projete
lista dois. Resultado: **o botão "Assinar o Controle" fica 99px abaixo do "Assinar o Projete"**, e o
cartão do Projete termina com um bloco vazio grande.

São itens comparáveis — o olho desce a coluna comparando preço e depois procura o botão. É
exatamente o caso de altura igual com a ação ancorada na base (`flex flex-col` + `mt-auto`), a mesma
correção já aplicada nos cartões de produto do Planejamento e nas métricas do Painel.

Vale um cuidado extra aqui: é a única tela do app que cobra.

## Achado nº 7 — três linguagens diferentes para "isto é pago"

1. **Cadeado** ao lado do item na barra lateral
2. **Redirect** para `/upgrade`, que tira a usuária da tela sem aviso
3. **Portão dentro da página**, centralizado, com cadeado grande e botão (Raio-x)

O Painel acabou de ganhar uma quarta (o selo "no Controle"), que é deliberadamente igual à primeira.
As outras três precisam convergir: o cadeado avisa antes, o portão explica no lugar, e o redirect
não faz nem uma coisa nem outra.

**Correção:** cadeado sempre que o bloco é visível, portão sempre que a rota é aberta direto, e
nunca redirect silencioso.

### Corrigido em 13/08/2026 (versão `080730f4`) — o cadeado que faltava

A fundadora notou que as telas do Projete apareciam **sem cadeado** pra uma conta Controle. A causa
é estrutural: o sistema de tiers tem só dois níveis (`confere` / `controle`) e o **Projete mora
dentro do `controle`**, então `tierMinimoDaRota("/raiox")` devolve `"controle"` e a barra lateral
concluía, corretamente pela informação que tinha, que a rota estava liberada. A trava real do Projete
vivia num `if` dentro de cada página, invisível pra navegação.

Resultado pra quem paga o Controle: três itens de menu sem cadeado, que só se revelavam pagos depois
do clique.

Correção em `src/lib/planos.ts`, que passa a responder a pergunta que faltava:

- `temProjete(plano)` — direito às features do Projete, agora numa função só;
- `ehRotaProjete(pathname)` e `tierPagoDaRota(pathname)` — quais rotas são do Projete e qual plano
  nomear na tela de upgrade (antes o cadeado dizia "Controle" mesmo pra rota do Projete);
- `recursoLiberado(pathname, plano)` — soma a trava de rota com o portão de dentro da página. É o que
  a navegação consulta agora.

**Segundo bug, encontrado no caminho:** a checagem `plano === "projete"` estava copiada em **seis
arquivos** (Raio-x, Projeção, Plano de conteúdo, Produtos, Financeiro e a função da Aimer), e em
todos eles uma conta **`beta` reprovava** — apesar de `beta` ser acesso total em todo o resto do
sistema (inclusive na tabela de modelos de IA do próprio arquivo da Aimer, onde `beta` já estava no
Pro). As seis cópias passaram a chamar `temProjete`.

Coberto por `src/lib/planos.test.ts` (novo, 17 casos), incluindo o teste que reproduz o bug:
`rotaLiberada("/raiox", "controle")` continua `true` — está certo, o roteador deixa entrar — enquanto
`recursoLiberado("/raiox", "controle")` é `false`, que é o que a navegação precisa saber.

## Achado nº 8 — detalhes menores, mas visíveis

- **Calendário não tem eyebrow** e começa 16px mais alto que todas as outras telas. É a única.
- **Metas não tem subtítulo**, enquanto todas as vizinhas têm.
- **Mercado não está na barra lateral** — a rota existe, é linkada de dentro do Planejamento e não
  tem entrada de navegação própria.
- **Títulos com e sem ponto final** convivem: "Seus produtos e preços." / "Planner" / "Aimer".
- **Configurações diz "no Confere agora"** para uma conta que está em `controle` no banco. Não é
  design, é um bug de leitura de plano, mas aparece na tela.

---

## Ordem de ataque sugerida

1. **Container e cabeçalho de página compartilhados** (Achados 1, 3 e 8). Uma peça resolve largura,
   margem, posição do botão, eyebrow e subtítulo de uma vez, em todas as telas.
2. **Botão primário único** (Achado 2), extraindo o que já existe no site para um módulo comum.
3. **Componente de estado vazio** (Achado 5) — é o que a usuária nova mais vê.
4. **Cartões do Assinar** (Achado 6) — pequeno, isolado, e é a tela que converte.
5. **Fraunces de volta ao lugar** (Achado 4).
6. **Convergir a linguagem de bloqueio** (Achado 7).

Os itens 1 e 2 sozinhos resolvem a maior parte da sensação de "cada tela é de um produto".

## Nota de honestidade sobre o método

Esta análise vale para o que foi visto. Onze das quatorze telas estavam vazias, então **quase nada
aqui é sobre proporção com conteúdo real** — e a experiência do Painel mostrou que é justamente aí
que moram os piores defeitos (um cartão de 1.328px ao lado de um de 258px). Para fechar de verdade,
faltam duas coisas: uma conta com dados nas telas pagas, e as 10 telas que não consegui abrir.
