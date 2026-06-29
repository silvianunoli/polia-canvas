---
name: analise-heuristica
description: Avalia a usabilidade de uma tela pelas 10 heurísticas de Nielsen e devolve um diagnóstico com os problemas priorizados por gravidade e correções concretas. Use SEMPRE que o usuário quiser revisar, avaliar, criticar ou pedir feedback de uma tela, interface, protótipo ou fluxo; quando mandar um print ou screenshot, ou a descrição de uma tela, perguntando o que melhorar ou "o que está ruim aqui"; quando mencionar "análise heurística", "heurísticas de Nielsen", "avaliação de usabilidade" ou "review de UX"; ou logo depois de o Claude Code gerar uma interface, para revisá-la antes de seguir. O foco é sempre o que trava a ação principal da tela. Em português do Brasil.
---

# analise-heuristica

## O que é esta análise (e o que não é)

É uma **avaliação de usabilidade** de uma tela contra as **10 heurísticas de Nielsen**. O objetivo é achar o que atrapalha o usuário e dizer **como corrigir**, priorizando o que **trava a ação principal**. Não é opinião de gosto pessoal: é diagnóstico contra princípios reconhecidos, para a pessoa poder agir.

## Antes de analisar: ancore na ação principal

Você precisa de duas coisas:
- **A tela:** um print/screenshot **ou** uma descrição. Se houver imagem, analise o que de fato se vê (não só o que foi dito).
- **A ação principal** daquela tela: a única coisa mais importante que o usuário veio fazer ali. Se não estiver clara, infira e **declare que inferiu**.

Avalie sempre **em função da ação principal**. Um problema que atrapalha a ação principal é mais grave do que um detalhe lateral, mesmo que os dois violem uma heurística.

## As 10 heurísticas (passe por todas, não pule)

Para cada uma, faça a pergunta-guia:
1. **Visibilidade do status do sistema** — o usuário sabe onde está e o que está acontecendo (etapa, carregamento, resultado)?
2. **Correspondência com o mundo real** — a linguagem, os ícones e a ordem fazem sentido para o usuário, não para o sistema?
3. **Controle e liberdade** — dá para desfazer, voltar, cancelar, sair sem punição?
4. **Consistência e padrões** — o que é igual se comporta igual; segue convenções que o usuário já conhece?
5. **Prevenção de erros** — o design evita o erro antes de ele acontecer (em vez de só avisar depois)?
6. **Reconhecimento em vez de memorização** — as opções e informações estão visíveis, sem exigir que o usuário lembre de coisas?
7. **Flexibilidade e eficiência** — há atalhos para quem já sabe, sem atrapalhar quem é novo?
8. **Estética e design minimalista** — só o necessário está na tela, com hierarquia clara? (Aqui também entram os sinais de "cara de IA".)
9. **Recuperação de erros** — as mensagens dizem em linguagem clara o que houve e **como sair** dali?
10. **Ajuda e documentação** — quando é preciso, a ajuda está acessível e no contexto?

## Como pontuar e priorizar

Para cada heurística, diga: **status** (OK / atenção / violação), **o que observou** e o **impacto**.

Depois reúna os problemas numa lista **priorizada por gravidade**:
- **Alta:** trava ou confunde na ação principal.
- **Média:** atrito perceptível, mas contornável.
- **Baixa:** polimento.

Para cada problema, dê uma **correção concreta**, não genérica. Em vez de "melhorar o feedback de erro", escreva: *"trocar o texto 'Erro' por 'Cupom expirado. Veja outros disponíveis.' e manter o campo preenchido para o usuário tentar de novo."* O valor está na correção específica.

## Saída (use sempre este formato)

Escreva o resultado em um arquivo `analise-heuristica-[tela].md`:

```
# Análise heurística — [nome da tela]

## Contexto e ação principal
[o que é a tela e qual a ação principal; diga se inferiu]

## Diagnóstico por heurística
| # | Heurística | Status | Observação | Impacto |
|---|---|---|---|---|
(as 10 linhas)

## Problemas priorizados
| Gravidade | Problema | Correção concreta |
|---|---|---|

## Top 3 de maior retorno
1. ...
2. ...
3. ...
```

O documento é o entregável; não o resuma de volta no chat.

## Antes de entregar: passe por este gate

- Passou pelas **10 heurísticas** (nenhuma ficou de fora)?
- Cada problema tem **gravidade** e **correção concreta** (não genérica)?
- A priorização reflete o **impacto na ação principal**?
- O **top 3** está claro e acionável?

Se algo falhar, complete antes de entregar. A diferença entre uma análise útil e uma lista vazia é a correção concreta e a priorização honesta pelo que mais atrapalha o usuário.
