# Análise heurística — E-mails transacionais (casca `emailPolia`)

## Contexto e ação principal

Avaliação da casca única de e-mail (`supabase/functions/_shared/email-polia.ts`), usada hoje por 9 pontos de disparo: conta criada, compra confirmada (ativação de senha), pagamento recusado, cancelamento, renovação, convite, contato, quiz. Analisei o layout renderizado (cabeçalho com logo, cartão branco com título/corpo/CTA, rodapé) a partir de três variantes reais: **conta pronta** (só botão), **problema no pagamento** (só botão, tom de urgência) e **resultado do quiz** (destaque + botão + descadastro).

**Ação principal inferida por variante** — não é uma ação só, então tratei cada família separadamente onde o comportamento diverge:
- E-mails de conta/cobrança (conta pronta, compra confirmada, pagamento recusado, cancelamento, renovação): clicar no único CTA para resolver o estado da conta (entrar, criar senha, atualizar cartão, reassinar).
- E-mail de quiz: clicar em "Seguir @usepolia" — mais relação do que resolução de conta, então os critérios de urgência pesam menos aqui.

## Diagnóstico por heurística

| # | Heurística | Status | Observação | Impacto |
|---|---|---|---|---|
| 1 | Visibilidade do status do sistema | OK | Preheader + headline sempre nomeiam o estado exato ("Sua compra foi confirmada", "Problema no pagamento", "Assinatura cancelada") — quem abre sabe o que aconteceu antes de ler o corpo. | Reforça confiança, não trava nada. |
| 2 | Correspondência com o mundo real | Atenção | Linguagem direta na maioria, mas "Sua conta é sua: um passo por vez, e a Pólia puxa o próximo" (boas-vindas) é abstrato — não diz qual é o próximo passo de fato. | Quem acabou de criar a conta não sai do e-mail sabendo o que vai encontrar. |
| 3 | Controle e liberdade | OK | Descadastro só nos e-mails que não são obrigação de conta (quiz), ausente nos transacionais de dinheiro — correto: ninguém pode optar por não receber recibo/aviso de cobrança. | — |
| 4 | Consistência e padrões | OK | Casca única garante cabeçalho/cartão/rodapé idênticos em toda disparo; rótulo do botão sempre nomeia a ação ("Atualizar pagamento", nunca "Clique aqui"). | Reduz custo de reconhecimento a cada e-mail novo. |
| 5 | Prevenção de erros | Violação | "Problema no pagamento" e "Renovação chegando" linkam para `/configuracoes` genérica, não direto para a seção de forma de pagamento. Quem clica ainda precisa achar o campo certo dentro da tela. | Atraso extra bem na única ação que o e-mail existe para resolver — o maior risco é a cliente desistir antes de achar o campo. |
| 6 | Reconhecimento em vez de memorização | OK | Rodapé fixo "Pólia · usepolia.com.br" em todo e-mail; nenhum depende de a leitora lembrar de contexto de fora. | — |
| 7 | Flexibilidade e eficiência | OK (não se aplica) | E-mail é ação única por natureza; não há caso de uso avançado a acelerar aqui. | — |
| 8 | Estética e design minimalista | OK | Um cartão, um título, um CTA — sem ruído, sem emoji, sem gradiente. Bate com o texto do próprio código sobre isso ser proposital. | — |
| 9 | Recuperação de erros | Violação | Nenhuma variante linka para `/ajuda` ou canal de suporte. "Pagamento recusado" e "Cancelamento" são exatamente os momentos de maior dúvida/ansiedade, e não têm porta de saída além do CTA automático — se o cartão está ok e a Stripe recusou por outro motivo, não há pra onde ir a partir do e-mail. | Quem tem uma dúvida fora do roteiro feliz sai do e-mail sem next step, tem que procurar ajuda sozinha. |
| 10 | Ajuda e documentação | Violação (mesma raiz do #9) | Rodapé só tem nome + domínio, nenhum link de ajuda em lugar nenhum da casca. | Mesmo impacto do item 9 — não há como se separar. |

## Problemas priorizados

| Gravidade | Problema | Correção concreta |
|---|---|---|
| Alta | E-mails de maior ansiedade (pagamento recusado, cancelamento) não têm nenhum link de ajuda — só o CTA automático. | Adicionar no rodapé da casca, sempre visível, algo como: `<p>Alguma dúvida? <a href="https://usepolia.com.br/ajuda">Fala com a gente</a></p>`. Vira parâmetro opcional `ajudaUrl` em `emailPolia()`, ligado por padrão nos e-mails de cobrança. |
| Alta | "Atualizar pagamento" e "Ver minha assinatura" linkam para `/configuracoes` genérica em vez de direto pro campo de forma de pagamento. | Se `/configuracoes` tiver seção/âncora de cobrança, trocar `ctaUrl` para `${SITE_URL}/configuracoes#pagamento` (ou equivalente); se não tiver, criar a âncora antes de trocar o link. |
| Média | Boas-vindas não diz qual é o primeiro passo real dentro do app — fica em "comece pelo que mais precisa". | Trocar por algo concreto e específico ao onboarding real do produto, ex.: "O primeiro passo é [nome do módulo/tela real de onboarding]" — checar com o fluxo de `/onboarding` qual é essa primeira tela hoje antes de escrever o texto. |
| Baixa | Link de ativação de conta expira "em algumas horas", sem hora exata — quem abre depois não sabe se ainda vale. | Se o backend souber o timestamp de expiração, trocar por "expira às HH:mm" ou "expira em X horas a partir de agora"; senão, manter como está — é preferível a inventar uma promessa que o código não garante. |

## Top 3 de maior retorno

1. **Adicionar link de ajuda no rodapé dos e-mails de cobrança.** É a correção mais barata (uma linha na casca, reaproveitada em 5 disparos de uma vez) e cobre o momento onde a ausência de saída pesa mais.
2. **Levar o CTA de pagamento direto pro campo de cobrança**, não pra `/configuracoes` genérica — fecha a distância entre "recebi o e-mail" e "resolvi o problema" na única ação que esses dois e-mails existem para pedir.
3. **Trocar a frase vaga de boas-vindas por um primeiro passo nomeado** — não custa reescrever, e hoje a primeira impressão de quem acabou de pagar é um convite sem destino claro.
