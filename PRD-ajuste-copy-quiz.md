# PRD de ajuste · Copy do quiz "Você está pagando pra trabalhar?"

Ajuste de texto na página pública `/quiz`, decidido pela Sil em 12/08/2026 a partir de uma revisão de copy. Não mexe em fluxo, estados, erros, pontuação, faixas, desempate de território ou gravação no Supabase. Isso tudo já está certo e continua valendo o `PRD-quiz.md` na raiz do repositório. Este documento só troca texto e a ordem de exibição das perguntas.

## 1. Por que

A revisão ao vivo da página encontrou 4 problemas:

1. O subtítulo da abertura não promete nada sobre o resultado. A frase forte que faria esse trabalho existe, mas só na meta description, invisível pra quem lê a página.
2. A pergunta 1 de 8 é do território Quanto vale (desconto). É a primeira coisa que a pessoa responde no quiz, o que reforça exatamente o recolapso "Pólia é ferramenta de precificação" que já foi corrigido na home (30/07) e na pauta e hashtag do social (10/08 e 11/08).
3. O texto do checkbox de LGPD ao vivo diverge do "texto exato" travado na Seção 5 do `PRD-quiz.md`.
4. A tela de resultado completo (território fraco + a conta pra fazer hoje) estava com a copy dos 6 territórios marcada como "[A DEFINIR na copy final]" no PRD original. É provável que o que está no ar hoje seja um texto placeholder, porque essa copy nunca foi fechada.

> **Nota de implementação sobre os itens 3 e 4.** A divergência do item 3 não foi acidente: o texto do checkbox e a frase de fechamento da Seção 2.4 foram trocados de propósito em 11/08/2026, porque os dois prometiam entrega por e-mail e o v1 não dispara e-mail nenhum (no-go da Seção 1 do `PRD-quiz.md`). Ver a Seção 6 aqui embaixo. O item 4 estava certo: o texto dos 6 territórios que estava no ar era rascunho.

## 2. O que muda

### 2.1 Abertura

**Antes:** "8 perguntas, 2 minutos, sem julgamento."

**Depois:** "8 perguntas, 2 minutos, sem julgamento. Descubra onde as decisões de dinheiro do seu negócio ainda saem no chute."

A headline "Você está pagando pra trabalhar?" e o CTA "Quero descobrir" não mudam.

### 2.2 Ordem das perguntas 1 a 6

O texto de cada pergunta e de cada alternativa não muda. Só a posição de exibição muda, seguindo a mesma hierarquia de módulos já travada na Seção 5 do `PRD-quiz.md` pro desempate de território fraco (Razão de existir > Quem você serve > O que você vende > Quanto vale > Como te acharem > Onde você vai). As perguntas 7 e 8, de comportamento, continuam por último, sem mudança de posição.

| Nova posição | Território | Pergunta |
| --- | --- | --- |
| 1 de 8 | Razão de existir | Te pedem pra explicar seu negócio em uma frase. Sai na hora? |
| 2 de 8 | Quem você serve | De 10 clientes, quantas voltam pra comprar de novo? |
| 3 de 8 | O que você vende | Qual produto seu deixa mais dinheiro no fim do mês? (não o que mais vende) |
| 4 de 8 | Quanto vale | Uma cliente pede desconto agora. Você sabe até onde pode ir sem sair no prejuízo? |
| 5 de 8 | Como te acharem | Sua última cliente nova chegou até você por onde? |
| 6 de 8 | Onde você vai | Quanto precisa entrar esse mês pra você fechar no azul? |
| 7 de 8 | Comportamento | Suas decisões de dinheiro (preço, compra, desconto) saem como? |
| 8 de 8 | Comportamento | Depois de uma decisão difícil, você fica remoendo se acertou? |

A pontuação, o cálculo de faixa e o critério de desempate continuam associados ao território de cada pergunta, não à posição dela. Mudar a ordem de exibição não muda a lógica de pontos.

