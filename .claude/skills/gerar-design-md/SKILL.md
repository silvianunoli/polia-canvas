---
name: gerar-design-md
description: Gera um DESIGN.md completo (a especificação visual da marca, com design tokens) a partir de poucas decisões de marca, já com a estética anti "cara de IA" embutida. Use SEMPRE que o usuário quiser definir, criar, montar ou decidir o design system, a identidade visual, a paleta, as cores e fontes, os tokens, o UI kit ou "a cara/aparência" de um produto ou marca; quando mencionar DESIGN.md ou design tokens; quando pedir ajuda para escolher cor de acento, tipografia ou direção de imagem; ou quando quiser fugir do visual genérico de IA. Propõe escolhas concretas (hexes e fontes reais) rotuladas para confirmar, nunca deixa em branco. Em português do Brasil.
---

# gerar-design-md

## O que é este documento (e por que importa)

O DESIGN.md é a **especificação visual que a IA é obrigada a seguir**. O objetivo é **travar a aparência da marca** em decisões concretas (cores, fontes, espaçamento, proibições) para que o código não caia no default genérico. É a peça que mata a "cara de IA": o problema nunca foi prompt, foi **falta de restrição**. Aqui você cria a restrição.

## A regra inegociável: anti "cara de IA"

A estética default da IA é um conjunto **previsível** que você deve **proibir explicitamente** no documento:
- Roxo/violeta e qualquer gradiente (o delator número 1).
- Vidro fosco (glassmorphism); sombras grandes e difusas.
- Tudo centralizado e muito arredondado.
- Ícones-emoji ou 3D coloridos; bonequinho 3D genérico; foto de banco óbvia.
- Copy inflada ("transforme", "revolucione", "✨").

O antídoto é **subtrativo**: base neutra mais **um** acento; quase sem sombra (separe por borda fina); alinhar à esquerda; tipografia com caráter; imagem com direção própria. Carregue isso para dentro de cada decisão.

## Antes de escrever: reúna o mínimo (sem interrogar)

Extraia do que o usuário já disse e só pergunte o que faltar:
- **Nome** do produto e o que ele faz.
- **3 adjetivos-âncora** da marca e **o que ela NÃO é**.
- **Plataforma** (web, mobile).
- Se houver: cores ou fontes de marca já existentes, referências que admira.

Se faltar algo, **proponha** (não deixe em branco) e rotule como `Sugestão (confirmar)`. O valor desta skill é adiantar boas decisões para a pessoa aceitar ou corrigir.

## Como decidir cada parte (proponha, não pergunte tudo)

A partir dos adjetivos, **proponha escolhas concretas** e justifique cada uma em uma linha. Para a cor de acento, dê sempre **1 recomendação mais 1 ou 2 alternativas**, para a pessoa escolher.

### Cor
- **Base neutra:** ink (texto), bg off-white **quente** (não branco gelado), surface, line. Dê os hexes.
- **1 acento:** proponha uma cor coerente com os adjetivos e **fora do clichê**. Nunca roxo nem gradiente, a menos que o usuário peça explicitamente. Dê o hex e o tom de hover.
- **Funcionais** (success, warning, danger): dessaturadas, discretas.

### Tipografia
- **Par tipográfico:** um display **com caráter** (uma serifada contemporânea costuma diferenciar do template) mais um sans neutro para corpo. Use **nomes de fontes reais** (ex.: Fraunces, Instrument Serif, Inter, Geist). Defina a **escala**: display, h1, h2, h3, corpo, legenda.

### Espaçamento, raio, elevação
- Escala de espaçamento base 4: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Raio **contido** (arredondar tudo demais é cara de IA).
- Elevação por **borda 1px**; sombra quase nula, só onde algo flutua de verdade.

### Grid, ícones, imagem, motion
- Grid de 12 colunas, alinhamento à esquerda, respiro generoso.
- Ícones: um set único, outline e monocromático (ex.: Lucide).
- Imagem: foto dirigida **ou** ilustração própria consistente; nunca 3D genérico ou stock óbvio.
- Motion: 150 a 250ms, só para revelar hierarquia ou dar feedback.

### Proibições
Liste explicitamente o que **esta** marca nunca usa. É o que protege contra o default.

## Saída

Escreva o resultado em um arquivo `DESIGN.md` (Markdown), com estas seções:
1. **Tema e atmosfera** (3 adjetivos, o que NÃO é, densidade).
2. **Cor** (tabela de tokens: nome, hex, papel).
3. **Tipografia** (par e escala).
4. **Espaçamento, raio, elevação.**
5. **Grid e layout.**
6. **Ícones, imagem, motion.**
7. **Proibições** (do's e don'ts).
8. **Bloco de tokens CSS `:root`** pronto para colar no projeto.

O documento é o entregável; não o resuma de volta no chat.

## Antes de entregar: passe por este gate

- Tem **um** acento (não vários) e ele **não é** roxo nem gradiente (salvo pedido explícito)?
- **Todo token** tem valor concreto (hex, fonte), não placeholder vazio?
- Tem a **lista de proibições** anti "cara de IA"?
- Tem o **bloco `:root`** pronto para colar?
- O bg é off-white quente, não branco gelado?

Se algum item falhar, complete antes de entregar. Esse gate é o que garante que o DESIGN.md realmente trava o visual, em vez de só parecer pronto.

## Referência

O template completo em branco está em `references/design-template.md`. Use-o como espinha quando precisar do formato exato; o corpo acima já traz o essencial.
