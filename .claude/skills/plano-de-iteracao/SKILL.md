---
name: plano-de-iteracao
description: Transforma os resultados de um teste de usabilidade ou os achados de uma análise heurística em melhorias priorizadas, organizadas em ciclos pequenos e validáveis. Use SEMPRE que o usuário tiver resultado de teste com usuário, feedback ou problemas de usabilidade encontrados e quiser priorizar, decidir o que melhorar, transformar feedback em melhorias, planejar as próximas iterações ou perguntar "testei, e agora?"; ou logo depois de uma análise heurística ou de um teste. Prioriza por impacto e esforço, vira cada achado em hipótese com métrica e separa o que atacar agora do que anotar para depois. Em português do Brasil.
---

# plano-de-iteracao

## O que é (e por que importa)

Pega o que o teste revelou e vira um **plano de ação**: o que melhorar, em que ordem, em ciclos pequenos. Fecha o ciclo do Verificar. O risco que ele evita: sair "consertando tudo" de uma vez (vira redesign sem fim) ou, pior, consertar o **sintoma errado**. O objetivo é melhorar com foco e **revalidar**.

## Antes de planejar: você precisa dos achados

Esta skill **consome dados de teste**: os problemas observados num teste com usuário ou numa análise heurística. Peça-os se não vierem. **Sem achados reais, não há plano**: não invente problemas.

## Princípios

- **Priorize por impacto × esforço.** Ataque primeiro o que mais trava a ação principal e custa pouco. Nem todo problema merece a mesma pressa.
- **Vire cada achado numa hipótese de melhoria com sinal mensurável:** "acreditamos que [mudança] resolve [problema]; saberemos quando [métrica observável]". Não basta "melhorar o feedback".
- **Iterações pequenas e validáveis.** Um ciclo muda poucas coisas e dá para medir. Nada de redesenhar tudo de uma vez.
- **Separe "ataca agora" de "anota para depois".** Um teste sempre gera mais ideia do que cabe; proteja o foco.
- **Seja honesto.** Se um problema é falta de **entendimento** (não de tela), mande para mais descoberta, não para um conserto chutado.
- **Amarre na hipótese original.** O teste validou o que a feature apostava? Se não, esse é o achado mais importante de todos.

## Estrutura (use sempre este formato)

Escreva o resultado em um arquivo `plano-iteracao-[tela].md`:

```
# Plano de iteração — [tela / feature]

## O que aprendemos
[Resumo honesto dos achados, com os números do teste]

## Problemas priorizados
| Problema | Impacto | Esforço | Prioridade |
|---|---|---|---|

## Hipóteses de melhoria
[Cada uma: a mudança → o problema que resolve → a métrica que prova]

## Ciclos
- Ciclo 1: [o que muda, por quê, como medir]
- Ciclo 2: [...]

## O que NÃO mexer agora
[E por quê: fora de escopo, sinal fraco, ou precisa de mais descoberta]

## Como revalidar
[Com quem testar de novo e o que medir]
```

O documento é o entregável; não o resuma de volta no chat.

## Antes de entregar: passe por este gate

- Os problemas estão **priorizados por impacto × esforço**?
- Cada melhoria é uma **hipótese com métrica** (não um "melhorar X" genérico)?
- Está em **ciclos pequenos e validáveis** (não um redesign)?
- Separou **"agora" de "depois"**?
- Diz **como revalidar**?
- Apontou o que precisa de **mais descoberta** em vez de um conserto chutado?

Se algo falhar, ajuste antes de entregar. Um plano que tenta consertar tudo de uma vez não é um plano de iteração: é um redesign disfarçado, e redesign não se valida.
