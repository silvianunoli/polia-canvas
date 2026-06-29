---
name: definir-marca
description: Transforma a aposta escolhida e o discovery na estratégia de marca do produto, preenchendo um BRAND.md com posicionamento, território, promessa, personalidade, valores, tom de voz e consistência. Use SEMPRE que o usuário quiser definir a marca, a estratégia de marca, o posicionamento, a promessa, a personalidade, os valores ou o tom de voz de um produto; quando perguntar quem a marca é, o que ela promete ou como ela fala; quando mencionar branding, identidade de marca (a estratégica, não as cores) ou BRAND.md; ou logo depois de escolher a aposta e antes da direção de arte visual. Não refaz a persona (puxa do discovery) e propõe decisões rotuladas para confirmar, nunca deixa em branco. Roda antes do gerar-design-md e alimenta o DESIGN.md. Em português do Brasil.
---

# definir-marca

## O que é este documento (e por que importa)

O `BRAND.md` é a **estratégia de marca travada em arquivo**. Ele decide **quem a marca é** antes de o `DESIGN.md` decidir **como ela parece**. O princípio é direto: estética sem estratégia é decoração. "Verde porque passa crescimento" só vale se "crescimento" já estiver escrito em algum lugar. Esse lugar é o `BRAND.md`. A partir dele, o visual, a copy e o PRD param de chutar a identidade.

Esta skill roda **entre a ideação e a direção de arte**: depois de a aposta estar escolhida, antes de a cor ser escolhida.

## A regra inegociável: não duplicar o que já existe

Metade do que se chama de "fazer a marca" o método já resolve em outra fase. Esta skill **consome** essas saídas, não as repete:

- **Persona e público** vêm do `discovery.md`. Não refaça persona nem mapa de empatia aqui. Puxe de lá.
- **A execução de texto** (microcopy, FAQ, erro) é da skill `copy-sem-positividade`. Aqui você define o tom e o léxico; lá eles são executados.
- **Cor, fonte, espaçamento** são do `DESIGN.md`. Aqui você entrega os adjetivos-âncora e o "não é"; lá o visual traduz.

Se um campo está te fazendo reescrever a persona, pare e leia o `discovery.md`.

## Antes de escrever: reúna o mínimo (sem interrogar)

Extraia do que o usuário já tem e só pergunte o que faltar:

- A **aposta** escolhida na ideação e o **problema** definido no discovery.
- **Para quem** é (do `discovery.md`).
- O que o produto **faz** e o que ele faz **diferente** dos concorrentes.
- Se houver: nome do produto, decisões de marca já tomadas, referências que admira.

Se faltar algo, **proponha** com base no discovery e na aposta, e rotule como `Sugestão (confirmar)`. O valor da skill é adiantar boas decisões para a pessoa aceitar ou corrigir, não interrogá-la.

## Como decidir cada campo (proponha, não pergunte tudo)

1. **Posicionamento.** Escreva o resumo em uma frase do que é a marca. Sustente com quatro perguntas (o que é, que problema resolve, para quem, por que se importam). Use o problema do discovery como base. Teste com "o que o mundo perderia se a marca sumisse?".

2. **Território e diferenciação.** Liste as associações que devem cercar a marca e de 3 a 4 coisas que ela faz diferente dos concorrentes. Foque no que muda na experiência, não em slogan.

3. **Promessa.** Uma frase: o que a marca garante a quem usa. É a régua de qualquer entrega futura.

4. **Personalidade.** Proponha 3 a 5 adjetivos-âncora a partir do tom da aposta. Defina a relação marca-usuário (ex.: o guia experiente, não o coach). Escreva a lista **é / não é**, com o "não é" listando os opostos (é o que mais protege contra o genérico).

5. **Valores inegociáveis.** De 3 a 5 princípios, cada um amarrado ao que ele **proíbe** na prática. Valor que não corta nada é enfeite, descarte.

6. **Tom de voz.** Princípios de como fala, mais o léxico: palavras que **sempre** usa e as que **nunca** usa. Este campo é o input direto da `copy-sem-positividade`, então seja concreto (liste palavras reais).

7. **Consistência.** Nomeie o sentimento único que toda interação deve repetir, e marque onde ele aparece no produto (onboarding, estado vazio, erro, e-mail, microcopy). Num SaaS a marca vive no produto, não em feed nem em unboxing.

## Saída

Escreva o resultado em um arquivo `BRAND.md` (Markdown), com as sete seções acima nesta ordem, mais um bloco de **gate de saída** no fim. O documento é o entregável; não o resuma de volta no chat.

## Antes de entregar: passe por este gate

- O **posicionamento** está em uma frase, sem adjetivo vazio?
- Os **7 campos** têm decisão (não "a definir")? O que for proposta sua está rotulado `Sugestão (confirmar)`?
- O **"NÃO É"** e o léxico **"nunca usa"** estão preenchidos?
- Os **adjetivos-âncora** são específicos o bastante para o `DESIGN.md` puxar cor e tipografia a partir deles?
- Você **não** reescreveu a persona do `discovery.md`?

Se algum item falhar, complete antes de entregar. Esse gate é o que faz o `BRAND.md` realmente travar a estratégia, em vez de só parecer pronto.

## Referência

O template completo em branco está em `references/brand-template.md`. O aprofundamento da fase está no arquivo `11-estrategia-de-marca.md` da Base de Conhecimento; um exemplo preenchido, em `brand-polia.md`.
