# Auditoria SEO editorial · 7 rascunhos do blog da Pólia

> Diagnóstico apenas. Nenhum artigo, banco de dados, arquivo de código ou commit foi alterado.
> Fonte: consulta `SELECT` de leitura na tabela `blog_posts` (projeto Supabase "Pólia"), 15/09/2026.
> Nenhum dado de volume de busca, CPC, dificuldade de palavra-chave ou SERP real foi usado — não há ferramenta de keyword research nem acesso a resultado de busca real neste ambiente. Onde a informação depende disso, está escrito "Sem dados de volume disponíveis no ambiente atual." ou "SERP não verificada no ambiente atual."

---

## 1. Os 7 artigos (confirmação)

Confirmado: existem exatamente **7 linhas** na tabela `blog_posts`, todas com `publicado = false` (rascunho), todas criadas no mesmo timestamp (`2026-09-08 02:25:06`, ou seja, geradas/importadas no mesmo lote), nenhuma publicada, nenhuma alterada nesta auditoria.

| # | Título | Slug | Categoria | Tamanho (caracteres / palavras aprox.) | Tempo de leitura | Capa |
|---|---|---|---|---|---|---|
| 1 | Como saber se uma ideia de negócio tem potencial | `como-saber-se-uma-ideia-de-negocio-tem-potencial` | Validação de ideia | 3.362 / ~550 | 3 min | Ausente |
| 2 | O que fazer com uma ideia que ainda não tenho certeza se funciona | `o-que-fazer-com-uma-ideia-que-ainda-nao-tenho-certeza-se-funciona` | Validação de ideia | 2.408 / ~395 | 2 min | Ausente |
| 3 | Minha empresa vende, mas não sai do lugar | `minha-empresa-vende-mas-nao-sai-do-lugar` | Gestão financeira | 2.551 / ~420 | 2 min | Ausente |
| 4 | Faturamento não é o mesmo que dinheiro que sobra | `faturamento-nao-e-o-mesmo-que-dinheiro-que-sobra` | Gestão financeira | 1.974 / ~325 | 2 min | Ausente |
| 5 | Como definir o preço de um produto sem copiar a concorrência | `como-definir-o-preco-de-um-produto-sem-copiar-a-concorrencia` | Precificação | 2.133 / ~350 | 2 min | Ausente |
| 6 | Como se organizar quando você é a empresa inteira | `como-se-organizar-quando-voce-e-a-empresa-inteira` | Organização | 2.214 / ~365 | 2 min | Ausente |
| 7 | Como saber o que merece atenção primeiro | `como-saber-o-que-merece-atencao-primeiro` | Organização | 2.068 / ~340 | 2 min | Ausente |

Todos os 7 têm resumo preenchido, categoria preenchida, slug único, nenhum duplicado. **Nenhum tem capa.** Nenhum publicado nesta auditoria.

**Achado estrutural que vale registrar antes das fichas individuais**, porque se repete nos 7: todos usam **só `##` (H2)**, nenhum `###` (H3); nenhum usa lista (`-`/`1.`), negrito (`**`), link ou imagem dentro do markdown; e **todos os 7 terminam com a mesma fórmula retórica** — uma frase no molde "X não é/precisa A. É/Precisa B." (ex.: "Uma ideia não precisa estar perfeita. Precisa ser confrontada com a realidade.", "Seu negócio não precisa apenas vender. Você precisa saber o que cada venda deixa."). É estilisticamente consistente, mas a repetição literal do mesmo molde nos 7 textos é o maior sinal de geração em lote — volto a isso na seção 10.

---

## 2. Ficha SEO por artigo

------------------------------------------
### ARTIGO 1 — Como saber se uma ideia de negócio tem potencial
------------------------------------------

**Título atual:** Como saber se uma ideia de negócio tem potencial
**Slug atual:** `como-saber-se-uma-ideia-de-negocio-tem-potencial`
**Categoria:** Validação de ideia
**Resumo atual:** "Ter uma ideia é fácil. Descobrir se ela resolve um problema real de alguém disposto a pagar por isso é outra história. Um guia prático para testar o potencial de uma ideia antes de construir tudo."
**Tamanho aproximado:** ~550 palavras / 3.362 caracteres
**Tempo de leitura:** 3 min
**Intenção editorial atual:** Ajudar quem tem uma ideia de negócio a descobrir, antes de investir tempo/dinheiro, se existe um problema real e um público disposto a pagar por ela.

**INTENÇÃO DE BUSCA**
Quem busca isso normalmente quer um método pra não gastar meses construindo algo que ninguém vai comprar. **Informacional**, com leve inclinação a **Mista** (parte do público que busca isso está a poucos passos de decidir e testar algo na prática, não só ler sobre o assunto).

**PALAVRA-CHAVE PRINCIPAL**
"Como saber se uma ideia de negócio tem potencial" / "como validar uma ideia de negócio". Sem dados de volume disponíveis no ambiente atual.

**PALAVRAS-CHAVE / INTENÇÕES SECUNDÁRIAS**
- validar ideia de negócio antes de investir
- como saber se vale a pena abrir um negócio
- ideia de negócio vai dar certo
- como testar uma ideia sem gastar dinheiro
- problema real vs ideia que parece boa
- disposição para pagar (willingness to pay)

**SERP / INTENÇÃO**
Provavelmente concorre com artigo explicativo + checklist de validação. SERP não verificada no ambiente atual.

**POTENCIAL SEO: MÉDIO.**
A intenção é clara e específica, e o texto responde bem a ela em nível conceitual. O que segura o potencial é a falta de qualquer exemplo concreto, exercício aplicável ou ferramenta anexada (o texto fica inteiramente no "pense sobre" e nunca chega ao "faça isso"), o que é comum em blogs genéricos do mesmo tema — o diferencial da Pólia (voz prática, número primeiro) não aparece aqui.

**RISCO DE CANIBALIZAÇÃO**
- **Home: NENHUM.** A Home fala pra quem já vende ou já sabe o que vai vender; não compete pela intenção "ainda estou validando se devo começar".
- **Sobre: NENHUM.** É história da fundadora, não conteúdo de validação.
- **Blog (listagem): NENHUM** (a listagem não compete por intenção de busca própria).
- **Artigo 2 ("O que fazer com uma ideia que ainda não tenho certeza"): ALTO.** Os dois artigos respondem, na prática, à mesma pergunta de fundo ("minha ideia é boa o suficiente pra seguir?") em dois títulos diferentes. Não é sobreposição de palavra — é sobreposição de intenção: alguém que busca um dos dois provavelmente ficaria satisfeito com o outro também.
- **Outros artigos: NENHUM.**

**QUAL É O PAPEL DESSE ARTIGO?**
**B. Cluster** (é o mais abrangente dos dois de "Validação de ideia", funcionando quase como a porta de entrada do par).

**ESTRUTURA ATUAL**
Introdução direta (1 parágrafo) + 8 H2, cada um com 1 parágrafo curto, fechando com a frase-síntese. Funciona: progressão lógica clara (da dúvida geral até "sinais de que vale continuar" e "quando a resposta é não"). Falta: nenhuma lista real (a seção "sinais de que vale continuar" é claramente uma lista de 5 itens, mas está escrita como frase corrida — perde escaneabilidade e potencial de snippet), nenhum exemplo concreto de um negócio real, nenhuma pergunta que a leitora possa "responder" ativamente (é só leitura passiva), nenhum link, nenhuma imagem. Não sobra nada — é enxuto ao ponto de faltar substância.

**PROFUNDIDADE: PRECISA EXPANDIR.**
Não pelo tamanho (500 palavras pode ser suficiente pra esse tipo de conteúdo), mas porque a intenção de busca ("como saber se minha ideia tem potencial") pede pelo menos um exemplo de aplicação — hoje o texto ensina o raciocínio mas não mostra ele em ação nenhuma vez.

**EXPERIÊNCIA REAL**
Não há nenhum exemplo concreto, número, situação nomeada ou observação da Sil. O texto usa exemplos hipotéticos genéricos ("a dona de uma loja que fecha o caixa", "quem vende pelo Instagram") sem nenhuma marca de vivência real por trás — poderiam estar em qualquer blog de empreendedorismo.

**E-E-A-T**
Conhecimento: presente (o raciocínio está correto e bem encadeado). Experiência: ausente (zero vivência real demonstrada). Autoridade: não reforçada (nenhuma menção a quem escreve, à Pólia, ou a qualquer credencial). Confiança: neutra (não promete nada irreal, mas também não constrói prova).

**LINKS INTERNOS**
Contextualmente real: link pro Artigo 2 (continuação natural do raciocínio). Possível, mas hoje sem frase de ponte no texto: menção a `/sobre` (a própria trajetória da Sil passou por testar mais de uma ideia — cosmético, papelaria, planner — antes de achar o que ficou). Não recomendo link pra Home/produto aqui: quem ainda valida se deve começar não é o público que a calculadora de preço ou o Planejamento resolve hoje.

