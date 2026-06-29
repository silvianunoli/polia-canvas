---
name: montar-prd
description: Cria um PRD (Product Requirements Document, documento de requisitos do produto) completo e pronto para handoff, a partir de um problema e de uma aposta ou feature. Use SEMPRE que o usuário quiser criar, montar, escrever, redigir ou completar um PRD, especificar uma feature, documentar requisitos de produto, transformar uma ideia, aposta ou discovery em especificação para construir, ou preparar o handoff de uma feature para desenvolvimento, mesmo que ele não use a palavra "PRD". O grande valor é garantir que fluxos, estados, erros e regras (a lógica que quase sempre é esquecida e faz o protótipo falhar) estejam todos cobertos. Em português do Brasil.
---

# montar-prd

## O que este PRD é (e por que importa)

O PRD aqui não é documentação burocrática: é um **instrumento de engenharia**. O objetivo é registrar a **lógica que a IA esquece sozinha** — estados vazios, erros, exceções, regras — para que o protótipo ou o código não falhe "por falta de lógica, não de UI". A tela bonita você resolve depois; o que mata um produto é o fluxo que não previu o caso de erro.

Pense neste documento como **o checklist do que não pode ser esquecido** antes de mandar construir. Sua tarefa, ao montar um PRD, é puxar à tona justamente o que o usuário esqueceria sozinho.

## Antes de escrever: reúna o mínimo (sem interrogar)

Você precisa de poucas coisas para começar. Se o usuário já deu contexto (uma conversa de discovery, uma aposta escolhida, uma descrição da feature), **extraia de lá primeiro** e só pergunte o que realmente faltar:

- **Qual feature/aposta** e **para quem** (a persona).
- **Qual problema** ela resolve, em uma frase.
- Se houver: **apetite** (tempo que se topa investir), **plataforma** (web/mobile), e **regras de negócio** já conhecidas (limites, planos, permissões).

Não trave o trabalho esperando respostas perfeitas. Se algo essencial faltar e o usuário não puder responder agora, **proponha um padrão sensato e rotule como `Sugestão (confirmar)`** — assim a pessoa tem um bom ponto de partida para aceitar ou corrigir, em vez de uma lacuna em branco. Nunca apresente um palpite como se fosse fato já decidido: o rótulo `Sugestão (confirmar)` é o que separa as duas coisas. Reserve **[A DEFINIR]** apenas para o que é arriscado demais chutar (ex.: uma regra fiscal, um limite contratual).

## A estrutura do PRD (produza nesta ordem)

Escreva o documento com estas seções, nesta ordem. Para cada uma há uma razão; mantenha a razão em mente ao preencher.

### 1. Shaping (decidir antes de detalhar)
- **Problema:** o que está quebrado hoje e para quem.
- **Apetite:** o tempo fixo que se topa investir. O escopo é que se ajusta, não o prazo.
- **Solução:** a ideia central em uma frase.
- **Rabbit holes:** riscos de virar buraco sem fim (técnico ou de escopo). Aponte-os para evitá-los.
- **No-go's:** o que fica **de fora de propósito**, mesmo sendo boa ideia. Isso protege o apetite.

### 2. Fluxos (a lógica que a tela esconde)
Para cada passo descreva: **ação do usuário → resposta do sistema → próxima ação.**
- **Caminho feliz** (tudo dá certo), passo a passo.
- **Alternativos:** cancelar, voltar, editar, pular.
- **Exceção:** sem conexão, sem permissão, limite atingido, dado inválido.

### 3. Estados (o item mais esquecido)
Liste **todos** os estados de cada tela ou componente relevante, não só o "carregado e feliz". Use uma tabela:

| Estado | Existe aqui? | Como se comporta / o que mostra |
|---|---|---|
| Vazio (primeira vez, sem dado) | | |
| Carregando | | |
| Carregado | | |
| Erro | | |
| Desabilitado (sem permissão/plano) | | |
| Parcial (dado incompleto) | | |

O **estado vazio** costuma ser o primeiro contato do usuário com a feature. Trate-o com capricho, não como sobra.

### 4. Erros (mensagem exata + recuperação)
Para cada erro possível, diga **a mensagem exata** que aparece e **a ação de recuperação** (como o usuário sai do erro). A mensagem é seca, específica e **não culpa o usuário**.

| Tipo | Quando ocorre | Mensagem | Ação de recuperação |
|---|---|---|---|
| Validação no campo | | | |
| API (400/401/403/404/500/timeout) | | | |
| Negócio (limite, duplicado, expirado) | | | |

### 5. Regras
- Permissões por papel (quem pode o quê).
- Limites por plano e **comportamento ao atingir o limite**.
- Regras de dados (duplicidade, normalização).
- Condições entre campos.

### 6. Hipótese e métrica observável
- **Hipótese:** "Acreditamos que [mudança] para [usuário] vai gerar [resultado]."
- **Métrica observável:** algo que dá para medir (ex.: tempo até a primeira ação certa, taxa de conclusão).
- **Critério de sucesso** (em termos de resultado, não de "feature pronta") e **critério de falha**.

### 7. Definition of Done + o que testar
- Critérios de aceite (a lista do que precisa funcionar).
- DoD: todos os estados implementados, erros com mensagem e recuperação, responsivo, acessível.
- O que **não** precisa testar (é óbvio) e o que **precisa** (o risco real). Gabarite só o não-óbvio.

### 8. Handoff para o Claude Code
Feche com um prompt pronto para colar, mandando implementar pela **lógica** do PRD, usando só os tokens do DESIGN.md, com wireframe cinza primeiro e todos os estados.

## Princípios ao preencher (é aqui que mora o valor)

- **Complete os estados e os erros de propósito.** É o maior ganho do documento. Se você só descrever a tela feliz, o PRD não serviu para nada.
- **Diga em voz alta o que costuma ser esquecido** nesta feature específica. Ex.: "atenção: o que acontece se o cupom expirar no meio do checkout?".
- **Quando não souber uma regra de negócio, proponha um padrão razoável** e rotule como `Sugestão (confirmar)` (ex.: "Sugestão (confirmar): 1 cupom por pedido, não acumulável com outras promoções"). O objetivo é adiantar uma decisão boa para a pessoa revisar, sem disfarçar palpite de fato consumado.
- **Seja específico, não genérico.** "Mensagem: 'Cupom expirado. Veja outros disponíveis.'" vale mais que "mostrar erro".

## Saída

Escreva o resultado em um arquivo Markdown chamado `PRD-[nome-da-feature].md`, pronto para ir ao repositório. Siga a estrutura e a ordem acima. O documento é o entregável; não o resuma de volta no chat (o usuário lê o arquivo).

## Antes de entregar: passe por este gate

Não considere o PRD pronto enquanto não puder responder "sim" a tudo:
- A **intenção** cabe em uma frase?
- **Todos os estados** estão listados (vazio e erro inclusive)?
- **Cada erro** tem mensagem e ação de recuperação?
- Existem **no-go's** explícitos?
- A **hipótese** tem uma métrica observável de verdade?

Se algum item falhar, complete antes de entregar. Esse gate é o que separa um PRD que evita retrabalho de um que só parece pronto.

## Referência

O template completo em branco está em `references/prd-template.md`. Use-o como espinha quando precisar do formato exato; o corpo acima já traz o essencial.