> **Como isso ficou no código.** O `id` de cada pergunta continua colado no conteúdo, não na posição: `q1` segue sendo a do desconto, mesmo aparecendo em 4º. Duas consequências boas: o cálculo não tem como olhar pra posição, e o jsonb gravado em `quiz_leads.respostas` continua querendo dizer a mesma coisa que ontem. Travado por teste em `src/lib/quiz/pontuacao.test.ts`.

### 2.3 Checkbox de consentimento (LGPD)

**Antes (ao vivo):** "Aceito receber e-mails da Pólia. Sem spam, e você sai quando quiser."

**Depois (restaura o texto exato da Seção 5 do `PRD-quiz.md`):** "Aceito receber meu diagnóstico e conteúdos da Pólia por e-mail. Sem spam, e você sai quando quiser." + link "Política de privacidade"

> ⏸ **Em aberto, ver Seção 6.** Este texto pede aceite pra receber o diagnóstico por e-mail, e hoje nenhum e-mail sai. Não implementado até a decisão da Seção 6.

### 2.4 Tela de resultado completo (as 6 contas)

Fecha o que a Seção 5 do `PRD-quiz.md` deixou como "[A DEFINIR]". Pra cada território fraco, a tela mostra, nesta ordem: o rótulo "Onde você está mais no chute:" seguido do nome do território, a explicação curta, "A conta pra fazer hoje:" com a conta específica, e o fechamento fixo.

**Razão de existir**
Onde você está mais no chute: Razão de existir
Alguém te pergunta o que você faz, e a resposta sai enrolada, cheia de "depende" e de exemplo. A pessoa some antes de você terminar de explicar.
A conta pra fazer hoje: conte quantas vezes isso aconteceu esse mês, alguém perguntando o que você faz e sumindo depois. Esse número é o quanto a frase que falta já te custou.

**Quem você serve**
Onde você está mais no chute: Quem você serve
Você corre atrás de cliente novo todo mês, com o mesmo esforço, o mesmo desconto, a mesma pressa, e não sabe se as antigas ainda compram de você.
A conta pra fazer hoje: pegue suas últimas 10 vendas e conte quantas dessas clientes voltaram a comprar. Esse número, não o que você imagina, mostra quantas ficam de verdade.

**O que você vende**
Onde você está mais no chute: O que você vende
Você fecha vendas o mês inteiro, mas na hora de pagar as contas não sabe dizer qual produto pagou o quê.
A conta pra fazer hoje: escolha os 3 produtos ou serviços que mais saem e calcule quanto cada um deixa depois do custo. O que mais sai nem sempre é o que mais paga.

**Quanto vale**
Onde você está mais no chute: Quanto vale
Uma cliente pede desconto, você concede na hora pra não perder a venda, e só percebe o tamanho do prejuízo quando fecha a conta do mês.
A conta pra fazer hoje: pegue seu produto mais vendido e calcule quanto ele deixa depois de todos os custos. Esse número é o teto real do seu desconto, não o que parece justo na hora.

**Como te acharem**
Onde você está mais no chute: Como te acharem
Você posta em toda rede que existe, sem saber de verdade por onde as clientes novas estão chegando até você.
A conta pra fazer hoje: puxe suas últimas 5 vendas novas e escreva por onde cada cliente te achou. O canal que mais se repete é onde vale insistir essa semana.

**Onde você vai**
Onde você está mais no chute: Onde você vai
Toda venda parece uma vitória, mas você não sabe dizer se o mês está fechando no azul ou só parecendo fechar.
A conta pra fazer hoje: some suas contas fixas do mês (aluguel, ferramentas, o que for) e divida pelo que você cobra em média. Esse é o tanto que precisa vender só pra empatar.

**Fechamento fixo** (igual pros 6 territórios)
Seus próximos passos chegam no seu e-mail.
Seguir @usepolia →

> ⏸ **A primeira linha do fechamento está em aberto, ver Seção 6.** "Seus próximos passos chegam no seu e-mail" promete uma entrega que o v1 não faz. No ar hoje está "O e-mail fica guardado pra avisar quando a Pólia abrir." O botão "Seguir @usepolia →" está implementado e não muda.

