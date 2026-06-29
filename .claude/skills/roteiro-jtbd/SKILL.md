---
name: roteiro-jtbd
description: Gera um roteiro de entrevista no estilo Jobs To Be Done (JTBD) para descobrir por que uma persona usa ou abandona um produto, com perguntas abertas focadas em comportamento real. Use SEMPRE que o usuário quiser criar, montar ou preparar um roteiro de entrevista, um guia de pesquisa com usuário, entrevistas de discovery ou descoberta, perguntas para entender o problema do usuário, JTBD ou Jobs To Be Done; quando perguntar "como eu pergunto isso pro usuário" ou "o que perguntar na entrevista"; ou ao iniciar a fase de descoberta de um produto. O foco é comportamento passado e entender o problema, nunca validar a solução. Em português do Brasil.
---

# roteiro-jtbd

## O que é (e por que importa)

Um roteiro de entrevista **JTBD** (Jobs To Be Done) serve para descobrir o **"trabalho" que a pessoa contrata o produto para fazer**. O objetivo é entender o **problema real**, não validar a sua solução.

A regra de ouro: pergunte sobre **comportamento passado** (o que a pessoa de fato fez), não sobre opinião ou hipótese (o que ela acha que faria). Opinião mente; comportamento conta a verdade. "Me conta a última vez que..." vale mais do que "Você costuma...".

## Antes de escrever: reúna o mínimo

- **Persona ou segmento** que vai entrevistar.
- **Produto ou categoria.**
- **A pergunta de descoberta:** o que você quer entender (ex.: por que abandonam o checkout, por que largam a ferramenta).

Se faltar, **proponha** e rotule como `Sugestão (confirmar)`, em vez de deixar em branco.

## Princípios de um bom roteiro

- **Perguntas abertas**, nunca de sim/não. Elas começam com "me conta", "como foi", "o que aconteceu".
- **Ancore em episódios reais e recentes**, não em hipóteses ("a última vez que isso aconteceu", não "o que você faria se").
- **Separe comportamento de opinião.** E não entregue a resposta na pergunta (não induza): evite "Você não acha o cupom confuso?".
- **Vá do geral para o específico.** Use silêncio e "me conta mais" para aprofundar.
- **Não pergunte se a pessoa gostaria da sua solução.** Isso enviesa e não é descoberta. Você está atrás do problema, não de aplausos.
- **Tamanho:** cerca de 8 a 12 perguntas. É entrevista de fundadora solo, não uma bateria de laboratório.

## Estrutura (use sempre este formato)

Escreva o resultado em um arquivo `roteiro-entrevista-[tema].md`:

```
# Roteiro de entrevista JTBD — [produto / tema]

## Objetivo da entrevista
[1 frase: o que você quer descobrir]

## Aquecimento
[1 a 2 perguntas leves para a pessoa ficar à vontade]

## Bloco 1 — Contexto e gatilho
[Me conta a última vez que [situação do problema]. O que estava acontecendo?]

## Bloco 2 — Tentativas anteriores e alternativas
[O que você já tentou para resolver? Ferramentas, atalhos, gambiarras. Por que largou?]

## Bloco 3 — Critérios de escolha
[O que pesou para escolher ou abandonar? O que faltou?]

## Bloco 4 — Resultado esperado (o "job")
[O que muda no seu dia quando isso dá certo? Inclua o lado funcional, o emocional e o social.]

## Encerramento
[1 pergunta aberta final + agradecimento]

## Dicas de condução
[Não induzir; perguntar sobre comportamento passado; usar silêncio; anotar frases literais]
```

O documento é o entregável; não o resuma de volta no chat.

## Antes de entregar: passe por este gate

- As perguntas são **abertas** e sobre **comportamento passado** (não opinião nem hipótese)?
- Tem os **blocos JTBD** (gatilho/contexto, tentativas anteriores, critérios, resultado esperado)?
- Está em torno de **8 a 12 perguntas** (não inflado)?
- **Evita** perguntar se a pessoa "gostaria" da solução?
- Tem **dicas de condução** para não induzir?

Se algo falhar, ajuste antes de entregar. Um roteiro que induz ou pede opinião sobre a solução produz dados que mentem, e dado que mente é pior do que dado nenhum.
