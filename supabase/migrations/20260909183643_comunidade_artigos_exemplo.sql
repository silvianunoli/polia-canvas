-- CONTEÚDO DE EXEMPLO da comunidade. Três artigos só pra a tela não nascer
-- vazia e a Sil conseguir ver a home, a página de artigo e os comentários
-- funcionando de verdade.
--
-- ISTO É PRA TROCAR. Quando os artigos de verdade entrarem pelo editor em
-- office.usepolia.com.br/comunidade, apagar estes três:
--
--   DELETE FROM public.comunidade_artigos WHERE slug IN (
--     'quanto-sobra-de-cada-venda',
--     'tres-numeros-que-decidem-o-mes',
--     'a-conta-que-ninguem-cobra-de-voce'
--   );
--
-- O DELETE leva junto os comentários de teste (ON DELETE CASCADE).
--
-- autor_id fica null de propósito: artigo de exemplo não tem dona.

INSERT INTO public.comunidade_artigos
  (slug, titulo, resumo, categoria, tempo_leitura, publicado, publicado_em, conteudo_md)
VALUES
(
  'quanto-sobra-de-cada-venda',
  'Quanto sobra de cada venda, antes de cobrar',
  'Você olha o preço da concorrente, arredonda pra baixo e manda pra cliente. O resultado dessa conta só aparece no fim do mês, e aí já foi.',
  'Dinheiro e Gestão',
  4,
  true,
  '2026-09-01 11:00:00+00',
  $md$
Você abre o perfil de quem faz parecido, vê o valor que ela cobra, tira uns reais pra não parecer cara e manda pra cliente. Leva trinta segundos, fecha o pedido de hoje e deixa de fora a única pergunta que decide o mês: depois de tudo pago, sobrou quanto.

## O preço da concorrente não sabe da sua conta

Ela pode comprar material em outro volume, morar numa cidade com frete mais barato, ter uma máquina já paga. O preço dela é resposta pra conta dela. Copiado, vira um número bonito que não cobre o seu custo.

Faz o teste com um produto só, o que mais sai. Soma:

- o material que entra nele, item por item
- as horas que ele leva, multiplicadas pelo valor da sua hora
- a parte que ele carrega dos custos fixos do mês
- a taxa da maquininha ou do gateway
- o imposto

O que sobra depois disso é o que a venda deixa. Não é o preço, não é o faturamento, é o que fica.

> Faturar bem e sobrar pouco é o cenário mais comum de quem cresceu sem calculadora.

## O número muda a conversa

Quem sabe que sobram R$ 12 numa venda de R$ 90 decide diferente. Aceita ou recusa o desconto sabendo o tamanho do buraco. Escolhe qual produto empurrar na semana. Descobre que o item campeão de vendas é o que paga menos.

A calculadora de preço da Pólia faz essa conta com os seus números e mostra quanto sobra antes de o preço ir pra cliente. Não é adivinhação, é aritmética que ninguém ensinou na hora de abrir o negócio.

## Por onde começar hoje

Escolhe um produto. Faz a conta uma vez, com calma. Se o que sobra te assustar, o problema não é a conta: ela só mostrou o que já estava acontecendo todo mês, calado.
$md$
),
(
  'tres-numeros-que-decidem-o-mes',
  'Os três números que decidem o mês',
  'O mínimo pra fechar as contas, o mês bom e o mês de celebrar. Com esses três na mesa, o fechamento para de ser surpresa.',
  'Dinheiro e Gestão',
  5,
  true,
  '2026-09-04 11:00:00+00',
  $md$
Tem um jeito de acompanhar dinheiro que cansa mais do que ajuda: olhar o saldo da conta todo dia e sentir. Sobe, alivia. Desce, aperta. No fim do mês, ninguém sabe dizer se foi um mês bom.

Três números resolvem isso melhor que qualquer planilha longa.

## 1. O mínimo pra fechar as contas

É a soma do que sai de qualquer jeito: aluguel, energia, plano de celular, ferramenta que renova sozinha, o pró-labore que paga a sua vida. Esse é o piso. Vender abaixo dele significa que o mês foi pago com reserva, com limite do cartão ou com dinheiro pessoal.

A maioria descobre esse número e leva um susto. É útil que doa uma vez, porque depois ele vira alvo.

## 2. O mês bom

O piso mais o que precisa entrar pra reinvestir: repor material, comprar aquele equipamento, pagar quem ajuda. Um mês bom não é um mês de sorte, é um mês que cobre o piso e ainda deixa o negócio um pouco mais equipado do que estava.

## 3. O mês de celebrar

O valor que, batido, muda alguma coisa de verdade. Uma folga na agenda, uma reserva de três meses, um curso. Ele existe pra dar direção quando bater a dúvida de aceitar mais um pedido apertado.

> Meta sem número é vontade. Número sem meta é planilha.

## O que muda na prática

Com os três definidos, a pergunta do dia 20 deixa de ser "está indo bem?" e vira "faltam quantas vendas pro piso?". A segunda tem resposta.

O Financeiro da Pólia guarda os três e mostra onde o mês está agora, sem você abrir planilha nenhuma.
$md$
),
(
  'a-conta-que-ninguem-cobra-de-voce',
  'A conta que ninguém cobra',
  'Sem sócia pra conferir, a régua do negócio vira a memória do mês passado. E a memória é otimista.',
  'Empreender Sozinha',
  4,
  true,
  '2026-09-07 11:00:00+00',
  $md$
Quem divide o negócio com alguém tem um efeito colateral bom: uma vez por mês, outra pessoa pergunta como estão os números. A pergunta é chata e é exatamente por isso que funciona.

Tocando sozinha, ninguém pergunta. E a memória do mês passado é sempre mais generosa do que o extrato.

## O buraco não é falta de disciplina

É falta de registro. Você lembra da venda grande de terça, não lembra dos R$ 40 de frete de quinta, dos R$ 89 da ferramenta que renovou, do desconto que deu pra amiga da cliente. São valores pequenos e frequentes, do tamanho certo pra sumir da lembrança e aparecer no saldo.

Não precisa virar controladora do próprio negócio. Precisa de um lugar único onde tudo caia, mesmo bagunçado, e de dez minutos por semana pra olhar.

## Dez minutos, três perguntas

- Quanto entrou nesta semana
- Quanto saiu, incluindo o que parecia pequeno demais pra anotar
- Tem algum pedido parado esperando resposta minha

A terceira costuma ser a mais cara. Orçamento sem retorno é venda que já foi feita pela metade e ficou no meio do caminho.

> Não é sobre trabalhar mais. É sobre parar de descobrir as coisas tarde demais pra fazer algo com elas.

## Onde a Pólia entra

Ela guarda entrada, saída e status de pedido no mesmo lugar e mostra o que está parado. Não substitui a decisão, mas tira dela o palpite.

E aqui embaixo tem o campo de comentário: conta como esses dez minutos caberiam na sua semana.
$md$
);