## 3. Regras de voz (herdadas do `PRD-quiz.md`, sem mudança)

- Sem travessão, sem palavra banida (margem, etapa, trilha, marco, tom de coach, promessa com prazo ou cifra).
- CTAs na gramática da marca: 1ª pessoa do desejo, seta → pra navegação.
- Tokens e fontes só de `src/styles.css`, nada novo.

## 4. Definition of Done

- [x] Subtítulo da abertura atualizado com o texto da Seção 2.1.
- [x] Ordem de exibição das 8 perguntas atualizada conforme a tabela da Seção 2.2. Texto de cada pergunta e de cada alternativa sem alteração.
- [x] Pontuação, faixas e cálculo de território fraco testados de novo depois da reordenação. 28 testes passam, incluindo tudo A, tudo C e os 3 empates de território, todos escritos por id de pergunta e não por posição. Dois testes novos travam o mapa pergunta/território e a ordem de exibição.
- [ ] Checkbox de consentimento com o texto da Seção 2.3. **Segurado pela Seção 6.**
- [x] As 6 contas de território da Seção 2.4 implementadas na tela de resultado completo, substituindo o texto placeholder. (A frase de fechamento fica segurada pela Seção 6.)
- [x] Sem travessão e sem palavra banida em nenhum texto novo. Travessão travado por teste.
- [ ] Testado em viewport 390px e no webview do Instagram. **Não feito**, depende de celular real.

## 5. Handoff pro Claude Code

Prompt original, mantido como registro:

> Implemente os ajustes de copy da página pública /quiz descritos no PRD-ajuste-copy-quiz.md na raiz do repositório, em cima do que já está implementado conforme o PRD-quiz.md. Regras: não altere fluxo, estados, erros, pontuação, faixas ou gravação no Supabase, isso já está pronto e correto; troque só os textos e a ordem de exibição das perguntas 1 a 6 listados na Seção 2, usando os textos exatos, sem reescrever; implemente as 6 contas de território da Seção 2.4 na tela de resultado completo; confirme que a pontuação e o desempate de território continuam associados ao conteúdo de cada pergunta, não à posição dela, depois da reordenação; mantenha os tokens e fontes de src/styles.css. Ao final, revise contra o checklist da Seção 4 e liste o que não passou.

## 6. Em aberto: as duas frases que prometem e-mail

As Seções 2.3 e 2.4 restauram dois textos que foram removidos de propósito em 11/08/2026:

1. O consentimento: "Aceito receber **meu diagnóstico** e conteúdos da Pólia por e-mail."
2. O fechamento do resultado: "Seus próximos passos chegam no seu e-mail."

Os dois prometem que algo chega por e-mail. Hoje nada chega: o disparo é no-go do v1 (Seção 1 do `PRD-quiz.md`), o diagnóstico é a própria tela de resultado, e a tabela `quiz_leads` só guarda o endereço. Pedir aceite de LGPD pra uma entrega que não existe é coletar dado sob pretexto que não se cumpre, e a lista é justamente o ativo que o quiz existe pra construir.

Três saídas, sem terceira via boa:

| Saída | O que exige | Consequência |
| --- | --- | --- |
| **A. Fazer a promessa virar verdade** | Um e-mail único de entrega (faixa + território fraco + a conta), via Resend, que já está ligado no projeto e já manda os 9 transacionais. Não é a sequência de nutrição de 3 e-mails, que é o que está travado por falta de decisão de provedor. | Os dois textos da Seção 2 entram como escritos. Melhor conversão e melhor primeira impressão. |
| **B. Restaurar os textos assim mesmo** | Nada. | A pessoa espera um e-mail que não chega. Queima a lista na primeira impressão. |
| **C. Manter o texto honesto que está no ar** | Nada. | Copy fraca em relação à do PRD, mas cumpre o que promete. |

Enquanto a decisão não vem, o que está no ar é a saída C.
