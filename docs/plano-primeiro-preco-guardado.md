# Plano: a Calculadora guarda o primeiro preço sozinha

27/10/2026 · origem: diagnóstico de retenção (Kanban GRW-89) · status: **esperando aprovação da Sil, nada codado**

## Por que

- 87 contas novas (desde 12/10) abriram a Calculadora; 9 guardaram um preço. Só 3 clicaram em "Guardar esse preço".
- Guardar hoje são dois passos: o botão abre o `ModalProduto` com 9 campos (nome obrigatório, tipo, foto, preço, custo, descrição, observação, estoque, canal). Quem fecha a aba perde a conta inteira, porque os campos vivem só em `useState`.
- Na volta, o Painel mostra o passo "Calcular o primeiro preço" como se nada tivesse acontecido.
- Quem voltou guardou preço 4x mais (23% contra 6%). O e-mail "o preço não ficou guardado" teve 45 envios e 0 cliques.

## A ação principal e o fluxo

**Ação principal:** ver o próprio preço e encontrá-lo guardado na volta, sem fazer nada a mais.

**Fluxo em uma frase:** ela preenche a Calculadora, o resultado aparece, a Pólia One guarda esse primeiro preço no catálogo com um nome provisório, e na volta o Painel mostra o número dela.

## Regra (quando guarda sozinho)

Guarda sozinho só quando TUDO isto vale:

1. É o **primeiro preço**: a conta não tem nenhum produto com `calculadora_breakdown` (mesma leitura do `temPreco` dos Primeiros passos).
2. Perfil **Produto ou Serviço**. Encomenda fica de fora (é Pro e tem trava própria).
3. Não é recálculo (`produtoRecalcular` vazio).
4. O resultado é válido (`!precoNaoSalvavel`), **já apareceu na tela** (o bloco do preço entrou na área visível pelo menos uma vez) e ficou **parado por 2 segundos** (sem digitação nova). O "apareceu na tela" entrou na implementação: sem ele, o primeiro campo preenchido já gravaria um preço pela metade.

Depois do primeiro insert, a mesma linha é **atualizada** (pelo id guardado no componente) a cada resultado novo e estável, enquanto ela continua na tela. Não cria um produto por tecla.

Do segundo preço em diante, nada muda: botão "Guardar esse preço" + modal, como hoje.

## Decisões pra Sil (marcar antes de eu codar)

| # | Decisão | Minha recomendação |
|---|---|---|
| D1 | Guardar como **produto real do catálogo** ou como **rascunho separado** | **Produto real.** Primeiros passos, Projeção, Painel, bônus de 7 dias e régua já leem `produtos` com `calculadora_breakdown`. Rascunho exigiria ensinar tudo isso a ler outra coisa. Custo: ocupa 1 dos 5 do Grátis. |
| D2 | Nome provisório | "Primeiro produto" / "Primeiro serviço", com campo de nome logo abaixo do resultado pra trocar ali mesmo. |
| D3 | O passo "preço" dos Primeiros passos conta como feito com o guardado automático | **Sim.** Ela calculou, o preço existe. Isso também conta pro bônus de +7 dias do Pro. |
| D4 | O e-mail `guardar_d2` | Muda o texto no mesmo deploy: com o guardar automático, quem cai nele **não chegou ao resultado**, então "o preço que você calculou não ficou guardado" vira mentira. Texto novo: "A conta do preço ficou no meio". |

## Wireframe em cinza (estrutura, sem cor)

### Calculadora, logo depois do resultado (primeiro preço)

Hoje:

```
┌──────────────────────────────────────────────┐
│ Preço de venda             R$ 18,00          │
│ Custo total                R$  9,20          │
│ Taxas e impostos           R$  1,80          │
│ Seu lucro                  R$  7,00          │
│──────────────────────────────────────────────│
│ [ Guardar esse preço ]                       │
│ O preço vai pro seu catálogo com o custo...  │
└──────────────────────────────────────────────┘
        (clique abre modal com 9 campos)
```

Proposto (estado "guardado"):

```
┌──────────────────────────────────────────────┐
│ Preço de venda             R$ 18,00          │
│ Custo total                R$  9,20          │
│ Taxas e impostos           R$  1,80          │
│ Seu lucro                  R$  7,00          │
│──────────────────────────────────────────────│
│ (check) A Pólia One guardou esse preço no    │
│         catálogo.                            │
│                                              │
│ Nome do produto                              │
│ [ Primeiro produto                     ]     │
│                                              │
│ [ Completar o cadastro ]   Ver no catálogo   │
└──────────────────────────────────────────────┘
```

Os outros estados do mesmo bloco:

```
guardando   │ (spinner) Guardando esse preço...
erro        │ A Pólia One não conseguiu guardar esse preço agora.
            │ [ Tentar de novo ]          (os números continuam na tela)
inválido    │ Pra guardar, as porcentagens precisam somar menos de 100%.   (igual a hoje)
2º preço    │ [ Guardar esse preço ]  + modal                              (igual a hoje)
```

- Trocar o nome grava ao sair do campo (blur) ou no Enter. Vazio volta pro provisório.
- "Completar o cadastro" abre o `ModalProduto` em modo edição desse produto (foto, estoque, canal...).
- "Ver no catálogo" leva pra `/produtos`. Hoje o modal manda pra lá sozinho ao salvar; aqui ela fica na Calculadora, porque o resultado é o que ela veio ver.

### Painel, quando ela volta