**CTA**
O CTA atual (padrão do site, igual em todo post: "a Pólia mostra quanto sobra... Quero ver se dá lucro") **não faz muito sentido depois deste texto**: fala de "sua própria venda", mas quem lê este artigo pode nem ter uma venda ainda. Não interrompe a leitura (vem só no fim), mas é genérico demais pro estágio de quem está aqui. Intenção ideal de CTA: algo que reconheça que ainda é cedo pra "quanto sobra" e ofereça o próximo passo certo (ex.: quando a ideia estiver mais clara, ver a Pólia).

**TITLE SEO**
Title atual: Como saber se uma ideia de negócio tem potencial
Title SEO sugerido: Sua ideia de negócio tem potencial? Como saber
Motivo: o atual já é bom, mas com o sufixo automático " · Blog · Pólia" passa de 60 caracteres no total; a versão sugerida mantém a intenção e a palavra-chave e fica mais curta.

**META DESCRIPTION**
"Ter uma ideia é fácil. Descobrir se ela resolve um problema real de alguém disposto a pagar é outra história. Como testar isso antes de construir tudo." (151 caracteres)

**H1**
**MANTER.** O H1 herda o título e já é direto e específico.

**H2 / H3 (arquitetura proposta)**
```
H1  Como saber se uma ideia de negócio tem potencial
H2  Ter uma boa ideia não é suficiente
H2  Comece pelo problema
  H3  Ele acontece com frequência?
  H3  Ele realmente incomoda?
H2  Quem tem esse problema, de verdade?
H2  Existe disposição para pagar?
H2  O que já existe no mercado?
H2  Como testar sem construir tudo
  H3  Formas de testar com baixo custo
H2  Sinais de que vale continuar
H2  E quando a resposta é não?
```

**FEATURED SNIPPET**
Potencial real em formato de lista: a seção "Sinais de que vale continuar" já enumera 5 sinais dentro de uma frase corrida — se virasse uma lista de fato (`<ul>`), tem potencial de snippet de lista pra "sinais de que uma ideia de negócio tem potencial".

**SCHEMA**
`BlogPosting`. Não há estrutura de pergunta-resposta nem passo a passo numerado suficiente pra `FAQPage`/`HowTo` hoje.

**DECISÃO: PUBLICAR APÓS REVISÃO SEO.**
O raciocínio é sólido e a intenção de busca é clara, mas o texto precisa de pelo menos 1 exemplo real (mesmo que anonimizado) pra sair do genérico, e a lista de "sinais" merece virar lista de verdade. Title e meta description valem ajuste antes de publicar.

------------------------------------------
### ARTIGO 2 — O que fazer com uma ideia que ainda não tenho certeza se funciona
------------------------------------------

**Título atual:** O que fazer com uma ideia que ainda não tenho certeza se funciona
**Slug atual:** `o-que-fazer-com-uma-ideia-que-ainda-nao-tenho-certeza-se-funciona`
**Categoria:** Validação de ideia
**Resumo atual:** "Incerteza não é sinal de que a ideia é ruim, é sinal de que faltam informações. Como transformar uma ideia em hipótese testável e decidir quando insistir ou mudar de rota."
**Tamanho aproximado:** ~395 palavras / 2.408 caracteres
**Tempo de leitura:** 2 min
**Intenção editorial atual:** Dar um método pra reduzir a incerteza sobre uma ideia sem precisar construir o negócio inteiro primeiro.

**INTENÇÃO DE BUSCA**
Quem chega aqui já tem uma ideia e está travada pela dúvida — quer permissão/método pra agir apesar da incerteza. **Informacional.**

**PALAVRA-CHAVE PRINCIPAL**
"O que fazer quando não tenho certeza se minha ideia de negócio funciona". Sem dados de volume disponíveis no ambiente atual.

**PALAVRAS-CHAVE / INTENÇÕES SECUNDÁRIAS**
- transformar ideia em hipótese testável
- como testar uma ideia de negócio pequena
- medo de começar um negócio
- MVP pra pequeno negócio (conceito, não o termo em si)
- quando desistir de uma ideia de negócio
- validar ideia sem gastar dinheiro

**SERP / INTENÇÃO**
Provavelmente concorre com artigo explicativo + guia de "teste antes de construir". SERP não verificada no ambiente atual.

**POTENCIAL SEO: MÉDIO, com ressalva.**
A intenção existe e é real, mas ela está muito próxima da intenção do Artigo 1 — o potencial individual de cada um é reduzido pela sobreposição do outro (ver canibalização).

**RISCO DE CANIBALIZAÇÃO**
- **Home / Sobre / Blog: NENHUM**, mesmo raciocínio do Artigo 1.
- **Artigo 1: ALTO** (ver ficha do Artigo 1 — é a mesma relação, nos dois sentidos).
- **Outros artigos: NENHUM.**

**QUAL É O PAPEL DESSE ARTIGO?**
**C. Cauda longa** dentro do cluster "Validação de ideia" — mais específico que o Artigo 1 (foca no momento exato da dúvida, não na validação em si).

**ESTRUTURA ATUAL**
Introdução (1 parágrafo) + 7 H2 curtos. Funciona: a progressão "pare de decidir tudo de uma vez → transforme em hipótese → converse → teste → observe → mude se precisar → defina critério antes" é um funil lógico limpo. Falta: exemplo real, uma pergunta-modelo pronta pra copiar (o texto até menciona "perguntar 'como você resolve isso hoje?' revela mais" — isso poderia virar um pequeno roteiro de 3 perguntas prontas, e não vira). Nenhuma lista, link ou imagem. Não sobra nada.

**PROFUNDIDADE: PRECISA EXPANDIR.**
Mesma lógica do Artigo 1: a extensão está adequada ao tom, mas falta pelo menos um roteiro prático (as perguntas "certas" vs "erradas" pra fazer, por exemplo) pra virar algo acionável, não só conceitual.

**EXPERIÊNCIA REAL**
Ausente. Mesmo padrão do Artigo 1 — nenhum exemplo nomeado, nenhuma situação real, nenhuma voz de quem já passou por isso.

**E-E-A-T**
Mesma leitura do Artigo 1: conhecimento presente, experiência ausente, autoridade não reforçada, confiança neutra.

**LINKS INTERNOS**
Contextualmente real: link pro Artigo 1 (é o par do cluster, e a ordem de leitura natural provavelmente é 1 → 2). Não recomendo link pro produto ainda pelo mesmo motivo do Artigo 1 — quem está devendo se a ideia funciona não é o público de "organize o negócio que já roda".

**CTA**
Mesmo problema do Artigo 1: o CTA padrão fala de "sua própria venda" e "quanto sobra", que pressupõe negócio rodando — descasa do estágio de quem está lendo isso. Não é agressivo nem interrompe, só não é a oferta certa.

**TITLE SEO**
Title atual: O que fazer com uma ideia que ainda não tenho certeza se funciona
Title SEO sugerido: O que fazer quando você não tem certeza da sua ideia
Motivo: o atual soma 65 caracteres sozinho (80 com o sufixo do site) — longo demais e meio labiríntico de ler num resultado de busca. A versão sugerida é mais direta sem perder a intenção.

**META DESCRIPTION**
"Incerteza não é sinal de ideia ruim, é sinal de que faltam informações. Veja como transformar a dúvida em teste real, sem montar o negócio inteiro antes." (153 caracteres)

**H1**
**AJUSTAR.** Não porque está errado, mas porque é longo pro papel de H1 (mais natural como pergunta direta). Sugestão única: "Não tenho certeza se minha ideia funciona. E agora?"

**H2 / H3 (arquitetura proposta)**
```
H1  Não tenho certeza se minha ideia funciona. E agora?
H2  Pare de tentar decidir tudo de uma vez
H2  Transforme a ideia em hipótese
H2  Converse com pessoas reais
  H3  Perguntas que revelam mais do que "você compraria isso?"
H2  Teste a menor versão possível
H2  Observe o que as pessoas fazem (não o que elas dizem)
H2  Mudar de ideia faz parte
H2  Quando insistir e quando parar
```

**FEATURED SNIPPET**
Potencial de "pergunta e resposta direta" pra algo como "como testar uma ideia de negócio antes de investir" — o parágrafo de "teste a menor versão possível" já é quase uma resposta pronta de snippet.

**SCHEMA**
`BlogPosting`.

**DECISÃO: PUBLICAR APÓS REVISÃO SEO.**
Texto correto e bem escrito, mas a sobreposição forte com o Artigo 1 pede uma decisão editorial antes de publicar os dois: ou diferenciar mais claramente a intenção de cada um (título/ângulo), ou fundir os dois num artigo mais completo. Publicar os dois como estão, lado a lado, é o cenário de maior risco de canibalização de todo o lote.

------------------------------------------
### ARTIGO 3 — Minha empresa vende, mas não sai do lugar
------------------------------------------

**Título atual:** Minha empresa vende, mas não sai do lugar
**Slug atual:** `minha-empresa-vende-mas-nao-sai-do-lugar`
**Categoria:** Gestão financeira
**Resumo atual:** "Vender todo dia e sentir que o negócio não sai do lugar é mais comum do que parece. Veja onde costuma estar o gargalo quando o problema não é falta de venda."
**Tamanho aproximado:** ~420 palavras / 2.551 caracteres
**Tempo de leitura:** 2 min
**Intenção editorial atual:** Mostrar que "vender mais" não resolve um problema que está na operação, no preço ou na rotina — ajudar a achar o gargalo real.

