---
name: handoff-implementacao
description: Transforma um PRD em um prompt de implementação pronto para colar no Claude Code, específico para a feature (enumera os estados, erros e regras reais do PRD) e com as travas de qualidade embutidas (usar só os design tokens, wireframe cinza primeiro, todos os estados, revisão contra o PRD). Use SEMPRE que o usuário quiser preparar o handoff, a passagem para o desenvolvimento, o prompt para construir ou implementar uma feature, mandar algo para o Claude Code, ou perguntar "como peço pro Claude Code construir isso"; ou logo depois de um PRD ficar pronto. Em português do Brasil.
---

# handoff-implementacao

## O que é (e por que importa)

Pega um **PRD** e gera o **prompt pronto para colar no Claude Code**. O valor está em ser **específico ao PRD**: o prompt enumera os estados, erros e regras **reais** daquela feature, então o agente de código constrói dentro dos trilhos, em vez de receber um "implementa X" genérico e sair inventando. É a cola entre o método e o código.

## Antes de gerar: você precisa do PRD

Esta skill **consome um PRD**. Peça o PRD (o conteúdo ou o caminho do arquivo). **Se não houver PRD, use antes a skill `montar-prd`**: um handoff sem PRD vira um prompt genérico, que é exatamente o que queremos evitar.

## O que extrair do PRD

- A **feature** e a **ação principal** (uma frase).
- A **lista de estados** (vazio, carregando, erro, etc.).
- Os **fluxos** (feliz, alternativos, exceção).
- Os **erros** (cada um com mensagem e recuperação).
- As **regras** (permissões, limites, dados).

## Princípios

- O prompt tem que ser **específico**: enumere os estados, erros e regras reais do PRD. Genérico não serve, porque genérico é o que produz a tela feliz sem lógica.
- **Mantenha as travas:** usar só os tokens do DESIGN.md; wireframe cinza primeiro; listar e confirmar os estados antes de codar; mobile-first; acessível (AA); seguir as proibições do CLAUDE.md (anti cara de IA); revisar contra o PRD no fim.
- **Seja enxuto e pasteável.** O prompt é para colar e rodar, não para ler como um relatório.

## Saída (use sempre este formato)

Escreva o resultado em um arquivo `handoff-[feature].md`, contendo um bloco pronto para colar:

```
# Handoff — [feature]

Cole no Claude Code (com CLAUDE.md, DESIGN.md e o PRD no repositório):

---
Implemente [feature]. Ação principal: [uma frase].
Siga o PRD, o DESIGN.md e o CLAUDE.md deste projeto. Fidelidade à LÓGICA do PRD.

Antes de codar:
1. Liste os estados que vai implementar e confirme a cobertura: [estados do PRD].
2. Mostre o wireframe cinza (sem cor) primeiro, para eu validar a estrutura.

Implemente:
- Fluxos: [feliz / alternativos / exceção, conforme o PRD].
- Estados: [todos os do PRD], cada um com seu comportamento.
- Erros: cada um com mensagem exata e recuperação: [erros do PRD].
- Regras: [regras do PRD].

Restrições:
- Use SÓ os design tokens do DESIGN.md. Nenhum valor fora deles.
- Mobile-first e responsivo. Acessível: contraste AA, foco visível, navegação por teclado.
- Sem cara de IA: siga as proibições do CLAUDE.md.

Depois de implementar:
- Revise contra o PRD e o checklist; liste o que faltou e corrija.
---
```

O documento é o entregável; não o resuma de volta no chat.

## Antes de entregar: passe por este gate

- O prompt enumera os **estados, erros e regras reais** do PRD (não genéricos)?
- Pede **wireframe cinza primeiro** e **listar/confirmar os estados**?
- Manda usar **só os tokens** e seguir as **proibições** do CLAUDE.md?
- Tem a **revisão contra o PRD** no final?
- Está **enxuto e pronto para colar**?

Se algo falhar, ajuste antes de entregar. Um handoff genérico desperdiça todo o trabalho do PRD: ele devolve à IA a liberdade que o método tinha acabado de tirar.