```
┌──────────────────────────────────────────────┐
│ Primeiros passos                     1 de 3  │
│                                              │
│ (check) Primeiro produto                     │
│         R$ 18,00 · lucra R$ 7,00 por venda   │
│         Ver na Calculadora                   │
│                                              │
│ (  )    Fechar o Módulo 1 do Planejamento    │
│         O que faz a sua marca valer esse     │
│         preço.                               │
│         [ Quero abrir o Módulo 1 ]           │
│                                              │
│ (  )    Dar nome à marca                     │
└──────────────────────────────────────────────┘
```

Hoje o passo feito só ganha o check. Com o número dela ali, a primeira coisa que ela vê na volta é algo que já é dela.

## O que muda, por arquivo

| Arquivo | Mudança |
|---|---|
| `src/lib/primeiroPreco.ts` (novo) | Regra pura `deveGuardarSozinho({ temPreco, perfil, recalculando, invalido })` e `nomeProvisorio(perfil)`. Testável sem React. |
| `src/lib/primeiroPreco.test.ts` (novo) | Casos da regra: 1º preço sim; já tem preço não; Encomenda não; recálculo não; inválido não. |
| `src/components/produtos/Calculadora.tsx` | Prop nova `guardarSozinho: boolean`. Efeito com pausa de 2s sobre `calc.precoSugerido`/`custoBase`/breakdown: 1º resultado faz insert, os seguintes fazem update pelo id guardado em `useRef` (protege contra o efeito duplo do StrictMode). Bloco de resultado ganha os estados guardando/guardado/erro e o campo de nome. Evento `preco_calculado` uma vez por montagem quando o resultado fica válido e parado. |
| `src/routes/_authenticated/calculadora.tsx` | Lê se a conta já tem preço (mesma query do `temPreco`) e passa `guardarSozinho`. Invalida `produtos`, `produtos-total-ativos` e a query dos Primeiros passos depois do insert. Abre o `ModalProduto` em edição pro "Completar o cadastro". |
| eventos (sem tipo novo) | **Ajuste na implementação:** `founder_eventos.evento` tem check com a lista fechada de nomes, e um nome fora dela derruba o lote inteiro. Em vez de `preco_calculado`/`preco_guardado_auto`, o resultado na tela vira `feature_completed` com `feature: "calculadora"` e `propriedades: { passo: "resultado", perfil }`, e o guardado sozinho vira `create_product` com `propriedades: { tipo, auto: true }`. Sem migration. |
| `src/components/produtos/ModalProduto.tsx` | Tirar `avisarAtivacaoNoGA` de dentro do modal pra uma função compartilhada, chamada também pelo insert automático (senão a ativação do GA4 some). |
| `src/hooks/usePrimeirosPassos.ts` + `src/components/painel/PrimeirosPassos.tsx` | Além de `temPreco`, ler nome, preço e custo do primeiro produto com breakdown; o passo feito mostra a linha "R$ X · lucra R$ Y por venda" e o link "Ver na Calculadora". |
| `supabase/functions/_shared/lembretesConta.ts` | Texto novo do `guardar_d2` (D4). O SQL de quem recebe não muda. |
| `src/lib/lembretesConta.test.ts` | Ajustar o teste do texto do `guardar_d2`. |

Sem migration: a tabela `produtos`, a cota do Grátis (trigger `assert_cota_confere`) e a RLS ficam como estão. Primeiro preço sempre cabe na cota, porque a regra só vale com catálogo sem preço calculado.

## Riscos e como ficam cobertos

- **Preço no meio da digitação:** só grava depois de 2s parado e com resultado válido; a última versão estável sobrescreve a anterior na mesma linha.
- **Duas abas abertas:** cada uma pode criar um produto. Raro e inofensivo (fica um a mais no catálogo). Não vale trava no banco agora.
- **Ela não queria guardar:** o produto aparece no catálogo e pode ser arquivado ali, como qualquer outro. O texto do bloco diz que guardou, sem surpresa.
- **Grátis com 5 produtos de outro jeito (Planejamento):** os produtos que o Planejamento cria não têm breakdown, então a conta ainda está "sem preço" e o insert pode bater na cota. Nesse caso cai no estado de erro com o texto da cota que a página já usa, e o botão manual some como hoje.

## Como medir se funcionou

Medido em `founder_eventos` + `produtos`, comparando as 2 semanas antes e depois do deploy:

| Métrica | Hoje |
|---|---|
| De quem abre a Calculadora, quantas chegam ao resultado (`feature_completed` + `passo: resultado`) | não medido |
| De quem abre a Calculadora, quantas ficam com preço guardado | ~10% (9 de 87) |
| Contas novas que voltam em outro dia | 1 a 15% por coorte |

Se o guardado subir e a volta não, o problema deixa de ser "o preço some" e passa a ser "não há motivo pra voltar", e aí entra a fase seguinte (e-mail que mostra o número dela).

## Fora deste plano (próximas fases)

1. E-mail do dia seguinte com o número dela ("o Primeiro produto lucra R$ 7,00 por venda"), no lugar do lembrete genérico.
2. As 46 contas que nunca usaram nada: começar pela confirmação de e-mail.

## Ordem de execução depois da aprovação

1. Diário de bordo em `docs/script.md`.
2. Regra pura + testes.
3. Calculadora + rota (estados todos).
4. Primeiros passos no Painel.
5. Texto do `guardar_d2`.
6. `npm test` inteiro, revisores (`revisor-anti-ia`, `revisor-de-usabilidade`, `revisor-de-arquitetura`), análise de confiança com nota.
7. Commit só dos arquivos acima (`git commit -- <arquivos>`) e deploy só com o ok da Sil.