**INTENÇÃO DE BUSCA**
Frustração de quem vende e não vê o negócio crescer — quer entender por quê. **Informacional**, com leve inclinação **Comercial** (é o tipo de busca que antecede a procura por uma ferramenta de gestão/financeiro).

**PALAVRA-CHAVE PRINCIPAL**
"Minha empresa vende mas não cresce" / "vendo bastante e não sobra dinheiro". Sem dados de volume disponíveis no ambiente atual.

**PALAVRAS-CHAVE / INTENÇÕES SECUNDÁRIAS**
- por que o negócio não sai do lugar mesmo vendendo
- vender muito e não sobrar dinheiro
- gargalo no negócio
- faturar bem e não crescer
- ocupada o dia inteiro e sem resultado
- onde o dinheiro da venda está indo

**SERP / INTENÇÃO**
Artigo explicativo com autodiagnóstico (lista de perguntas). SERP não verificada no ambiente atual.

**POTENCIAL SEO: ALTO.**
A intenção é específica, emocionalmente reconhecível (a frustração de "vender e não ver resultado" é exatamente o problema central que a própria Pólia existe pra resolver) e o texto já entrega um raciocínio útil sem enrolar. É o artigo mais alinhado ao "chão" da marca dentre os 7.

**RISCO DE CANIBALIZAÇÃO**
- **Home: BAIXO.** A Home também fala de "vender e não saber quanto sobra", mas como página de produto/conversão (intenção transacional/branded); o artigo é informacional puro sobre a mesma dor. São a mesma dor, intenções de busca diferentes — não é o mesmo "lugar" no funil. Vale como funil (artigo → Home), não como concorrência.
- **Sobre: NENHUM.**
- **Artigo 4 (Faturamento não é dinheiro que sobra): MÉDIO.** Os dois tratam da mesma dor central (vender não é o mesmo que lucrar) por ângulos diferentes — este é mais sobre "operação/gargalo", o outro é mais "definição financeira". Não são a mesma busca, mas competem pela mesma atenção; publicar os dois pede diferenciação clara de título/ângulo (o que já existe, mas vale reforçar com link cruzado em vez de deixá-los como concorrentes silenciosos).
- **Artigo 7 (o que merece atenção primeiro): BAIXO** — ambos tocam "identificar o que trava", mas um é financeiro e o outro é sobre rotina/priorização geral; complementares, não concorrentes.

**QUAL É O PAPEL DESSE ARTIGO?**
**A. Pilar** (dentro do cluster "Gestão financeira", é o mais alinhado à dor central da marca e o mais forte candidato a página que atrai e depois direciona pro produto).

**ESTRUTURA ATUAL**
Introdução + 7 H2. Funciona muito bem: nomeia a confusão comum ("faturamento sobe, aperto continua"), lista o que consome o resultado, e fecha com 4 perguntas pra fazer "essa semana" — é o artigo mais "acionável" dos 7 mesmo sem lista formal. Falta: nenhum número, nenhuma faixa de referência (mesmo sem inventar dado real, o texto poderia usar um exemplo hipotético com valores, ex.: "vendeu R$ 3.000, sobrou R$ 400" pra ilustrar sem afirmar isso como fato do mercado). As "perguntas para fazer esta semana" já são uma lista de 4 perguntas escrita em prosa — mesma perda de escaneabilidade do Artigo 1.

**PROFUNDIDADE: PRECISA EXPANDIR.**
Não em tamanho — em exemplo. É o artigo onde a ausência de um número concreto dói mais, porque o tema é literalmente "para onde vai o dinheiro da venda".

**EXPERIÊNCIA REAL**
Ausente — sem exemplo nomeado, sem número, sem situação real descrita. O texto fala fluentemente sobre a dor mas nunca a materializa numa cena concreta.

**E-E-A-T**
Conhecimento: presente e bem articulado. Experiência: ausente. Autoridade: não reforçada (nenhuma conexão com a trajetória real da Sil, que em `/sobre` conta ter vivido exatamente essa sensação — "cada fase vendia, o fundo é que nunca fechava" — e este artigo nunca faz essa ponte). Confiança: neutra.

**LINKS INTERNOS**
Contextualmente forte: **Home**, especificamente a seção "Quanto sobra de verdade?" (a calculadora) — é a resposta natural pra quem termina este artigo perguntando "e como eu descubro isso no meu negócio?". Também: Artigo 4 (mesma cluster, ângulo complementar) e Artigo 7 (gargalo/priorização).

**CTA**
O CTA padrão do site ("a Pólia mostra quanto sobra... quero ver se dá lucro") é o que **melhor se encaixa** dos 7 artigos — a promessa do CTA responde exatamente a pergunta que o texto deixa em aberto. Não interrompe, não é agressivo, é o caso de maior coerência natural entre conteúdo e oferta.

**TITLE SEO**
Title atual: Minha empresa vende, mas não sai do lugar
Title SEO sugerido: manter — já está no tamanho certo (41 caracteres, 56 com sufixo) e comunica a dor com precisão.
Motivo: qualquer tentativa de "otimizar" a palavra-chave aqui perderia a voz — o título já soa como algo que a própria empreendedora diria.

**META DESCRIPTION**
"Vender todo dia e sentir que o negócio não sai do lugar é mais comum do que parece. Veja onde costuma estar o gargalo quando o problema não é falta de venda." (157 caracteres — já está boa, não precisa mudar).

**H1**
**MANTER.**

**H2 / H3 (arquitetura proposta)**
```
H1  Minha empresa vende, mas não sai do lugar
H2  Vender e avançar são coisas diferentes
H2  Quando o faturamento cresce, mas o aperto continua
H2  O que está consumindo o resultado?
  H3  Custos que aumentaram sem você perceber
  H3  Descontos dados na pressão do momento
H2  Ocupada não é o mesmo que avançando
H2  O que cada venda realmente deixa?
H2  Encontre o gargalo antes de tentar vender mais
H2  Perguntas para fazer esta semana
```

**FEATURED SNIPPET**
Alto potencial: "Perguntas para fazer esta semana" é uma lista de 4 perguntas prontas pra virar snippet de lista pra buscas tipo "por que meu negócio não sai do lugar mesmo vendendo".

**SCHEMA**
`BlogPosting`.

**DECISÃO: PUBLICAR APÓS PEQUENOS AJUSTES.**
É um dos dois artigos mais fortes do lote. Precisa só: transformar a lista de perguntas em lista real, considerar (sem inventar) um exemplo numérico ilustrativo, e adicionar o link pra Home. Não precisa reestruturação.

------------------------------------------
### ARTIGO 4 — Faturamento não é o mesmo que dinheiro que sobra
------------------------------------------

**Título atual:** Faturamento não é o mesmo que dinheiro que sobra
**Slug atual:** `faturamento-nao-e-o-mesmo-que-dinheiro-que-sobra`
**Categoria:** Gestão financeira
**Resumo atual:** "Faturar alto não é o mesmo que sobrar dinheiro no fim do mês. Entenda a diferença entre o que entra e o que realmente fica depois de descontar tudo o que a venda consumiu."
**Tamanho aproximado:** ~325 palavras / 1.974 caracteres
**Tempo de leitura:** 2 min
**Intenção editorial atual:** Explicar a diferença entre faturamento e lucro/sobra, e mudar a pergunta de "quanto vendi" para "quanto essa venda deixou".

**INTENÇÃO DE BUSCA**
Busca clássica e recorrente no universo de gestão financeira pra pequeno negócio: "faturamento e lucro são a mesma coisa?". **Informacional**, tipicamente uma busca definicional/didática.

**PALAVRA-CHAVE PRINCIPAL**
"Diferença entre faturamento e lucro". Sem dados de volume disponíveis no ambiente atual (mas é um formato de pergunta muito comum no universo de educação financeira pra pequenos negócios, mesmo sem número de busca confirmável aqui).

**PALAVRAS-CHAVE / INTENÇÕES SECUNDÁRIAS**
- faturamento x lucro
- faturar muito e não sobrar dinheiro
- o que é lucro líquido pequeno negócio
- quanto realmente sobra de uma venda
- separar dinheiro do negócio do dinheiro pessoal

**SERP / INTENÇÃO**
Tipicamente concorre com artigo explicativo/definicional, às vezes com uma calculadora simples embutida. SERP não verificada no ambiente atual.

**POTENCIAL SEO: ALTO.**
É a pergunta mais "cabeçalho de categoria" dos 7 — clara, definicional, universal dentro do público de pequenos negócios, e diretamente alinhada ao eixo "número primeiro" da marca.

**RISCO DE CANIBALIZAÇÃO**
- **Home: BAIXO** (mesma lógica do Artigo 3 — dor compartilhada, intenção de busca diferente; a Home não visa ranquear pela pergunta definicional "faturamento x lucro", ela converte quem já quer resolver isso).
- **Artigo 3: MÉDIO** (ver ficha do Artigo 3).
- **Outros: NENHUM.**

**QUAL É O PAPEL DESSE ARTIGO?**
**A. Pilar** — é o candidato mais forte a "página de referência" do cluster financeiro, e também o artigo com maior alinhamento a "D. Marca/autoridade" (é literalmente a explicação do princípio "o número abre" em texto).

**ESTRUTURA ATUAL**
Introdução + 6 H2, o mais curto dos 7. Funciona: é enxuto e direto, sem enrolação, e a pergunta central ("quanto essa venda deixou, depois de tudo?") é forte o suficiente pra carregar o texto sozinha. Falta: um exemplo numérico (mesmo hipotético e claramente identificado como exemplo, não como dado real) faria toda a diferença aqui — é o artigo onde a ausência de número é mais contraditória com o próprio argumento do texto.

**PROFUNDIDADE: PRECISA EXPANDIR — mas não em tamanho, em prova.**
325 palavras seriam suficientes SE o texto mostrasse a conta uma vez. Hoje ele descreve a existência da conta sem nunca fazê-la.

**EXPERIÊNCIA REAL**
Ausente. Nenhum número, nenhuma situação, nenhuma cena.

**E-E-A-T**
Conhecimento: presente. Experiência: ausente — e aqui pesa mais, porque é justamente o tema em que a Sil tem experiência real e citada em `/sobre` ("vendia bem e não sabia quanto sobrava"), e o artigo nunca usa essa voz. Autoridade: não reforçada. Confiança: neutra.

**LINKS INTERNOS**
Contextualmente forte: **Home** (seção "Quanto sobra de verdade?"), Artigo 3 (mesma cluster), Artigo 5 (preço — a lógica de "o que sai antes do resultado" conecta direto com precificação).

**CTA**
Mesmo caso do Artigo 3: o CTA padrão encaixa muito bem aqui — "a Pólia mostra quanto sobra" é resposta direta à pergunta que fecha o artigo.

**TITLE SEO**
Title atual: Faturamento não é o mesmo que dinheiro que sobra
Title SEO sugerido: manter — já comunica a intenção com clareza e tem boa chance de casar com a forma como a pergunta é feita de verdade.
Motivo: qualquer versão "otimizada" (ex.: "Faturamento x Lucro: entenda a diferença") soa mais genérica e menos "voz Pólia" do que o atual.

**META DESCRIPTION**
"Faturar alto não é o mesmo que sobrar dinheiro no fim do mês. A diferença entre o que entra e o que realmente fica depois de descontar tudo que a venda gastou." (159 caracteres)

**H1**
**MANTER.**

**H2 / H3 (arquitetura proposta)**
```
H1  Faturamento não é o mesmo que dinheiro que sobra
H2  O número que parece sucesso
H2  O que sai antes de chegar ao resultado
  H3  Custos diretos da venda
  H3  O tempo também é custo
H2  O problema de olhar só para o preço
H2  A pergunta que muda a análise
H2  Como começar a enxergar melhor
  H3  Separe o dinheiro do negócio do dinheiro pessoal
```

**FEATURED SNIPPET**
Alto potencial para snippet de "definição" (faturamento x lucro) e para lista ("o que sai antes de chegar ao resultado" já enumera: material, embalagem, taxas, frete, comissão, operação — daria uma lista de 6 itens).

**SCHEMA**
`BlogPosting`. Se um exemplo numérico for adicionado no formato "passo a passo de cálculo", pode evoluir pra candidato a `HowTo` no futuro — hoje, como está, `BlogPosting` é o correto.

**DECISÃO: PUBLICAR APÓS PEQUENOS AJUSTES.**
Junto com o Artigo 3, é o mais forte do lote e o mais alinhado ao core da marca. Precisa de um exemplo numérico ilustrativo e da lista de custos formatada como lista — fora isso, está pronto.

------------------------------------------
### ARTIGO 5 — Como definir o preço de um produto sem copiar a concorrência
------------------------------------------

**Título atual:** Como definir o preço de um produto sem copiar a concorrência
**Slug atual:** `como-definir-o-preco-de-um-produto-sem-copiar-a-concorrencia`
**Categoria:** Precificação
**Resumo atual:** "Copiar o preço do concorrente parece um atalho seguro, mas esconde riscos. Um passo a passo para precificar a partir dos seus próprios custos e do valor que você entrega."
**Tamanho aproximado:** ~350 palavras / 2.133 caracteres
**Tempo de leitura:** 2 min
**Intenção editorial atual:** Argumentar contra copiar preço da concorrência e orientar a precificar a partir do próprio custo + valor percebido.

**INTENÇÃO DE BUSCA**
Quem busca isso quer um método pra precificar sem simplesmente olhar o concorrente — geralmente já tentou isso e não confia mais no resultado. **Informacional**, com forte componente **Comercial** (é a busca mais "a um passo de usar uma calculadora" dos 7).

**PALAVRA-CHAVE PRINCIPAL**
"Como precificar um produto sem copiar concorrente" / "como definir o preço do meu produto". Sem dados de volume disponíveis no ambiente atual.

**PALAVRAS-CHAVE / INTENÇÕES SECUNDÁRIAS**
- como calcular o preço de venda
- preço baseado em custo vs valor percebido
- copiar preço da concorrência é errado?
- como precificar sem planilha complicada
- o que o cliente está realmente comprando

**SERP / INTENÇÃO**
Tende a concorrer com artigo tutorial e, principalmente, com **calculadora** — quem busca isso frequentemente já está procurando uma ferramenta, não só teoria. SERP não verificada no ambiente atual.

**POTENCIAL SEO: ALTO.**
Intenção específica, alto potencial comercial, e — mais importante — é o artigo com a ponte mais natural e honesta pro produto real da Pólia (a calculadora de preço já existe na Home).

**RISCO DE CANIBALIZAÇÃO**
- **Home: BAIXO.** A seção "Preço" da Home fala do resultado (quanto sobra) mais do que do método de precificar em si; o artigo ensina o raciocínio que antecede usar a calculadora. Complementar, não concorrente.
- **Artigo 4: BAIXO** (toca preço de raspão, mas o foco de cada um é diferente — um é definição financeira, outro é método de precificação).
- **Outros: NENHUM.**

**QUAL É O PAPEL DESSE ARTIGO?**
**E. Lead magnet / ponte para produto** — de todos os 7, é o que mais naturalmente conduz pra uma funcionalidade específica (calculadora de preço), sem forçar.

**ESTRUTURA ATUAL**
Introdução + 6 H2. Funciona: a lógica "não copie → comece pelo seu custo → não esqueça seu tempo → preço não é só custo → entenda o que o cliente compra → teste" é um roteiro quase pronto pra virar passo a passo numerado. Falta: exatamente por estar tão perto de um "how to", a ausência de qualquer número ou fórmula simples (nem que ilustrativa) chama atenção — é o artigo mais fácil de imaginar como HowTo estruturado no futuro.

**PROFUNDIDADE: PRECISA REESTRUTURAR.**
Diferente dos outros (que precisam só de expansão pontual), este tem estrutura natural de tutorial que hoje está escondida em prosa corrida. Reestruturar em passos (sem necessariamente aumentar o texto) aumentaria muito a utilidade percebida.

**EXPERIÊNCIA REAL**
Ausente — sem número, sem exemplo de categoria de produto, sem situação real.

**E-E-A-T**
Conhecimento: presente. Experiência: ausente. Autoridade: não reforçada (a Sil tem experiência real em precificação de produto físico artesanal, citada em `/sobre` — papelaria, planner — e o artigo não usa nada disso). Confiança: neutra.

**LINKS INTERNOS**
Contextualmente forte: **Home**, seção "Quanto sobra de verdade?"/calculadora (é a ferramenta que resolve exatamente o que o artigo ensina a pensar). Também Artigo 4 (mesma lógica de custo).

**CTA**
O CTA padrão funciona bem aqui, mas é o artigo onde um CTA mais específico ("veja a calculadora de preço da Pólia" em vez do genérico "quero ver se dá lucro") teria o encaixe mais natural e menos forçado dos 7 — não é uma questão de estar errado, é uma oportunidade de precisão.

**TITLE SEO**
Title atual: Como definir o preço de um produto sem copiar a concorrência
Title SEO sugerido: Como definir o preço sem copiar a concorrência
Motivo: o atual soma 60 caracteres sozinho (75 com sufixo); tirar "de um produto" (a ideia já está implícita) encurta sem perder sentido.

**META DESCRIPTION**
"Copiar o preço da concorrência parece um atalho seguro, mas esconde riscos. Veja como precificar a partir dos seus custos reais e do valor que você entrega." (156 caracteres)

**H1**
**MANTER.**

**H2 / H3 (arquitetura proposta)**
```
H1  Como definir o preço de um produto sem copiar a concorrência
H2  Por que copiar o concorrente pode ser perigoso
H2  Comece pelos seus próprios custos
  H3  Materiais, embalagem, taxas e frete
H2  Não esqueça o seu tempo
H2  Preço não é só custo mais uma fatia por cima
H2  O que o cliente está realmente comprando?
H2  Teste e observe
```

**FEATURED SNIPPET**
Alto potencial de "passo a passo" se reestruturado (ver Profundidade) — hoje, mesmo em prosa, "por que copiar o concorrente pode ser perigoso" já lista 3 razões (custo diferente, volume diferente, pode estar cobrando errado) com potencial de snippet de lista.

**SCHEMA**
`BlogPosting` hoje. **Candidato natural a `HowTo`** se o conteúdo for reestruturado em passos numerados explícitos — não implementar isso sem antes reescrever a estrutura de fato (schema tem que refletir o conteúdo real, não maquiar).

**DECISÃO: REESTRUTURAR.**
É o artigo com maior potencial estratégico do lote (ponte real pro produto) e o único onde recomendo reestruturação de formato (não de conteúdo/voz) antes de publicar — transformar a lógica em passos claros aumenta muito o valor sem mudar uma palavra da voz da Pólia.

------------------------------------------
### ARTIGO 6 — Como se organizar quando você é a empresa inteira
------------------------------------------

**Título atual:** Como se organizar quando você é a empresa inteira
**Slug atual:** `como-se-organizar-quando-voce-e-a-empresa-inteira`
**Categoria:** Organização
**Resumo atual:** "Quando você é a empresa inteira, organização deixa de ser detalhe. Um sistema simples para separar informação, decisão e tarefa sem perder o controle do dia a dia."
**Tamanho aproximado:** ~365 palavras / 2.214 caracteres
**Tempo de leitura:** 2 min
**Intenção editorial atual:** Dar um sistema simples (separar informação / decisão / tarefa) pra quem toca o negócio sozinha não perder o controle do dia a dia.

**INTENÇÃO DE BUSCA**
Quem busca isso está sobrecarregada e quer um sistema, não só motivação. **Informacional.**

**PALAVRA-CHAVE PRINCIPAL**
"Como se organizar sendo microempreendedora sozinha" / "organização para quem trabalha sozinha no negócio". Sem dados de volume disponíveis no ambiente atual.

**PALAVRAS-CHAVE / INTENÇÕES SECUNDÁRIAS**
- como organizar a rotina sendo autônoma
- sistema de organização para pequeno negócio
- sobrecarga de quem empreende sozinha
- separar tarefa de decisão
- rotina possível vs rotina perfeita

**SERP / INTENÇÃO**
Tende a concorrer com artigo + checklist/framework simples. SERP não verificada no ambiente atual.

**POTENCIAL SEO: MÉDIO.**
Intenção real e bem definida, mas é um tema mais concorrido de forma genérica (produtividade/organização pra empreendedor é território comum de blogs de produtividade em geral) — o que diferenciaria a Pólia aqui é justamente ligar isso ao Planner/Painel do produto, que o texto não faz.

**RISCO DE CANIBALIZAÇÃO**
- **Home: NENHUM** (a seção "Rotina" da Home fala do Planner como produto; o artigo fala do problema antes de qualquer ferramenta — complementares).
- **Artigo 7: MÉDIO.** Os dois tratam de organização/rotina sob ângulos próximos (separar o que importa do que pode esperar); a diferença é que este é sobre sistema geral (informação/decisão/tarefa) e o Artigo 7 é sobre priorização entre urgências — relacionados, mas com intenção de busca distinguível o suficiente pra não ser alto.
- **Outros: NENHUM.**

**QUAL É O PAPEL DESSE ARTIGO?**
**C. Cauda longa** dentro do cluster "Organização", com potencial de **E. ponte pro Planner** se ganhar uma frase de conexão.

**ESTRUTURA ATUAL**
Introdução + 7 H2. Funciona: o "sistema de 4 perguntas" no fechamento é o ponto mais forte do texto — é literalmente um framework prático, só que enterrado na última seção e escrito em prosa. Falta: as 4 perguntas do sistema deveriam abrir ou fechar como lista destacada, não como frase corrida; falta também qualquer menção a uma ferramenta (mesmo genérica, tipo "um quadro, uma agenda, um caderno") pra separar informação/decisão/tarefa na prática.

**PROFUNDIDADE: SUFICIENTE**, com uma ressalva.
Pro tom de "framework rápido de reorganização mental", 365 palavras bastam. A ressalva é que "suficiente em teoria" não é o mesmo que "aplicável" — falta 1 exemplo de como isso fica na prática (uma tarde real).

**EXPERIÊNCIA REAL**
Ausente — nenhum exemplo, nenhuma cena, nenhuma referência a como a própria Sil organiza (mesmo sendo, segundo `/sobre`, "a primeira usuária do próprio produto").

**E-E-A-T**
Conhecimento: presente. Experiência: ausente. Autoridade: não reforçada. Confiança: neutra.

**LINKS INTERNOS**
Contextualmente real: **Home**, seção "Rotina"/Planner ("Tarefas por prazo, não por pilha") — o artigo descreve exatamente o problema que o Planner resolve. Também Artigo 7 (cluster).

**CTA**
O CTA padrão ("a Pólia mostra quanto sobra... quero ver se dá lucro") **não combina** com este artigo — o tema aqui é rotina/organização, não dinheiro/lucro. É o caso mais claro de descolamento entre CTA genérico e tema do texto entre os 7.

**TITLE SEO**
Title atual: Como se organizar quando você é a empresa inteira
Title SEO sugerido: manter — já é claro e específico; alternativa possível "Como se organizar sendo a empresa inteira" só pra encurtar 8 caracteres, mas não é necessário.
Motivo: título já forte, com voz própria.

**META DESCRIPTION**
"Quando você é a empresa inteira, organização deixa de ser detalhe. Um sistema simples para separar informação, decisão e tarefa sem perder o controle do dia." (157 caracteres)

**H1**
**MANTER.**

**H2 / H3 (arquitetura proposta)**
```
H1  Como se organizar quando você é a empresa inteira
H2  O problema de ter tudo na cabeça
H2  Separe informação, decisão e tarefa
  H3  O que é só informação
  H3  O que exige decisão
  H3  O que é tarefa
H2  O que precisa da sua atenção agora?
H2  Como criar uma rotina possível (não perfeita)
H2  Ocupada não é o mesmo que avançando
H2  Um sistema simples de decisão em 4 perguntas
```

**FEATURED SNIPPET**
Alto potencial: "um sistema simples de decisão" com as 4 perguntas é candidato direto a snippet de lista/passo a passo.

**SCHEMA**
`BlogPosting`.

**DECISÃO: PUBLICAR APÓS PEQUENOS AJUSTES.**
Bom texto, só precisa: destacar as 4 perguntas como lista, e considerar (não obrigatório) 1 frase de ponte pro Planner. CTA genérico do site deveria, idealmente, ter uma variação pra este cluster (fora do escopo desta auditoria, é decisão de código/template).

------------------------------------------
### ARTIGO 7 — Como saber o que merece atenção primeiro
------------------------------------------

**Título atual:** Como saber o que merece atenção primeiro
**Slug atual:** `como-saber-o-que-merece-atencao-primeiro`
**Categoria:** Organização
**Resumo atual:** "Quando tudo parece urgente, decidir por onde começar vira o maior desafio. Um método simples para identificar o que realmente merece atenção primeiro."
**Tamanho aproximado:** ~340 palavras / 2.068 caracteres
**Tempo de leitura:** 2 min
**Intenção editorial atual:** Dar um critério de priorização (dinheiro → cliente → bloqueio → resto) pra quem sente tudo urgente ao mesmo tempo.

**INTENÇÃO DE BUSCA**
Quem busca isso está sobrecarregada por decisões simultâneas e quer um critério, não uma lista de tarefas. **Informacional.**

**PALAVRA-CHAVE PRINCIPAL**
"Como priorizar tarefas no negócio" / "o que fazer primeiro quando tudo é urgente". Sem dados de volume disponíveis no ambiente atual.

**PALAVRAS-CHAVE / INTENÇÕES SECUNDÁRIAS**
- como priorizar quando tudo é urgente
- método de priorização para pequeno negócio
- o que resolver primeiro na empresa
- diferença entre urgente e importante (conceito, sem citar a matriz por nome)
- identificar gargalo no dia a dia

**SERP / INTENÇÃO**
Tende a concorrer com artigo + framework/checklist de priorização. SERP não verificada no ambiente atual.

**POTENCIAL SEO: ALTO.**
Intenção muito clara, universal dentro do público-alvo, e o critério proposto (dinheiro → cliente → bloqueio → resto) é específico o suficiente pra não soar como conteúdo genérico de produtividade — é aplicado ao contexto de quem toca o próprio negócio, não produtividade pessoal genérica.

**RISCO DE CANIBALIZAÇÃO**
- **Home: NENHUM.**
- **Artigo 6: MÉDIO** (ver ficha do Artigo 6).
- **Artigo 3: BAIXO** (ambos mencionam "gargalo", mas em sentidos diferentes: aqui é priorização geral, lá é gargalo financeiro/operacional específico).

**QUAL É O PAPEL DESSE ARTIGO?**
**C. Cauda longa** dentro do cluster "Organização", com potencial de ponte pro Painel/Planner (que já traduz "o que vence hoje").

**ESTRUTURA ATUAL**
Introdução + 7 H2. Funciona: o critério de 4 camadas (dinheiro, cliente, bloqueio, resto) é claro e fácil de lembrar — é o framework mais "citável" do lote. Falta: o critério mereceria aparecer condensado em algum ponto (lista ou destaque), não só espalhado em 4 seções separadas; falta também 1 exemplo do tipo "situação X parece urgente mas não é, situação Y parece pequena mas é bloqueio" pra tornar o critério mais fácil de aplicar.

**PROFUNDIDADE: SUFICIENTE.**
340 palavras bastam pro que o texto se propõe — é direto, sem enrolação, e o critério em si já é a entrega. Expandir aqui só ajudaria se fosse pra ilustrar com exemplo, não pra alongar.

**EXPERIÊNCIA REAL**
Ausente — sem exemplo, sem cena, sem número.

**E-E-A-T**
Conhecimento: presente, e é o critério mais "de negócio" (não genérico de produtividade) do lote — isso já ajuda a autoridade temática. Experiência: ausente. Autoridade: parcialmente reforçada pela especificidade do critério, mas sem nenhuma voz pessoal. Confiança: neutra.

**LINKS INTERNOS**
Contextualmente real: **Home**, seção "Rotina"/Painel ("Quais tarefas vencem hoje" já é quase a mesma pergunta que o artigo responde). Artigo 6 (cluster) e Artigo 3 (menção a "gargalo").

**CTA**
Mesmo problema do Artigo 6: o CTA padrão fala de "quanto sobra"/lucro, e este artigo é sobre priorização de atenção, não sobre dinheiro — descolamento de tema.

**TITLE SEO**
Title atual: Como saber o que merece atenção primeiro
Title SEO sugerido: manter — já é direto, específico e no tamanho certo (40/55 com sufixo).
Motivo: —

**META DESCRIPTION**
"Quando tudo parece urgente, decidir por onde começar vira o maior desafio. Veja um método simples para identificar o que realmente merece atenção primeiro." (155 caracteres — já está boa).

**H1**
**MANTER.**

**H2 / H3 (arquitetura proposta)**
```
H1  Como saber o que merece atenção primeiro
H2  Nem tudo que chama atenção é prioridade
H2  O critério de 4 camadas
  H3  1. Comece pelo dinheiro
  H3  2. Olhe para o cliente
  H3  3. Identifique bloqueios
  H3  4. O que pode esperar
H2  Diferencie problema de desconforto
H2  Decida com contexto, não com uma lista fixa
```

**FEATURED SNIPPET**
Alto potencial: o "critério de 4 camadas" é praticamente um snippet de lista numerada pronto pra buscas do tipo "como priorizar tarefas no meu negócio".

**SCHEMA**
`BlogPosting`. Estrutura em 4 passos é forte candidata a `HowTo` se reformatada como lista numerada explícita (mesma lógica do Artigo 5, com menos ajuste necessário aqui).

**DECISÃO: PUBLICAR APÓS PEQUENOS AJUSTES.**
Um dos textos mais claros do lote. Só precisa: destacar o critério de 4 camadas como lista/numeração visível, e 1 exemplo de aplicação.

---

## 3. Os 7 artigos como conjunto — cobertura temática

```
LUCRO / "QUANTO SOBRA" (eixo central da marca)
├── Artigo 4 — Faturamento não é o mesmo que dinheiro que sobra   (pilar)
├── Artigo 3 — Minha empresa vende, mas não sai do lugar          (cluster, ângulo operacional)
└── oportunidade: nenhum artigo mostra a conta feita (ver P1 na seção 5)

PREÇO
├── Artigo 5 — Como definir o preço sem copiar a concorrência
└── oportunidade: como dar desconto sem perder dinheiro; como saber se uma venda valeu a pena
    (ambas citadas explicitamente no contexto que você trouxe, e nenhum dos 7 artigos cobre)

ORGANIZAÇÃO / ROTINA
├── Artigo 6 — Como se organizar quando você é a empresa inteira
├── Artigo 7 — Como saber o que merece atenção primeiro
└── oportunidade: como saber se pode comprar mais estoque/material agora

VALIDAÇÃO DE IDEIA (pré-negócio)
├── Artigo 1 — Como saber se uma ideia de negócio tem potencial
├── Artigo 2 — O que fazer com uma ideia que ainda não tenho certeza
└── ressalva: este cluster fala com quem AINDA NÃO SABE O QUE VAI VENDER — que é
    explicitamente citado em `/sobre` como "talvez não seja pra você" (publicoNao).
    Ver observação de ICP na seção 15.
```

**O que falta e faz falta de verdade** (não é lista genérica de ideias — são os buracos que aparecem quando se olha pro que a própria marca já promete resolver e o blog ainda não toca):
- Nenhum artigo sobre **desconto** ("se posso dar desconto"), citado explicitamente no seu contexto como uma das decisões centrais que a Pólia resolve.
- Nenhum artigo sobre **se uma venda valeu a pena** (rentabilidade por pedido/cliente).
- Nenhum artigo sobre **quanto precisa entrar no mês** (meta mínima), que é literalmente a copy da Home ("Quanto já entrou. Quanto falta para o mês.").
- Nenhum artigo sobre **se pode comprar mais** (decisão de compra de estoque/material) — mencionada no seu contexto, ausente nos 7.

---

## 4. Mapa de intenção

| Artigo | Intenção principal | Palavra-chave/intenção | Função | Canibalização | Potencial |
|---|---|---|---|---|---|
| 1. Ideia tem potencial | Informacional | validar ideia de negócio | Cluster | Alto (com Art. 2) | Médio |
| 2. Ideia sem certeza | Informacional | o que fazer com ideia incerta | Cauda longa | Alto (com Art. 1) | Médio |
| 3. Vende mas não sai do lugar | Informacional/Comercial | por que negócio não cresce vendendo | Pilar | Baixo (Home), Médio (Art. 4) | Alto |
| 4. Faturamento ≠ sobra | Informacional | faturamento x lucro | Pilar / Marca | Baixo (Home), Médio (Art. 3) | Alto |
| 5. Preço sem copiar | Informacional/Comercial | como precificar sem copiar concorrente | Lead magnet / ponte produto | Baixo | Alto |
| 6. Organizar sendo a empresa toda | Informacional | organização pra quem trabalha sozinha | Cauda longa | Médio (com Art. 7) | Médio |
| 7. O que merece atenção primeiro | Informacional | como priorizar no negócio | Cauda longa | Médio (com Art. 6) | Alto |

Sem dados de volume disponíveis no ambiente atual para nenhuma linha.

---

## 5. Gap analysis — 10 maiores gaps

1. **[P1] Como saber se pode dar desconto sem perder dinheiro.** Intenção: decisão prática de precificação no momento da venda. Por que importa: está literalmente entre as decisões centrais citadas como razão de ser da Pólia, e nenhum dos 7 artigos toca nisso. Página ideal: novo artigo, cluster Precificação, com ponte direta pra calculadora.
2. **[P1] Como saber se uma venda valeu a pena (rentabilidade por pedido/cliente).** Intenção: decisão pós-venda. Por que importa: é o complemento direto do Artigo 4 (faturamento ≠ sobra), aplicado a uma venda específica em vez do mês inteiro. Página ideal: novo artigo, cluster Gestão financeira.
3. **[P1] Quanto preciso vender por mês pra fechar as contas (meta mínima).** Intenção: a mesma pergunta que a Home responde com o Painel ("quanto falta para o mês"), em formato de artigo educativo. Por que importa: é ponte direta e honesta pro produto (Painel/Metas). Página ideal: novo artigo, cluster Gestão financeira, linkando pra Home.
4. **[P2] Como saber se dá pra comprar mais estoque ou material agora.** Intenção: decisão de compra/investimento de caixa. Por que importa: citada explicitamente no seu contexto como decisão central, ausente no lote atual. Página ideal: novo artigo, cluster Gestão financeira ou novo cluster "Decisões do dia a dia".
5. **[P2] Diferença entre custo fixo e custo variável, em português simples.** Intenção: base conceitual que sustenta os Artigos 4 e 5, hoje pressuposta mas nunca explicada. Por que importa: sem esse artigo, "custos que aumentaram sem perceber" (Art. 3) e "seus próprios custos" (Art. 5) ficam conceitualmente soltos pra quem não domina o termo. Página ideal: novo artigo curto, cluster Gestão financeira, linkado pelos Artigos 3, 4 e 5.
6. **[P2] Como saber se o negócio está pronto pra sair do improviso (sinal de que já é hora de organizar de verdade).** Intenção: momento de transição — exatamente o ICP declarado da Pólia ("já tem produto/cliente, quer profissionalizar"). Por que importa: é o artigo que mais diretamente fala com quem a Pólia realmente serve, e não existe nenhum parecido nos 7. Página ideal: novo artigo, possível "âncora" do blog inteiro (D. Marca/autoridade).
7. **[P2] Como decidir entre dois preços possíveis (não só "não copie", mas "como escolher entre R$ X e R$ Y").** Intenção: continuação prática do Artigo 5. Por que importa: o Artigo 5 explica o raciocínio mas para antes de mostrar a decisão em ação. Página ideal: novo artigo ou expansão do Artigo 5.
8. **[P3] Erros comuns ao misturar dinheiro do negócio com dinheiro pessoal.** Intenção: tema já citado de raspão no Artigo 4 ("separar o dinheiro do negócio do dinheiro pessoal"), sem desenvolvimento próprio. Por que importa: é um dos achados mais citados na pesquisa da própria Pólia (a Home menciona "66% mistura a conta da casa com a conta do negócio" — dado da pesquisa própria, não inventado aqui). Página ideal: novo artigo, cluster Gestão financeira, pode citar a pesquisa própria como prova.
9. **[P3] Como organizar o financeiro sem planilha (ou com uma planilha simples).** Intenção: ponte entre "não uso planilha" (dor citada na Home) e a solução. Por que importa: reforça o eixo "sem planilha e sem achismo" da própria Home. Página ideal: novo artigo, cluster Organização/Financeiro.
10. **[P3] Validação de ideia com produto físico vs. serviço (diferenciação).** Intenção: refinamento dos Artigos 1/2 — hoje eles são genéricos o suficiente pra qualquer tipo de negócio; diferenciar produto físico de serviço aumentaria a especificidade. Por que importa: a Pólia atende os dois tipos e faz questão disso (Home: "Funciona para produtos, serviços e negócios híbridos"). Página ideal: expansão futura do cluster Validação, não urgente.

---

## 6. Clusters recomendados (arquitetura futura, enxuta)

**CLUSTER 1 — Lucro de verdade**
Tema central: a diferença entre vender e lucrar, e como enxergar quanto sobra.
Página/pilar: Artigo 4 (Faturamento não é o mesmo que dinheiro que sobra).
Artigos existentes: Artigo 3, Artigo 4.
Artigos faltantes: "posso dar desconto sem perder dinheiro" (gap 1), "essa venda valeu a pena" (gap 2), "custo fixo x variável" (gap 5), "misturar conta da casa com a do negócio" (gap 8).
Página da Pólia relacionada: Home (seção "Quanto sobra de verdade?").

**CLUSTER 2 — Preço com chão**
Tema central: como decidir o preço a partir do próprio negócio, não da concorrência.
Página/pilar: Artigo 5 (Como definir o preço sem copiar a concorrência).
Artigos existentes: Artigo 5.
Artigos faltantes: "como escolher entre dois preços possíveis" (gap 7).
Página da Pólia relacionada: Home (calculadora de preço).

**CLUSTER 3 — Tocar o negócio sozinha**
Tema central: organizar rotina, decisão e prioridade quando você é a empresa inteira.
Página/pilar: a definir entre Artigo 6 e Artigo 7 (hoje são quase do mesmo peso — recomendo o Artigo 7 como pilar, por ter o framework mais citável).
Artigos existentes: Artigo 6, Artigo 7.
Artigos faltantes: "dá pra comprar mais estoque agora?" (gap 4).
Página da Pólia relacionada: Home (seção "Rotina"/Planner), Painel.

**CLUSTER 4 — Da ideia ao negócio de verdade (cluster de menor prioridade)**
Tema central: validar se uma ideia de negócio se sustenta antes de construir.
Página/pilar: Artigo 1.
Artigos existentes: Artigo 1, Artigo 2 (recomendo diferenciá-los antes de tratar como 2 peças do mesmo cluster, ver seção 2).
Artigos faltantes: "sinal de que já é hora de sair do improviso" (gap 6) — que também poderia inaugurar um cluster próprio de transição, ver observação abaixo.
Página da Pólia relacionada: nenhuma direta hoje (ver ressalva de ICP na seção 15).

Não recomendo criar um 5º cluster agora — o gap 6 ("hora de sair do improviso") é forte candidato a virar seu próprio artigo-ponte entre o Cluster 4 e os Clusters 1-3, mas um cluster inteiro em torno dele seria prematuro com um artigo só.

---

## 7. Relação com a Home

Artigos que deveriam fortalecer a Home por link interno, com contexto real (não forçado):
- **Artigo 3** e **Artigo 4** → seção "Quanto sobra de verdade?" (calculadora): ambos terminam exatamente na pergunta que essa seção responde.
- **Artigo 5** → mesma seção da Home (calculadora), como ferramenta que aplica o raciocínio do artigo.
- **Artigo 6** e **Artigo 7** → seção "Rotina" da Home (Planner/Painel): ambos descrevem o problema que essas ferramentas resolvem.

Artigos que **não deveriam** linkar pra Home sem antes ganhar uma frase de ponte editorial:
- **Artigo 1** e **Artigo 2** — quem ainda está validando se deve começar um negócio não é o público imediato da Home (que já pressupõe negócio rodando ou decidido). Forçar o link aqui seria exatamente o tipo de "link só pra fazer SEO" que você pediu pra evitar.

---

## 8. Relação com o produto

| Artigo | Funcionalidade com relação real | Por quê |
|---|---|---|
| 3 | Calculadora de preço / Painel | O artigo termina perguntando "o que cada venda deixa" — é a pergunta que a calculadora responde. |
| 4 | Calculadora de preço | Mesma lógica, de forma ainda mais direta (é o artigo mais "definicional" do eixo número primeiro). |
| 5 | Calculadora de preço | É o artigo com a ponte mais natural de todos — ensina o raciocínio que a ferramenta automatiza. |
| 6 | Planner | O "sistema de separar informação/decisão/tarefa" é, na prática, o que um quadro do Planner organiza. |
| 7 | Planner / Painel | O critério de priorização é o que o Painel já traduz em "o que vence hoje". |
| 1, 2 | Nenhuma relação de produto direta hoje | São pré-Planejamento (a pessoa ainda não sabe o que vai vender) — não force. |

Não recomendo transformar nenhum artigo em "vitrine" de funcionalidade — as relações acima são pontes de uma frase ou de um link, não uma seção de venda dentro do texto.

---

## 9. Estratégia editorial

Hoje, os 7 artigos estão mais próximos de **C. Blog educacional** — sem voz de marca perceptível, sem experiência demonstrada, sem ponte pro produto na maioria dos casos. Não chegam a ser "aquisição SEO pura" (a intenção de busca escolhida é boa demais pra isso), mas também não chegam a ser "blog de marca" (falta a voz).

Sua preferência declarada — busca real + voz da Pólia + experiência prática + ponte natural pro produto — descreve o que EU classificaria como **D. Mistura saudável dos três**, e o material atual entrega só o primeiro ingrediente (busca real) de forma consistente. Os outros três (voz, experiência, ponte) precisam ser adicionados, não são incompatíveis com o texto que já existe — o esqueleto de intenção e raciocínio está certo, falta preencher com o que só a Pólia (e a Sil) podem colocar ali.

Proporção recomendada pra próximas peças, dado o que já existe: manter a mesma disciplina de "uma intenção de busca real por artigo" (que os 7 já têm), e exigir de cada um pelo menos 1 elemento de experiência/exemplo concreto e, quando fizer sentido editorial, 1 link de produto — sem obrigar isso em artigos onde não cabe (como os de validação de ideia).

---

## 10. Risco de IA / genericidade

**Quais parecem genéricos:** todos os 7, na mesma medida — nenhum tem uma frase, exemplo ou observação que só a Pólia/a Sil poderiam ter escrito. O padrão é idêntico nos 7: parágrafo de abertura reformulando o título, sequência de H2 conceituais, fechamento numa frase-síntese no molde "X não é A, é B." Essa fórmula de fechamento se repete literalmente nos 7 textos — é o sinal mais concreto de geração em lote/template, mais do que qualquer "achismo" sobre o texto soar genérico.

**Quais têm voz própria:** nenhum se destaca claramente dos outros nesse quesito — todos usam o mesmo registro (direto, sem hype, frases curtas), que É compatível com a voz da Pólia descrita no `CLAUDE.md` do projeto, mas que também é um registro fácil de imitar sem conteúdo real por trás.

**Quais poderiam ter sido escritos por qualquer blog de empreendedorismo:** todos os 7, hoje, poderiam. Nenhum menciona a Pólia, nenhum menciona um número real, nenhum menciona uma situação nomeada, nenhum faz referência à pesquisa própria da marca (que existe e é citada na Home: "66% mistura a conta da casa com a do negócio", "52% definem o preço no olho") — seria uma citação natural e verdadeira em pelo menos os Artigos 3, 4 e 5, e não aparece em nenhum.

**O que poderia diferenciar a Pólia:** citar a própria pesquisa (dado real, já existente, não inventado agora), um exemplo numérico hipotético claramente identificado como exemplo, e — nos artigos do cluster financeiro — a menção de que a própria Sil viveu esse problema antes de criar a Pólia (fato já público em `/sobre`, não é invenção).

Não usei nenhuma ferramenta de detecção de IA — esta é avaliação editorial, baseada em padrão estrutural observável e ausência de elementos de experiência real, como pedido.

---

## 11. Vocabulário da marca — ocorrências

Varredura literal dos 7 `conteudo_md` contra a lista de termos proibidos/mortos do `CLAUDE.md`:

| Termo | Ocorrências | Onde |
|---|---|---|
| margem | 0 | — |
| marco / marcos | 0 | — |
| etapa | 0 | — |
| trilha | 0 | — |
| jornada | 0 | — |
| turma | 0 | — |
| infoproduto | 0 | — |
| "do seu jeito" | 0 | — |
| "no seu tempo" | 0 | — |
| "no seu ritmo" | 0 | — |
| "planilha por fora" | 0 | — |
| "sabe primeiro" | 0 | — |
| "Quero faturar" | 0 | — |
| "marca clara é marca que fatura" | 0 | — |
| "marca-primeiro" | 0 | — |
| Dani | 0 | — |
| Aimer (como persona) | 0 | — |
| "a sócia que já passou" | 0 | — |
| "some sem bronca" / "sumiu?" | 0 | — |
| Travessão / em dash (—) | 0 | — |

**Nenhuma ocorrência de vocabulário proibido em nenhum dos 7 artigos.** Também não há travessão em nenhum dos textos (todos usam vírgula/ponto, consistente com a regra "sem travessão"). Não há conflito entre vocabulário proibido e termo de busca importante a sinalizar, porque simplesmente não há ocorrência do vocabulário proibido pra confrontar. Este é um ponto positivo real do lote — a ausência de vocabulário morto não é sorte, sugere que quem/o que gerou os textos já tinha alguma noção do guia de marca (ou é coincidência de registro neutro).

---

## 12. Regra "número primeiro" — avaliação por artigo

| Artigo | Envolve preço/lucro/dinheiro/venda/faturamento/custo? | Chega a exemplo concreto que ajuda a decidir? | Classificação |
|---|---|---|---|
| 1. Ideia tem potencial | Tangencialmente (disposição a pagar) | Não | NÃO SE APLICA (o tema é validação, não decisão financeira direta) |
| 2. Ideia sem certeza | Não diretamente | Não | NÃO SE APLICA |
| 3. Vende mas não sai do lugar | Sim, centralmente | Não — fala em "custos que aumentaram" e "descontos dados na pressão" sem nenhum valor ilustrativo | **FRACO** |
| 4. Faturamento ≠ sobra | Sim, é o tema inteiro | Não — descreve a existência da conta, nunca a faz | **FRACO** |
| 5. Preço sem copiar concorrência | Sim, centralmente | Não — descreve os componentes do custo sem nenhum valor de exemplo | **FRACO** |
| 6. Organizar sendo a empresa toda | Não diretamente | — | NÃO SE APLICA |
| 7. O que merece atenção primeiro | Tangencialmente ("comece pelo dinheiro") | Não | NÃO SE APLICA |

**Achado central desta seção:** os 3 artigos que mais deveriam demonstrar "número primeiro" — justamente por serem sobre dinheiro — são os 3 classificados como **FRACO** nesse critério específico. Não é falta de espaço (todos têm folga de tamanho pra incluir 1 exemplo numérico curto) — é ausência mesmo. Isso não significa que os textos estão errados; significa que, como estão, eles descrevem a importância do número sem nunca mostrar um.

---

## 13. Priorização para publicação

1. **Artigo 4 (Faturamento não é o mesmo que dinheiro que sobra) — prioridade máxima.** Maior potencial SEO, mais alinhado ao eixo central da marca, exige o menor esforço de revisão (só precisa de 1 exemplo numérico e 1 lista formatada), maior capacidade de puxar link pra Home.
2. **Artigo 3 (Minha empresa vende, mas não sai do lugar) — prioridade alta.** Mesmo patamar do Artigo 4 em potencial e esforço; publicar os dois próximos um do outro fortalece o cluster "Lucro" imediatamente.
3. **Artigo 7 (O que merece atenção primeiro) — prioridade alta.** Framework citável, esforço baixo de revisão, boa chance de featured snippet, complementa bem o cluster financeiro sem concorrer com ele.
4. **Artigo 5 (Preço sem copiar a concorrência) — prioridade alta, mas com mais trabalho.** Maior potencial estratégico (ponte pro produto) do lote inteiro, mas é o único que pede reestruturação de formato antes de publicar — vale o esforço, não é só "pequeno ajuste".
5. **Artigo 6 (Organizar sendo a empresa inteira) — prioridade média.** Bom texto, esforço baixo, mas potencial SEO mais disputado por conteúdo genérico de produtividade; publicar depois dos 4 acima.
6. **Artigo 1 (Ideia tem potencial) — prioridade média-baixa.** Tema fora do ICP central declarado da Pólia (ver seção 15); publicar só depois de decidir, como estratégia, se vale investir em tráfego de estágio pré-negócio.
7. **Artigo 2 (Ideia sem certeza) — prioridade baixa, até resolver a sobreposição com o Artigo 1.** Não recomendo publicar os dois juntos sem antes diferenciá-los ou fundi-los — publicar por último dá tempo de decidir isso com calma.

---

## 14. Calendário inicial (sequência de publicação, sem criar conteúdo novo)

**PUBLICAÇÃO 1**
Artigo: Faturamento não é o mesmo que dinheiro que sobra (Artigo 4)
Objetivo: estabelecer a autoridade da Pólia no tema central da marca (número primeiro) com o artigo mais forte do lote.
Cluster: Lucro de verdade.

**PUBLICAÇÃO 2**
Artigo: Minha empresa vende, mas não sai do lugar (Artigo 3)
Objetivo: reforçar o cluster Lucro com o ângulo operacional, já linkando pro Artigo 4 e pra Home.
Cluster: Lucro de verdade.

**PUBLICAÇÃO 3**
Artigo: Como saber o que merece atenção primeiro (Artigo 7)
Objetivo: capturar busca de priorização/rotina com esforço mínimo de revisão, abrindo o cluster Organização.
Cluster: Tocar o negócio sozinha.

**PUBLICAÇÃO 4**
Artigo: Como definir o preço sem copiar a concorrência (Artigo 5), após a reestruturação recomendada.
Objetivo: inaugurar o cluster Preço com a peça de maior potencial de ponte pro produto.
Cluster: Preço com chão.

**PUBLICAÇÃO 5**
Artigo: Como se organizar quando você é a empresa inteira (Artigo 6)
Objetivo: completar o cluster Organização.
Cluster: Tocar o negócio sozinha.

**PUBLICAÇÃO 6**
Artigo: Como saber se uma ideia de negócio tem potencial (Artigo 1), após decisão estratégica sobre o cluster de validação.
Objetivo: abrir o cluster de validação de ideia, se a decisão for investir nesse público mais cedo no funil.
Cluster: Da ideia ao negócio de verdade.

**PUBLICAÇÃO 7**
Artigo: O que fazer com uma ideia que ainda não tenho certeza se funciona (Artigo 2), após diferenciação ou fusão com o Artigo 1.
Objetivo: fechar (ou substituir) o cluster de validação.
Cluster: Da ideia ao negócio de verdade.

**Próximos 3 a 5 conteúdos a criar** (prioridade conforme seção 5): "Posso dar desconto sem perder dinheiro?" (gap 1), "Essa venda valeu a pena?" (gap 2), "Quanto preciso vender por mês pra fechar as contas" (gap 3), "Custo fixo x custo variável, sem economês" (gap 5), "O sinal de que já é hora de sair do improviso" (gap 6).

---

## 15. Relatório executivo

**1. Os 7 artigos estão prontos para publicação?**
Não como estão. Nenhum precisa ser reescrito do zero, mas todos precisam de pelo menos um ajuste (lista formatada, exemplo concreto ou diferenciação de outro artigo) antes de ir ao ar — ver decisão individual de cada ficha.

**2. Qual deles tem maior potencial?**
Artigo 4 (Faturamento não é o mesmo que dinheiro que sobra), seguido de perto pelo Artigo 3 e pelo Artigo 5.

**3. Qual deles precisa de mais trabalho?**
Artigo 5 (precisa reestruturação de formato, não só ajuste) e o par Artigo 1/Artigo 2 (precisam de uma decisão editorial de diferenciação antes de qualquer ajuste de texto).

**4. Existe algum que eu deveria descartar?**
Nenhum precisa ser descartado. O par Artigo 1/Artigo 2 precisa virar uma decisão consciente (diferenciar ou fundir), não um descarte.

**5. Qual cluster está mais forte?**
"Lucro de verdade" (Artigos 3 e 4) — é o mais alinhado ao eixo "número primeiro" e o que tem melhor conta de canibalização (baixa com Home, média apenas entre os dois artigos, que se complementam mais do que competem).

**6. Qual cluster está faltando?**
Um cluster de "decisões do dia a dia com dinheiro" que hoje só existe pela metade — falta desconto, falta "essa venda valeu a pena", falta "posso comprar mais" (gaps 1, 2 e 4). É o cluster mais citado no seu próprio contexto e o menos coberto pelos 7 rascunhos.

**7. Existe risco real de canibalização?**
Sim, um risco concreto: Artigo 1 vs. Artigo 2 (mesma intenção de busca, títulos diferentes). Os outros riscos identificados (Artigo 3 vs. Artigo 4, Artigo 6 vs. Artigo 7) são baixos a médios e mais complementares do que conflitantes — não peço ação urgente neles, só link cruzado.

**8. Qual artigo deveria ser publicado primeiro?**
Artigo 4 (Faturamento não é o mesmo que dinheiro que sobra).

**9. Qual deveria ser o segundo?**
Artigo 3 (Minha empresa vende, mas não sai do lugar).

**10. Qual é a maior oportunidade SEO que ainda não estamos explorando?**
O tema **"posso dar desconto sem perder dinheiro"** — está entre as decisões centrais que você mesma descreveu como razão de ser da Pólia, tem intenção de busca clara e específica, tem ponte natural e honesta pra calculadora de preço, e nenhum dos 7 rascunhos toca nisso.
